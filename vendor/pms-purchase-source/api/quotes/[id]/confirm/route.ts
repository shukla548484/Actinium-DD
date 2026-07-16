import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { storeEmailMessage } from '@/lib/email-storage';
import {
  buildPurchaseOrderEmailCc,
  sendPurchaseOrderEmail,
} from '@/lib/purchase-order-resend';
import { RequisitionStatus } from '@/lib/types/requisition';
import { recordPurchaseHistory, PurchaseHistoryActionType } from '@/lib/services/purchase-history.service';
import { generatePONumber, reservePONumber } from '@/lib/services/po-number-generator';
import { generatePOPDF } from '@/lib/services/po-pdf-generator';
import { getGoogleCloudStorageService } from '@/lib/google-cloud-storage';
import { markTaskNotificationsAsRead } from '@/lib/utils/mark-task-notifications-read';
import { isAdminEquivalentAccessLevel } from '@/lib/admin-access-level';
import {
  resolveIsBudgetedForPoIssue,
} from '@/lib/procurement/requisition-budget-classification';
import { resolveSplitContextForQuoteConfirm } from '@/lib/procurement/split-child-confirm-context';
import { getPoApprovalPolicy } from '@/lib/services/po-approval-policy.service';
import { PurchaseOrderWorkflowStatus } from '@/lib/types/purchase-order-workflow';
import {
  resolveWorkflowStatusOnCreate,
  resolveWorkflowStatusAfterApproval,
} from '@/lib/services/po-workflow-status.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/quotes/[id]/confirm - Confirm quote and send PO
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  let errorStep = 'Initialization';
  let errorDetails: any = {};
  
  try {
    errorStep = 'Authentication';
    console.log('🔵 [CONFIRM QUOTE] Starting quote confirmation process...');
    
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      errorDetails = { step: errorStep, message: 'User not authenticated' };
      console.error('❌ [CONFIRM QUOTE]', errorDetails);
      return NextResponse.json({ 
        error: 'Unauthorized', 
        details: errorDetails,
        step: errorStep 
      }, { status: 401 });
    }
    
    const userAccessLevel = currentUser.designationAccessLevel || 0;
    const allowedLevels = [32, 33, 50, 99, 100];
    if (!allowedLevels.includes(userAccessLevel) && !isAdminEquivalentAccessLevel(userAccessLevel)) {
      errorDetails = { 
        step: errorStep, 
        userAccessLevel,
        allowedLevels,
        message: `Access level ${userAccessLevel} is not authorized to confirm quotes. Required: 32, 33, or 50` 
      };
      console.error('❌ [CONFIRM QUOTE]', errorDetails);
      return NextResponse.json({ 
        error: 'Insufficient permissions to confirm quotes',
        details: errorDetails,
        step: errorStep,
        userAccessLevel,
        requiredLevels: allowedLevels
      }, { status: 403 });
    }
    console.log(`✅ [CONFIRM QUOTE] User authenticated: ${currentUser.id}, Access Level: ${userAccessLevel}`);

    const { id } = await context.params;
    console.log(`🔵 [CONFIRM QUOTE] Quote ID: ${id}`);
    
    errorStep = 'Parse Request';
    const body = await request.json();
    let poNumber = body.poNumber; // Allow undefined - will be generated if not provided
    const customMessage = body.customMessage;
    const ccEmails = body.ccEmails;
    const childRequisitionId =
      typeof body.childRequisitionId === 'string' ? body.childRequisitionId.trim() : '';
    
    console.log(`✅ [CONFIRM QUOTE] Request parsed - PO Number: ${poNumber || 'Will be generated'}, Custom Message: ${customMessage ? 'Provided' : 'Not provided'}, CC Emails: ${ccEmails || 'None'}, Split child: ${childRequisitionId || 'none'}`);

    errorStep = 'Fetch Quote';
    console.log(`🔵 [CONFIRM QUOTE] Fetching quote from database...`);

    // Get quote
    const quote = await prisma.vendorQuote.findUnique({
      where: { id },
      include: {
        requisition: {
          include: {
            vessel: {
              include: {
                company: true,
              },
            },
            createdBy: true,
          },
        },
        vendor: true,
        quotedItems: true,
      },
    });

    if (!quote) {
      errorDetails = { step: errorStep, quoteId: id, message: 'Quote not found in database' };
      console.error('❌ [CONFIRM QUOTE]', errorDetails);
      return NextResponse.json({ 
        error: 'Quote not found',
        details: errorDetails,
        step: errorStep 
      }, { status: 404 });
    }
    console.log(`✅ [CONFIRM QUOTE] Quote found - Status: ${quote.status}, Vendor: ${quote.vendor.name}`);

    const splitContext = await resolveSplitContextForQuoteConfirm(id, childRequisitionId || null);

    if (childRequisitionId && !splitContext) {
      return NextResponse.json(
        { error: 'Split allocation not found for this child requisition and quote' },
        { status: 404 }
      );
    }

    const poRequisition = splitContext?.childRequisition ?? quote.requisition;
    const quoteForPo = splitContext?.quoteForPo ?? quote;
    const effectiveTotalAmount =
      splitContext?.effectiveTotalAmount ??
      (quote.totalAmount ? Number(quote.totalAmount) : 0);

    const isBudgetedForPo = resolveIsBudgetedForPoIssue({
      requested: body.isBudgeted,
      requisitionIsBudgeted: poRequisition.isBudgeted,
      budgetCode: poRequisition.budgetCode,
    });

    errorStep = 'Validate Quote Status';
    if (quote.status !== 'APPROVED') {
      errorDetails = { 
        step: errorStep, 
        quoteId: id, 
        currentStatus: quote.status,
        requiredStatus: 'APPROVED',
        message: `Quote status is ${quote.status}, but only APPROVED quotes can be confirmed` 
      };
      console.error('❌ [CONFIRM QUOTE]', errorDetails);
      return NextResponse.json(
        { 
          error: 'Only approved quotes can be confirmed',
          details: errorDetails,
          step: errorStep,
          currentStatus: quote.status,
          requiredStatus: 'APPROVED'
        },
        { status: 400 }
      );
    }
    console.log(`✅ [CONFIRM QUOTE] Quote status validated - APPROVED`);

    errorStep = 'Validate Quote Data';
    // Validate required data
    if (!quote.vendor.primaryEmail) {
      errorDetails = { 
        step: errorStep, 
        quoteId: id, 
        vendorId: quote.vendor.id,
        vendorName: quote.vendor.name,
        message: 'Vendor does not have a primary email address' 
      };
      console.error('❌ [CONFIRM QUOTE]', errorDetails);
      return NextResponse.json(
        { 
          error: 'Vendor email not found',
          details: errorDetails,
          step: errorStep
        },
        { status: 400 }
      );
    }
    
    if (!quote.totalAmount || effectiveTotalAmount <= 0) {
      errorDetails = { 
        step: errorStep, 
        quoteId: id, 
        totalAmount: effectiveTotalAmount,
        message: 'Quote total amount is missing or invalid' 
      };
      console.error('❌ [CONFIRM QUOTE]', errorDetails);
      return NextResponse.json(
        { 
          error: 'Quote total amount is invalid',
          details: errorDetails,
          step: errorStep
        },
        { status: 400 }
      );
    }
    
    if (!quote.quotedItems || quote.quotedItems.length === 0) {
      errorDetails = { 
        step: errorStep, 
        quoteId: id, 
        itemCount: quote.quotedItems?.length || 0,
        message: 'Quote has no items' 
      };
      console.error('❌ [CONFIRM QUOTE]', errorDetails);
      return NextResponse.json(
        { 
          error: 'Quote has no items',
          details: errorDetails,
          step: errorStep
        },
        { status: 400 }
      );
    }
    console.log(`✅ [CONFIRM QUOTE] Quote data validated - Email: ${quote.vendor.primaryEmail}, Total: ${quote.totalAmount}, Items: ${quote.quotedItems.length}`);

    errorStep = 'Generate PO Number';
    console.log(`🔵 [CONFIRM QUOTE] Generating PO number...`);
    
    // Generate PO number if not provided
    if (!poNumber) {
      poNumber = await generatePONumber(poRequisition.vesselId, poRequisition.requisitionType);
      console.log(`✅ [CONFIRM QUOTE] PO Number generated: ${poNumber}`);
      
      // Reserve the PO number
      await reservePONumber(poRequisition.vesselId, poRequisition.requisitionType, poNumber, currentUser.id);
      console.log(`✅ [CONFIRM QUOTE] PO Number reserved`);
    }

    errorStep = 'Generate PDF';
    console.log(`🔵 [CONFIRM QUOTE] Generating Purchase Order PDF...`);
    
    const dateOfIssue = new Date();
    const pdfBuffer = await generatePOPDF({
      poNumber: poNumber!,
      dateOfIssue,
      requisition: poRequisition as any,
      quote: quoteForPo as any,
      userRemarks: customMessage,
      vendorRemarks: undefined,
      conditions: undefined,
      leadTime: undefined,
      portOfDelivery: undefined,
      agentDetails: undefined,
    });
    
    console.log(`✅ [CONFIRM QUOTE] PDF generated (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);

    errorStep = 'Upload PDF to GCS';
    console.log(`🔵 [CONFIRM QUOTE] Uploading PDF to Google Cloud Storage...`);
    
    const gcs = getGoogleCloudStorageService();
    const fileName = `PO_${poNumber}_${poRequisition.vessel?.code || 'UNKNOWN'}_${dateOfIssue.toISOString().split('T')[0]}.pdf`;
    const uploadResult = await gcs.uploadFile(pdfBuffer, fileName, 'application/pdf', {
      vesselId: poRequisition.vesselId,
      category: 'purchase-orders' as any,
    });
    
    console.log(`✅ [CONFIRM QUOTE] PDF uploaded to GCS: ${uploadResult.publicUrl}`);

    errorStep = 'Generate Email Content';
    console.log(`🔵 [CONFIRM QUOTE] Generating email content...`);
    
    const subject = `Purchase Order ${poNumber} - ${poRequisition.requisitionNumber}`;
    const htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #10b981;">Purchase Order Confirmation</h2>
            
            <p>Dear ${quote.vendor.contactPerson || 'Sir/Madam'},</p>
            
            <p>We are pleased to confirm your quote and proceed with the purchase order:</p>
            
            <table style="border-collapse: collapse; width: 100%; margin: 20px 0; border: 1px solid #ddd;">
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; background-color: #f5f5f5;">PO Number:</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${poNumber}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; background-color: #f5f5f5;">Requisition Number:</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${poRequisition.requisitionNumber}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; background-color: #f5f5f5;">Total Amount:</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${quote.currency} ${effectiveTotalAmount.toLocaleString() || '0'}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; background-color: #f5f5f5;">Vessel:</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${poRequisition.vessel?.name ?? quote.requisition.vessel.name}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; background-color: #f5f5f5;">Date of Issue:</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${dateOfIssue.toLocaleDateString()}</td>
              </tr>
            </table>
            
            <p>Please find attached the Purchase Order PDF document for your reference.</p>
            
            ${customMessage ? `
              <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
                <p style="white-space: pre-wrap;">${customMessage}</p>
              </div>
            ` : ''}
            
            <p>Please proceed with the order as per the agreed terms.</p>
            
            <p>Best regards,<br>
            ${poRequisition.createdBy?.firstName ?? quote.requisition.createdBy.firstName} ${poRequisition.createdBy?.lastName ?? quote.requisition.createdBy.lastName}<br>
            Procurement Team</p>
          </div>
        </body>
      </html>
    `;

    // Check approval requirements (policy-driven; same as confirm-data)
    const totalAmount = effectiveTotalAmount;
    const companyId = poRequisition.vessel?.companyId ?? quote.requisition.vessel?.company?.id ?? null;
    const poPolicy = await getPoApprovalPolicy(companyId, poRequisition.vesselId);
    const requiresApproval = totalAmount >= poPolicy.thresholdLevel2;
    const requiresThreeApprovals = totalAmount >= poPolicy.thresholdLevel3;

    // Check if PO exists and get approval status
    let existingPO = await prisma.purchaseOrder.findUnique({
      where: { poNumber },
    });

    if (!existingPO) {
      existingPO = await prisma.purchaseOrder.findFirst({
        where: splitContext
          ? { quoteId: quote.id, requisitionId: splitContext.childRequisitionId }
          : { quoteId: quote.id },
      });
    }

    // If approval is required, check if all approvals are done
    if (requiresApproval && existingPO) {
      const poWithApprovals = await prisma.purchaseOrder.findUnique({
        where: { id: existingPO.id },
        include: {
          levelOneApprover: true,
          levelTwoApprover: true,
          levelThreeApprover: true,
        },
      });

      if (requiresThreeApprovals) {
        if (!poWithApprovals?.levelOneApprovedAt || !poWithApprovals?.levelTwoApprovedAt || !poWithApprovals?.levelThreeApprovedAt) {
          return NextResponse.json(
            { 
              error: 'All three approval levels must be completed before sending PO',
              requiresApproval: true,
              approvalStatus: {
                levelOne: !!poWithApprovals?.levelOneApprovedAt,
                levelTwo: !!poWithApprovals?.levelTwoApprovedAt,
                levelThree: !!poWithApprovals?.levelThreeApprovedAt,
              },
            },
            { status: 400 }
          );
        }
      } else {
        if (!poWithApprovals?.levelOneApprovedAt || !poWithApprovals?.levelTwoApprovedAt) {
          return NextResponse.json(
            { 
              error: 'Both approval levels must be completed before sending PO',
              requiresApproval: true,
              approvalStatus: {
                levelOne: !!poWithApprovals?.levelOneApprovedAt,
                levelTwo: !!poWithApprovals?.levelTwoApprovedAt,
              },
            },
            { status: 400 }
          );
        }
      }
    }

    const currentWorkflow =
      existingPO?.workflowStatus ??
      (existingPO
        ? resolveWorkflowStatusAfterApproval(existingPO, totalAmount, poPolicy)
        : resolveWorkflowStatusOnCreate(totalAmount, poPolicy));

    if (currentWorkflow === PurchaseOrderWorkflowStatus.PO_SENT) {
      return NextResponse.json(
        { error: 'Purchase Order has already been sent to the vendor' },
        { status: 400 }
      );
    }

    if (currentWorkflow !== PurchaseOrderWorkflowStatus.PO_CONFIRMED) {
      return NextResponse.json(
        {
          error: 'Purchase Order must complete all approvals before sending to vendor',
          workflowStatus: currentWorkflow,
          requiresApproval,
        },
        { status: 400 }
      );
    }

    // Create or update PO record
    errorStep = 'Create/Update PO Record';
    console.log(`🔵 [CONFIRM QUOTE] Creating/updating PO record...`);
    
    if (!existingPO) {
      existingPO = await prisma.purchaseOrder.create({
        data: {
          poNumber: poNumber!,
          requisitionId: poRequisition.id,
          quoteId: quote.id,
          vesselId: poRequisition.vesselId,
          vesselName: poRequisition.vessel?.name || 'Unknown Vessel', // Store vessel name directly
          parentRequisitionId: splitContext?.parentRequisitionId ?? undefined,
          dateOfIssue: dateOfIssue,
          originalPdfUrl: uploadResult.publicUrl,
          totalAmount: quoteForPo.totalAmount,
          currency: quote.currency,
          status: 'ACTIVE',
          workflowStatus: PurchaseOrderWorkflowStatus.PO_CONFIRMED,
          isBudgeted: isBudgetedForPo,
          budgetCode: poRequisition.budgetCode ?? undefined,
        },
      });
      await prisma.requisition.update({
        where: { id: poRequisition.id },
        data: { isBudgeted: isBudgetedForPo },
      });
      console.log(`✅ [CONFIRM QUOTE] PO record created: ${existingPO.id}`);
    } else {
      // Update existing PO with new PDF URL if different
      existingPO = await prisma.purchaseOrder.update({
        where: { id: existingPO.id },
        data: {
          originalPdfUrl: uploadResult.publicUrl,
          isBudgeted: isBudgetedForPo,
        },
      });
      await prisma.requisition.update({
        where: { id: poRequisition.id },
        data: { isBudgeted: isBudgetedForPo },
      });
      console.log(`✅ [CONFIRM QUOTE] PO record updated: ${existingPO.id}`);
    }

    errorStep = 'Send Email';
    console.log(`🔵 [CONFIRM QUOTE] Sending email to ${quote.vendor.primaryEmail} via Resend...`);

    if (!currentUser.email?.trim()) {
      return NextResponse.json(
        {
          error:
            'Your account must have an email address. PO emails always CC the sender.',
        },
        { status: 400 }
      );
    }

    const uniqueCcEmails = buildPurchaseOrderEmailCc({
      senderEmail: currentUser.email,
      additionalCc: body.ccEmails,
      vendorSecondaryEmail: quote.vendor.secondaryEmail,
    });

    const result = await sendPurchaseOrderEmail({
      to: quote.vendor.primaryEmail,
      cc: uniqueCcEmails,
      subject,
      html: htmlContent,
      text: `Purchase Order Confirmation\n\nPO Number: ${poNumber || 'TBD'}\nRequisition: ${poRequisition.requisitionNumber}\nTotal: ${quote.currency} ${effectiveTotalAmount.toLocaleString() || '0'}\n\n${customMessage || ''}`,
      attachments: [
        {
          filename: fileName,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    if (!result.messageId) {
      errorDetails = { 
        step: errorStep, 
        quoteId: id, 
        vendorEmail: quote.vendor.primaryEmail,
        message: 'Email send returned success but no message ID',
        result: result
      };
      console.error('❌ [CONFIRM QUOTE]', errorDetails);
      throw new Error('Email send returned success but no message ID.');
    }
    console.log(`✅ [CONFIRM QUOTE] Email sent successfully via Resend - Message ID: ${result.messageId}`);

    errorStep = 'Store Email';
    console.log(`🔵 [CONFIRM QUOTE] Storing email in database...`);
    
    // Store email
    try {
      await storeEmailMessage(result.messageId, 'PO_CONFIRMATION', poRequisition.id, quote.id);
      console.log(`✅ [CONFIRM QUOTE] Email stored in database`);
    } catch (storeError: any) {
      console.error('⚠️  [CONFIRM QUOTE] Error storing email (email was sent but not stored):', storeError);
      // Continue even if storage fails - email was sent successfully
    }

    errorStep = 'Update Requisition Status';
    console.log(`🔵 [CONFIRM QUOTE] Updating requisition status...`);
    
    const previousStatus = poRequisition.status;
    
    // Update requisition status and set isEditable to false (PO has been sent, cannot edit)
    const updatedRequisition = await prisma.requisition.update({
      where: { id: poRequisition.id },
      data: {
        status: RequisitionStatus.QUOTE_CONFIRMED_PO_SENT,
        isEditable: false, // PO has been sent, requisition cannot be edited
      },
    });
    console.log(`✅ [CONFIRM QUOTE] Requisition status updated from ${previousStatus} to QUOTE_CONFIRMED_PO_SENT`);

    await prisma.purchaseOrder.update({
      where: { id: existingPO.id },
      data: { workflowStatus: PurchaseOrderWorkflowStatus.PO_SENT },
    });

    errorStep = 'Record Purchase History';
    console.log(`🔵 [CONFIRM QUOTE] Recording purchase history...`);
    
    // Record purchase history
    try {
      await recordPurchaseHistory({
        requisitionId: poRequisition.id,
        actionType: PurchaseHistoryActionType.STATUS_CHANGED,
        performedById: currentUser.id,
        actionDescription: `Quote confirmed and PO sent to vendor ${quote.vendor.name}`,
        previousStatus: previousStatus,
        newStatus: RequisitionStatus.QUOTE_CONFIRMED_PO_SENT,
        newValue: {
          quoteId: id,
          vendorId: quote.vendor.id,
          vendorName: quote.vendor.name,
          totalAmount: quoteForPo.totalAmount,
          currency: quote.currency,
          poNumber: poNumber || 'TBD',
          emailId: result.messageId,
        },
        comments: customMessage || undefined,
      });
      console.log(`✅ [CONFIRM QUOTE] Purchase history recorded`);
    } catch (historyError: any) {
      console.error('⚠️  [CONFIRM QUOTE] Error recording purchase history (non-critical):', historyError);
      // Continue even if history recording fails
    }

    console.log(`✅ [CONFIRM QUOTE] Quote confirmation completed successfully`);
    await markTaskNotificationsAsRead(currentUser.id, id);
    return NextResponse.json({
      success: true,
      message: 'PO confirmation sent successfully',
      emailId: result.messageId,
      quoteId: id,
      requisitionId: poRequisition.id,
      previousStatus: previousStatus,
      newStatus: RequisitionStatus.QUOTE_CONFIRMED_PO_SENT,
    });
  } catch (error: any) {
    errorDetails = {
      step: errorStep,
      errorType: error.name || 'Unknown',
      errorMessage: error.message || 'Unknown error',
      errorStack: error.stack,
      quoteId: (await context.params).id,
    };
    
    console.error('❌ [CONFIRM QUOTE] Error at step:', errorStep);
    console.error('❌ [CONFIRM QUOTE] Error details:', errorDetails);
    console.error('❌ [CONFIRM QUOTE] Full error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to confirm quote',
        details: errorDetails,
        step: errorStep,
        message: error.message || 'Unknown error occurred',
        errorType: error.name || 'Error',
      },
      { status: 500 }
    );
  }
}





