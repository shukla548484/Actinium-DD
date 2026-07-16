import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecureRequestContext, sanitizeInput, validateUUID } from '@/lib/api-security';
import { prisma } from '@/lib/prisma';
import { generatePONumber, reservePONumber } from '@/lib/services/po-number-generator';
import { generatePOPDF } from '@/lib/services/po-pdf-generator';
import { getGoogleCloudStorageService } from '@/lib/google-cloud-storage';
import { getPoApprovalPolicy } from '@/lib/services/po-approval-policy.service';
import {
  notifyPoApprovalPending,
} from '@/lib/procurement/approval-notifications';
import { recordPurchaseHistory, PurchaseHistoryActionType } from '@/lib/services/purchase-history.service';
import { checkPoBudget } from '@/lib/services/po-budget-check.service';
import { resolveIsBudgetedForPoIssue } from '@/lib/procurement/requisition-budget-classification';
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import { canIssuePurchaseOrders, PURCHASER_PO_ACCESS_LEVELS } from '@/lib/procurement/purchaser-access';
import {
  poRequiresTierApproval,
  resolveWorkflowStatusOnCreate,
} from '@/lib/services/po-workflow-status.service';
import { PurchaseOrderWorkflowStatus } from '@/lib/types/purchase-order-workflow';
import { RequisitionStatus } from '@/lib/types/requisition';
import { purgeCancelledPurchaseOrdersForQuote, purgePurchaseOrderRecord } from '@/lib/procurement/purge-purchase-order';
import { markUnreadTasksReadByDedupeKey } from '@/lib/notifications/has-unread-task';

/**
 * POST /api/purchase-orders/create
 * Create and send Purchase Order
 * SECURITY: Protected by secureApiRoute - requires authentication and level 32, 33, or 50
 */
const handler = async (
  request: NextRequest,
  context: SecureRequestContext
) => {
  let errorStep = 'Initialization';
  let errorDetails: any = {};

  try {
    errorStep = 'Authentication';
    console.log('🔵 [CREATE PO] Starting Purchase Order creation...');

    // Check access level: 32, 33, or admin-equivalent (50 / 99 / 100)
    const userAccessLevel = context.user.designationAccessLevel || 0;
    if (!canIssuePurchaseOrders(userAccessLevel)) {
      errorDetails = {
        step: errorStep,
        userAccessLevel,
        allowedLevels: [...PURCHASER_PO_ACCESS_LEVELS],
        message: `Access level ${userAccessLevel} is not authorized to create Purchase Orders. Required: purchaser (32/33) or administrators`,
      };
      console.error('❌ [CREATE PO]', errorDetails);
      return NextResponse.json(
        {
          error: 'Insufficient permissions to create Purchase Orders',
          details: errorDetails,
          step: errorStep,
          userAccessLevel,
          requiredLevels: [...PURCHASER_PO_ACCESS_LEVELS],
        },
        { status: 403 }
      );
    }
    console.log(`✅ [CREATE PO] User authenticated: ${context.userId}, Access Level: ${userAccessLevel}`);

    errorStep = 'Parse Request';
    const body = await request.json();
    const cleanData = sanitizeInput(body);
    const {
      quoteId: quoteIdRaw,
      ccEmails = [],
      includeUserEmailInCc = true,
      userRemarks,
      vendorRemarks,
      conditions,
      leadTime,
      portOfDelivery,
      agentDetails,
      isBudgeted: isBudgetedRequest,
      revision: revisionRequest,
    } = cleanData;
    const replaceExistingPo = revisionRequest === true || revisionRequest === 'true';

    if (!quoteIdRaw) {
      errorDetails = { step: errorStep, message: 'Quote ID is required' };
      console.error('❌ [CREATE PO]', errorDetails);
      return NextResponse.json({ error: 'Quote ID is required', details: errorDetails, step: errorStep }, { status: 400 });
    }
    
    // Validate quoteId is a valid UUID
    const quoteId = validateUUID(quoteIdRaw, 'Quote ID');
    if (!quoteId) {
      errorDetails = { step: errorStep, message: 'Invalid Quote ID format' };
      return NextResponse.json({ error: 'Invalid Quote ID', details: errorDetails, step: errorStep }, { status: 400 });
    }

    errorStep = 'Fetch Quote and Requisition';
    console.log(`🔵 [CREATE PO] Fetching quote ${quoteId}...`);

    const quote = await prisma.vendorQuote.findUnique({
      where: { id: quoteId },
      include: {
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
        vendor: true,
        quotedItems: {
          orderBy: {
            itemName: 'asc',
          },
        },
      },
    });

    if (!quote) {
      errorDetails = { step: errorStep, quoteId, message: 'Quote not found' };
      console.error('❌ [CREATE PO]', errorDetails);
      return NextResponse.json({ error: 'Quote not found', details: errorDetails, step: errorStep }, { status: 404 });
    }

    // Validate vessel access
    if (quote.requisition?.vessel?.companyId) {
      if (!isAdminEquivalentAccessLevel(context.user.designationAccessLevel)) {
        const hasVesselAccess = context.user.assignedVessels?.some((v: any) => v.vessel?.id === quote.requisition.vesselId);
        if (!hasVesselAccess && quote.requisition.vessel.companyId !== context.companyId) {
          errorDetails = { step: errorStep, message: 'Access denied to vessel' };
          return NextResponse.json(
            { error: 'Access denied to vessel', details: errorDetails, step: errorStep },
            { status: 403 }
          );
        }
      }
    }

    if (quote.status !== 'APPROVED') {
      errorDetails = {
        step: errorStep,
        quoteId,
        currentStatus: quote.status,
        requiredStatus: 'APPROVED',
        message: 'Quote must be APPROVED to create Purchase Order',
      };
      console.error('❌ [CREATE PO]', errorDetails);
      return NextResponse.json(
        {
          error: 'Quote must be APPROVED to create Purchase Order',
          details: errorDetails,
          step: errorStep,
          currentStatus: quote.status,
        },
        { status: 400 }
      );
    }

    if (quote.requisition.status !== RequisitionStatus.QUOTE_APPROVED) {
      errorDetails = {
        step: errorStep,
        requisitionId: quote.requisitionId,
        currentStatus: quote.requisition.status,
        requiredStatus: RequisitionStatus.QUOTE_APPROVED,
        message: 'Requisition must be in QUOTE_APPROVED status before issuing PO',
      };
      console.error('❌ [CREATE PO]', errorDetails);
      return NextResponse.json(
        {
          error: 'Requisition must be quote-approved before creating Purchase Order',
          details: errorDetails,
          step: errorStep,
          currentStatus: quote.requisition.status,
        },
        { status: 400 }
      );
    }

    // Remove cancelled/orphan rows first so they cannot race with a new issue.
    await purgeCancelledPurchaseOrdersForQuote({
      quoteId: quote.id,
      requisitionId: quote.requisitionId,
      performedById: context.userId,
      reason: 'Auto-cleanup of cancelled purchase order before re-issue',
    });

    // Block on ANY remaining PO for this quote+requisition (not only ACTIVE).
    // Reject used to leave CANCELLED rows briefly; ACTIVE-only checks allowed duplicates.
    const existingPo = await prisma.purchaseOrder.findFirst({
      where: { quoteId: quote.id, requisitionId: quote.requisitionId },
      select: { id: true, poNumber: true, workflowStatus: true, status: true },
      orderBy: { createdAt: 'desc' },
    });
    if (existingPo) {
      if (replaceExistingPo) {
        const workflow =
          existingPo.workflowStatus ?? PurchaseOrderWorkflowStatus.PO_CREATED;
        if (workflow === PurchaseOrderWorkflowStatus.PO_SENT) {
          return NextResponse.json(
            {
              error: 'Purchase orders that have been sent to the vendor cannot be replaced',
              poId: existingPo.id,
              poNumber: existingPo.poNumber,
              step: errorStep,
            },
            { status: 400 }
          );
        }
        try {
          await purgePurchaseOrderRecord({
            purchaseOrderId: existingPo.id,
            performedById: context.userId,
            reason: userRemarks?.trim() || 'Replaced after PO rejection for revision',
            reconcileRequisition: true,
            allowAlreadyCancelled: true,
          });
        } catch (purgeError: unknown) {
          const message =
            purgeError instanceof Error ? purgeError.message : 'Failed to remove rejected PO';
          return NextResponse.json(
            {
              error: 'Could not replace the rejected purchase order',
              details: message,
              step: errorStep,
            },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          {
            error: 'A purchase order already exists for this quote',
            poId: existingPo.id,
            poNumber: existingPo.poNumber,
            step: errorStep,
          },
          { status: 400 }
        );
      }
    }

    const leftoverPo = await prisma.purchaseOrder.findFirst({
      where: { quoteId: quote.id, requisitionId: quote.requisitionId },
      select: { id: true, poNumber: true },
    });
    if (leftoverPo) {
      return NextResponse.json(
        {
          error: 'A purchase order already exists for this quote',
          poId: leftoverPo.id,
          poNumber: leftoverPo.poNumber,
          step: errorStep,
        },
        { status: 400 }
      );
    }

    console.log(`✅ [CREATE PO] Quote and requisition validated`);

    const isBudgetedForPo = resolveIsBudgetedForPoIssue({
      requested: isBudgetedRequest,
      requisitionIsBudgeted: quote.requisition.isBudgeted,
      budgetCode: quote.requisition.budgetCode,
    });

    errorStep = 'Generate PO Number';
    console.log(`🔵 [CREATE PO] Generating PO number...`);

    const poNumber = await generatePONumber(quote.requisition.vesselId, quote.requisition.requisitionType);
    console.log(`✅ [CREATE PO] PO Number generated: ${poNumber}`);

    errorStep = 'Generate PDF';
    console.log(`🔵 [CREATE PO] Generating Purchase Order PDF...`);

    const dateOfIssue = new Date();
    const pdfBuffer = await generatePOPDF({
      poNumber,
      dateOfIssue,
      requisition: quote.requisition,
      quote: quote as any,
      userRemarks,
      vendorRemarks,
      conditions,
      leadTime,
      portOfDelivery,
      agentDetails,
    });

    console.log(`✅ [CREATE PO] PDF generated (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);

    errorStep = 'Upload PDF to GCS';
    console.log(`🔵 [CREATE PO] Uploading PDF to Google Cloud Storage...`);

    const gcs = getGoogleCloudStorageService();
    const fileName = `PO_${poNumber}_${quote.requisition.vessel.code || 'UNKNOWN'}_${dateOfIssue.toISOString().split('T')[0]}.pdf`;
    const uploadResult = await gcs.uploadFile(pdfBuffer, fileName, 'application/pdf', {
      vesselId: quote.requisition.vesselId,
      category: 'purchase-orders' as any,
    });

    console.log(`✅ [CREATE PO] PDF uploaded to GCS: ${uploadResult.publicUrl}`);

    errorStep = 'Reserve PO Number';
    await reservePONumber(quote.requisition.vesselId, quote.requisition.requisitionType, poNumber, context.userId);

    errorStep = 'Determine Workflow';
    const totalAmount = quote.totalAmount ? Number(quote.totalAmount) : 0;
    const companyId = quote.requisition.vessel?.companyId ?? null;
    const vesselId = quote.requisition.vesselId ?? null;
    const policy = await getPoApprovalPolicy(companyId, vesselId);
    const requiresApproval = poRequiresTierApproval(totalAmount, policy);
    const workflowStatus = resolveWorkflowStatusOnCreate(totalAmount, policy);

    errorStep = 'Create Purchase Order Record';
    let purchaseOrderId: string | null = null;
    try {
      const purchaseOrder = await prisma.purchaseOrder.create({
        data: {
          poNumber,
          requisitionId: quote.requisitionId,
          quoteId: quote.id,
          vesselId: quote.requisition.vesselId,
          vesselName: quote.requisition.vessel?.name || 'Unknown Vessel',
          dateOfIssue,
          originalPdfUrl: uploadResult.publicUrl,
          totalAmount: quote.totalAmount,
          currency: quote.currency,
          status: 'ACTIVE',
          workflowStatus,
          completionStatus: 'OPEN',
          isBudgeted: isBudgetedForPo,
          budgetCode: quote.requisition.budgetCode ?? undefined,
        },
      });
      purchaseOrderId = purchaseOrder.id;
      console.log(`✅ [CREATE PO] Purchase Order record created (workflow: ${workflowStatus})`);

      try {
        await prisma.purchaseOrderHistory.create({
          data: {
            purchaseOrderId: purchaseOrder.id,
            actionType: 'CREATED',
            actionDescription: `Purchase Order ${poNumber} created (awaiting L1 approval)`,
            newStatus: workflowStatus,
            newValue: JSON.stringify({
              poNumber,
              totalAmount: quote.totalAmount,
              currency: quote.currency,
              pdfUrl: uploadResult.publicUrl,
              workflowStatus,
            }),
            comments: userRemarks || undefined,
            performedById: context.userId,
          },
        });
      } catch (historyError: unknown) {
        console.error('⚠️  [CREATE PO] Error recording PO history (non-critical):', historyError);
      }
    } catch (poError: unknown) {
      console.error('❌ [CREATE PO] Error creating Purchase Order record:', poError);
      throw poError;
    }

    errorStep = 'Update Requisition Budget';
    await prisma.requisition.update({
      where: { id: quote.requisitionId },
      data: { isBudgeted: isBudgetedForPo },
    });

    errorStep = 'Record Purchase History';
    try {
      await recordPurchaseHistory({
        requisitionId: quote.requisitionId,
        actionType: PurchaseHistoryActionType.STATUS_CHANGED,
        performedById: context.userId,
        actionDescription: `Purchase Order ${poNumber} created for vendor ${quote.vendor.name}`,
        previousStatus: quote.requisition.status,
        newStatus: quote.requisition.status,
        newValue: {
          poNumber,
          quoteId: quote.id,
          vendorId: quote.vendor.id,
          vendorName: quote.vendor.name,
          totalAmount: quote.totalAmount,
          currency: quote.currency,
          pdfUrl: uploadResult.publicUrl,
          workflowStatus,
          dateOfIssue: dateOfIssue.toISOString(),
        },
        comments: userRemarks || undefined,
      });
    } catch (historyError: unknown) {
      console.error('⚠️  [CREATE PO] Error recording purchase history (non-critical):', historyError);
    }

    errorStep = 'Notify Approvers';
    try {
      if (purchaseOrderId) {
        await notifyPoApprovalPending({
          request,
          actorUserId: context.userId,
          vesselId,
          companyId,
          requisitionNumber: quote.requisition.requisitionNumber,
          purchaseOrderNumber: poNumber,
          quoteId: quote.id,
          poId: purchaseOrderId,
          approvalLevel: 1,
          targetAccessLevels: policy.level1AccessLevels,
          metadata: {
            totalAmount: quote.totalAmount,
            currency: quote.currency,
          },
        });
      }
    } catch (activityError: unknown) {
      console.error('⚠️  [CREATE PO] Error sending notification (non-critical):', activityError);
    }

    console.log(`✅ [CREATE PO] Purchase Order creation completed successfully`);

    if (replaceExistingPo) {
      try {
        await markUnreadTasksReadByDedupeKey({
          operation: 'PO_RETURNED_FOR_REVISION',
          dedupeKey: `quote:${quote.id}:po_revision`,
          userIds: [context.userId],
        });
      } catch (markReadErr) {
        console.error('⚠️  [CREATE PO] Could not mark revision task read:', markReadErr);
      }
    }

    let budgetWarning: string | undefined;
    if (quote.requisition?.vesselId && quote.totalAmount) {
      const budgetCheck = await checkPoBudget(
        quote.requisition.vesselId,
        Number(quote.totalAmount),
        dateOfIssue.getFullYear(),
        quote.requisition.budgetCode,
        { poBudgetCode: quote.requisition.budgetCode }
      );
      if (budgetCheck && (budgetCheck.blockRecommended || !budgetCheck.withinBudget)) {
        budgetWarning = budgetCheck.message;
      }
    }

    const readyToSend = workflowStatus === PurchaseOrderWorkflowStatus.PO_CONFIRMED;

    return NextResponse.json({
      success: true,
      message: readyToSend
        ? 'Purchase Order created — ready to send to vendor'
        : 'Purchase Order created — awaiting tier approval',
      poNumber,
      poId: purchaseOrderId,
      pdfUrl: uploadResult.publicUrl,
      workflowStatus,
      readyToSend,
      quoteId: quote.id,
      requisitionId: quote.requisitionId,
      ...(budgetWarning && { budgetWarning }),
    });
  } catch (error: any) {
    errorDetails = {
      step: errorStep,
      errorType: error.name || 'Unknown',
      errorMessage: error.message || 'Unknown error',
      errorStack: error.stack,
    };

    console.error('❌ [CREATE PO] Error at step:', errorStep);
    console.error('❌ [CREATE PO] Error details:', errorDetails);
    console.error('❌ [CREATE PO] Full error:', error);

    return NextResponse.json(
      {
        error: 'Failed to create Purchase Order',
        details: errorDetails,
        step: errorStep,
        message: error.message || 'Unknown error occurred',
        errorType: error.name || 'Error',
      },
      { status: 500 }
    );
  }
};

// Export with security wrapper
export const POST = secureApiRoute(handler, {
  requireAuth: true,
  allowedMethods: ['POST'],
  minAccessLevel: 32, // Require level 32, 33, or 50 (checked in handler)
});

