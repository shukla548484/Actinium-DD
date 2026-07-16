import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { generatePONumber, reservePONumber } from '@/lib/services/po-number-generator';
import { generatePOPDF } from '@/lib/services/po-pdf-generator';
import { getGoogleCloudStorageService } from '@/lib/google-cloud-storage';
import { getPoApprovalPolicy } from '@/lib/services/po-approval-policy.service';
import {
  poRequiresTierApproval,
  resolveWorkflowStatusOnCreate,
} from '@/lib/services/po-workflow-status.service';
import { PurchaseOrderWorkflowStatus } from '@/lib/types/purchase-order-workflow';
import { notifyPoApprovalPending } from '@/lib/procurement/approval-notifications';
import { QuoteStatus } from '@prisma/client';
import { z } from 'zod';
import { isAdminEquivalentAccessLevel } from '@/lib/admin-access-level';

const standalonePOSchema = z.object({
  quoteId: z.string().uuid(), // Quote ID is now required for standalone PO
  createdDate: z.string(),
  ccEmails: z.string().optional(),
  includeUserEmailInCc: z.boolean().default(true),
  userRemarks: z.string().optional(),
  vendorRemarks: z.string().optional(),
  conditions: z.string().optional(),
  leadTime: z.string().optional(),
  portOfDelivery: z.string().optional(),
  agentDetails: z.string().optional(), // Added missing field
  contractId: z.string().uuid().optional().nullable(),
});

/**
 * POST /api/purchase-orders/create-standalone
 * Create a standalone Purchase Order without a requisition
 * Accessible to users with access levels 32, 33, or 50
 */
export async function POST(request: NextRequest) {
  let errorStep = 'Initialization';
  let errorDetails: any = {};

  try {
    errorStep = 'Authentication';
    console.log('🔵 [CREATE STANDALONE PO] Starting Standalone Purchase Order creation...');

    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      errorDetails = { step: errorStep, message: 'User not authenticated' };
      console.error('❌ [CREATE STANDALONE PO]', errorDetails);
      return NextResponse.json({ error: 'Unauthorized', details: errorDetails, step: errorStep }, { status: 401 });
    }

    const userAccessLevel = currentUser.designationAccessLevel || 0;
    const allowedLevels = [32, 33, 50, 99, 100];
    if (!allowedLevels.includes(userAccessLevel) && !isAdminEquivalentAccessLevel(userAccessLevel)) {
      errorDetails = {
        step: errorStep,
        userAccessLevel,
        allowedLevels,
        message: `Access level ${userAccessLevel} is not authorized to create Purchase Orders. Required: 32, 33, or administrators (50 / 99 / 100)`,
      };
      console.error('❌ [CREATE STANDALONE PO]', errorDetails);
      return NextResponse.json(
        {
          error: 'Insufficient permissions to create Purchase Orders',
          details: errorDetails,
          step: errorStep,
          userAccessLevel,
          requiredLevels: allowedLevels,
        },
        { status: 403 }
      );
    }
    console.log(`✅ [CREATE STANDALONE PO] User authenticated: ${currentUser.id}, Access Level: ${userAccessLevel}`);

    errorStep = 'Parse and Validate Request';
    const body = await request.json();
    const validatedData = standalonePOSchema.parse(body);

    errorStep = 'Fetch Quote';
    // Fetch the quote with all related data
    const quote = await prisma.vendorQuote.findUnique({
      where: { id: validatedData.quoteId },
      include: {
        vendor: true,
        requisition: {
          include: {
            vessel: {
              include: {
                company: true,
              },
            },
            createdBy: true,
            items: true,
          },
        },
        quotedItems: true,
      },
    });

    if (!quote) {
      errorDetails = { step: errorStep, quoteId: validatedData.quoteId, message: 'Quote not found' };
      console.error('❌ [CREATE STANDALONE PO]', errorDetails);
      return NextResponse.json({ error: 'Quote not found', details: errorDetails, step: errorStep }, { status: 404 });
    }

    // Validate quote status - should be APPROVED for standalone PO
    if (quote.status !== QuoteStatus.APPROVED) {
      errorDetails = { step: errorStep, quoteId: validatedData.quoteId, currentStatus: quote.status, message: 'Quote must be APPROVED to create Purchase Order' };
      console.error('❌ [CREATE STANDALONE PO]', errorDetails);
      return NextResponse.json({ error: 'Quote must be APPROVED', details: errorDetails, step: errorStep }, { status: 400 });
    }

    const vessel = quote.requisition.vessel;
    const vendor = quote.vendor;
    const requisition = quote.requisition;

    // Validate vessel has required fields
    if (!vessel.name || !vessel.code) {
      errorDetails = { step: errorStep, vesselId: vessel.id, message: 'Vessel missing required fields (name or code)' };
      console.error('❌ [CREATE STANDALONE PO]', errorDetails);
      return NextResponse.json({ error: 'Vessel data incomplete', details: errorDetails, step: errorStep }, { status: 400 });
    }

    errorStep = 'Generate PO Number';
    // Generate PO number using vessel ID and requisition type
    // Use the same requisition type that was used when creating the requisition
    // This will check availability and increment if needed
    let poNumber = await generatePONumber(requisition.vesselId, requisition.requisitionType);
    console.log(`✅ [CREATE STANDALONE PO] PO Number generated: ${poNumber}`);
    
    // Double-check PO number is available before creating (safety check)
    let attempts = 0;
    const maxAttempts = 100;
    while (attempts < maxAttempts) {
      const existingPO = await prisma.purchaseOrder.findUnique({
        where: { poNumber: poNumber },
        select: { id: true },
      });
      
      if (!existingPO) {
        // PO number is available, proceed
        break;
      }
      
      // PO number is occupied, generate next one
      console.warn(`⚠️  [CREATE STANDALONE PO] PO number ${poNumber} is occupied, generating next...`);
      poNumber = await generatePONumber(requisition.vesselId, requisition.requisitionType);
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      errorDetails = { step: errorStep, message: 'Failed to find available PO number after multiple attempts' };
      console.error('❌ [CREATE STANDALONE PO]', errorDetails);
      return NextResponse.json({ error: 'Failed to generate available PO number', details: errorDetails, step: errorStep }, { status: 500 });
    }
    
    console.log(`✅ [CREATE STANDALONE PO] Final PO Number confirmed available: ${poNumber}`);
    
    // Reserve PO number (if reservation system is implemented)
    await reservePONumber(requisition.vesselId, requisition.requisitionType, poNumber, currentUser.id);

    errorStep = 'Create Purchase Order';
    const dateOfIssue = new Date(validatedData.createdDate);
    const totalAmount = quote.totalAmount ? Number(quote.totalAmount) : 0;
    const companyId = vessel.companyId ?? null;
    const vesselId = requisition.vesselId;
    const policy = await getPoApprovalPolicy(companyId, vesselId);
    const requiresTier2OrMore = poRequiresTierApproval(totalAmount, policy);
    const workflowStatus = resolveWorkflowStatusOnCreate(totalAmount, policy);

    // Build purchase order data
    // Note: contractId is optional and will be omitted if not provided
    // This avoids errors if the contract_id column doesn't exist in the database
    const poData: any = {
      poNumber,
      requisitionId: requisition.id,
      quoteId: quote.id,
      vesselId: requisition.vesselId,
      vesselName: vessel.name || 'Unknown Vessel', // Store vessel name directly
      dateOfIssue,
      totalAmount: quote.totalAmount ? Number(quote.totalAmount) : null,
      currency: quote.currency || 'USD',
      status: 'ACTIVE',
      completionStatus: 'OPEN',
      workflowStatus,
    };

    // Only include contractId if provided
    // We'll try to include it, but if the column doesn't exist, Prisma will error
    // In that case, we'll catch and retry without contractId
    if (validatedData.contractId) {
      try {
        // Verify contract exists before including it
        const contractExists = await prisma.contract.findUnique({
          where: { id: validatedData.contractId },
          select: { id: true },
        });
        if (contractExists) {
          poData.contractId = validatedData.contractId;
        }
      } catch (error) {
        console.warn('Contract lookup failed, skipping contractId:', error);
      }
    }

    console.log('🔵 [CREATE STANDALONE PO] Creating purchase order with data:', {
      poNumber,
      requisitionId: requisition.id,
      quoteId: quote.id,
      vesselName: vessel.name,
      dateOfIssue,
      totalAmount: poData.totalAmount,
      currency: poData.currency,
    });

    let purchaseOrder;
    try {
      purchaseOrder = await prisma.purchaseOrder.create({
        data: poData,
      });
      console.log('✅ [CREATE STANDALONE PO] Purchase Order created in database:', {
        id: purchaseOrder.id,
        poNumber: purchaseOrder.poNumber,
        vesselName: purchaseOrder.vesselName,
        requisitionId: purchaseOrder.requisitionId,
        quoteId: purchaseOrder.quoteId,
      });
    } catch (createError: any) {
      console.error('❌ [CREATE STANDALONE PO] Error creating purchase order:', {
        error: createError.message,
        code: createError.code,
        meta: createError.meta,
        poData: {
          poNumber: poData.poNumber,
          requisitionId: poData.requisitionId,
          quoteId: poData.quoteId,
          vesselName: poData.vesselName,
        },
      });
      // If error is about missing columns, remove them and retry
      if (createError.message && createError.message.includes('does not exist')) {
        const missingColumns = ['contract_id', 'budget_code', 'gl_code', 'cost_center'];
        let retryNeeded = false;
        
        for (const column of missingColumns) {
          if (createError.message.includes(column)) {
            console.warn(`⚠️  [CREATE STANDALONE PO] ${column} column not found, removing from data`);
            // Map database column names to Prisma field names
            const fieldMap: Record<string, string> = {
              'contract_id': 'contractId',
              'budget_code': 'budgetCode',
              'gl_code': 'glCode',
              'cost_center': 'costCenter',
            };
            const fieldName = fieldMap[column];
            if (fieldName && poData[fieldName] !== undefined) {
              delete poData[fieldName];
              retryNeeded = true;
            }
          }
        }
        
        if (retryNeeded) {
          try {
            purchaseOrder = await prisma.purchaseOrder.create({
              data: poData,
            });
          } catch (retryError: any) {
            // If retry also fails, throw with better error message
            errorDetails = { 
              step: errorStep, 
              originalError: createError.message,
              retryError: retryError.message,
              poData: Object.keys(poData),
            };
            console.error('❌ [CREATE STANDALONE PO] Retry also failed:', retryError);
            throw new Error(`Failed to create purchase order after retry: ${retryError.message}`);
          }
        } else {
          // Re-throw if we couldn't handle it
          throw createError;
        }
      } else {
        // Re-throw if it's a different error
        throw createError;
      }
    }

    // Ensure purchaseOrder was created successfully
    if (!purchaseOrder || !purchaseOrder.id) {
      errorDetails = { 
        step: errorStep, 
        message: 'Purchase order creation failed - purchaseOrder is undefined or missing id',
        poData: {
          poNumber: poData.poNumber,
          requisitionId: poData.requisitionId,
          quoteId: poData.quoteId,
          vesselName: poData.vesselName,
        }
      };
      console.error('❌ [CREATE STANDALONE PO]', errorDetails);
      return NextResponse.json({ error: 'Purchase order creation failed', details: errorDetails, step: errorStep }, { status: 500 });
    }

    // Immediately verify the PO exists in the database
    try {
      const verifyPO = await prisma.purchaseOrder.findUnique({
        where: { id: purchaseOrder.id },
        select: {
          id: true,
          poNumber: true,
          vesselName: true,
          requisitionId: true,
          quoteId: true,
          dateOfIssue: true,
          totalAmount: true,
          currency: true,
          status: true,
        },
      });
      
      if (!verifyPO) {
        console.error('❌ [CREATE STANDALONE PO] CRITICAL: PO was created but cannot be found in database!', {
          purchaseOrderId: purchaseOrder.id,
          poNumber: purchaseOrder.poNumber,
        });
        return NextResponse.json({
          error: 'Purchase Order was created but cannot be verified in database',
          poNumber: purchaseOrder.poNumber,
          purchaseOrderId: purchaseOrder.id,
        }, { status: 500 });
      }
      
      console.log('✅ [CREATE STANDALONE PO] Verified PO exists in database:', {
        id: verifyPO.id,
        poNumber: verifyPO.poNumber,
        vesselName: verifyPO.vesselName,
        requisitionId: verifyPO.requisitionId,
        quoteId: verifyPO.quoteId,
      });
    } catch (verifyError: any) {
      console.error('❌ [CREATE STANDALONE PO] Error verifying PO:', verifyError);
      // Don't fail the request, but log the error for debugging
    }

    errorStep = 'Generate PDF';
    // Ensure vessel is defined before using it
    if (!vessel) {
      errorDetails = { step: errorStep, message: 'Vessel data not available' };
      console.error('❌ [CREATE STANDALONE PO]', errorDetails);
      return NextResponse.json({ error: 'Vessel data not available', details: errorDetails, step: errorStep }, { status: 500 });
    }

    const pdfBuffer = await generatePOPDF({
      poNumber,
      dateOfIssue,
      requisition: requisition as Parameters<typeof generatePOPDF>[0]['requisition'],
      quote: quote as Parameters<typeof generatePOPDF>[0]['quote'],
      userRemarks: validatedData.userRemarks,
      vendorRemarks: validatedData.vendorRemarks,
      conditions: validatedData.conditions,
      leadTime: validatedData.leadTime,
      portOfDelivery: validatedData.portOfDelivery,
      agentDetails: validatedData.agentDetails,
    });

    errorStep = 'Upload PDF to Storage';
    const storageService = getGoogleCloudStorageService();
    const pdfFileName = `PO-${poNumber}.pdf`;
    const pdfUrl = await storageService.uploadFile(pdfBuffer, pdfFileName, 'application/pdf');

    await prisma.purchaseOrder.update({
      where: { id: purchaseOrder.id },
      data: {
        originalPdfUrl: pdfUrl,
      },
    });

    try {
      await notifyPoApprovalPending({
        request,
        actorUserId: currentUser.id,
        vesselId,
        companyId,
        requisitionNumber: requisition.requisitionNumber,
        purchaseOrderNumber: poNumber,
        quoteId: quote.id,
        poId: purchaseOrder.id,
        approvalLevel: 1,
        targetAccessLevels: policy.level1AccessLevels,
        metadata: {
          totalAmount: quote.totalAmount,
          currency: quote.currency,
          standalone: true,
        },
      });
    } catch (notifyError: unknown) {
      console.error('⚠️  [CREATE STANDALONE PO] Approval notification failed (non-critical):', notifyError);
    }

    const readyToSend = workflowStatus === PurchaseOrderWorkflowStatus.PO_CONFIRMED;

    console.log('✅ [CREATE STANDALONE PO] Purchase Order created successfully:', {
      poNumber,
      purchaseOrderId: purchaseOrder.id,
      vesselName: purchaseOrder.vesselName,
      requisitionId: purchaseOrder.requisitionId,
      quoteId: purchaseOrder.quoteId,
    });

    // Verify the PO was actually saved by querying it back
    try {
      const verifyPO = await prisma.purchaseOrder.findUnique({
        where: { id: purchaseOrder.id },
        select: {
          id: true,
          poNumber: true,
          vesselName: true,
          requisitionId: true,
          quoteId: true,
          dateOfIssue: true,
          totalAmount: true,
          currency: true,
          status: true,
        },
      });
      
      if (!verifyPO) {
        console.error('❌ [CREATE STANDALONE PO] CRITICAL: PO was created but cannot be found in database!');
        return NextResponse.json({
          error: 'Purchase Order was created but cannot be verified in database',
          poNumber,
          purchaseOrderId: purchaseOrder.id,
        }, { status: 500 });
      }
      
      console.log('✅ [CREATE STANDALONE PO] Verified PO exists in database:', verifyPO);
    } catch (verifyError: any) {
      console.error('❌ [CREATE STANDALONE PO] Error verifying PO:', verifyError);
      // Don't fail the request, but log the error
    }

    return NextResponse.json({
      success: true,
      message: readyToSend
        ? 'Purchase Order created — ready to send to vendor'
        : 'Purchase Order created — awaiting tier approval',
      poNumber,
      purchaseOrderId: purchaseOrder.id,
      vesselName: purchaseOrder.vesselName,
      quoteId: quote.id,
      workflowStatus,
      readyToSend,
      requiresTier2OrMore,
    });
  } catch (error: any) {
    console.error(`❌ [CREATE STANDALONE PO] Error at step ${errorStep}:`, error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: error.errors,
          step: errorStep,
        },
        { status: 400 }
      );
    }

    // Enhanced error details
    const enhancedErrorDetails = {
      ...errorDetails,
      errorMessage: error.message,
      errorCode: error.code,
      errorMeta: error.meta,
      step: errorStep,
    };

    return NextResponse.json(
      {
        error: error.message || 'Failed to create Purchase Order',
        details: enhancedErrorDetails,
        step: errorStep,
      },
      { status: 500 }
    );
  }
}








