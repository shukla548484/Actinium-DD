import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { resolveSplitContextForQuoteConfirm } from '@/lib/procurement/split-child-confirm-context';
import { getPoApprovalPolicy } from '@/lib/services/po-approval-policy.service';
import {
  approvalLevelForWorkflowStatus,
  rejectAccessLevelsForWorkflow,
  resolveWorkflowStatusAfterApproval,
  resolveWorkflowStatusAfterReject,
} from '@/lib/services/po-workflow-status.service';
import { PurchaseOrderWorkflowStatus, poWorkflowStatusLabel } from '@/lib/types/purchase-order-workflow';
import { RequisitionStatus } from '@/lib/types/requisition';
import { quoteCreatePoPath } from '@/lib/procurement/quote-po-navigation';
import { buildPoConfirmWorkflowSteps } from '@/lib/procurement/po-confirm-workflow-steps';
import {
  canAccessPoConfirmData,
  canSendPoToVendor,
  canUserApprovePendingPoLevel,
  poConfirmAccessMode,
  resolvePendingPoApprovalLevel,
} from '@/lib/procurement/po-confirm-access';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ApprovalStatus {
  level: number;
  status: 'PENDING' | 'APPROVED' | 'NOT_REQUIRED';
  approverName?: string;
  approvedAt?: string;
}

/**
 * GET /api/quotes/[id]/confirm-data - Get quote data for confirmation page
 * This endpoint generates PO number and PDF, and returns approval status
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  let quoteId: string | null = null;
  
  try {
    console.log('🔵 [CONFIRM-DATA] Starting confirm-data request...');
    
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      console.error('❌ [CONFIRM-DATA] User not authenticated');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`✅ [CONFIRM-DATA] User authenticated: ${currentUser.id}, Access Level: ${currentUser.designationAccessLevel}`);

    const userAccessLevel = currentUser.designationAccessLevel || 0;

    // Get quote ID from params
    try {
      const params = await context.params;
      quoteId = params.id;
      console.log(`✅ [CONFIRM-DATA] Quote ID extracted: ${quoteId}`);
    } catch (paramsError: any) {
      console.error('❌ [CONFIRM-DATA] Error extracting params:', paramsError);
      return NextResponse.json(
        { error: 'Failed to extract quote ID from request', details: paramsError.message },
        { status: 400 }
      );
    }
    
    if (!quoteId) {
      console.error('❌ [CONFIRM-DATA] Quote ID is missing');
      return NextResponse.json(
        { error: 'Quote ID is required' },
        { status: 400 }
      );
    }

    // Get quote
    console.log(`🔵 [CONFIRM-DATA] Fetching quote: ${quoteId}`);
    const quote = await prisma.vendorQuote.findUnique({
      where: { id: quoteId },
      include: {
        requisition: {
          include: {
            vessel: {
              select: {
                id: true,
                name: true,
                code: true,
                companyId: true,
              },
            },
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        vendor: {
          select: {
            id: true,
            name: true,
            primaryEmail: true,
            secondaryEmail: true,
          },
        },
        quotedItems: true,
      },
    });

    if (!quote) {
      console.error(`❌ [CONFIRM-DATA] Quote not found: ${quoteId}`);
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }
    
    console.log(`✅ [CONFIRM-DATA] Quote found - Status: ${quote.status}, Requisition: ${quote.requisitionId}`);

    if (!quote.requisition) {
      console.error(`❌ [CONFIRM-DATA] Requisition not found for quote: ${quoteId}`);
      return NextResponse.json({ error: 'Requisition not found for this quote' }, { status: 404 });
    }

    if (!quote.requisition.vessel) {
      console.error(`❌ [CONFIRM-DATA] Vessel not found for requisition: ${quote.requisitionId}`);
      return NextResponse.json({ error: 'Vessel not found for this requisition' }, { status: 404 });
    }

    if (quote.status !== 'APPROVED') {
      console.error(`❌ [CONFIRM-DATA] Quote status is ${quote.status}, expected APPROVED`);
      return NextResponse.json(
        { error: 'Only approved quotes can be confirmed' },
        { status: 400 }
      );
    }

    const childRequisitionIdParam = request.nextUrl.searchParams.get('childRequisitionId')?.trim() || null;

    const existingPO = await prisma.purchaseOrder.findFirst({
      where: childRequisitionIdParam
        ? { quoteId: quote.id, requisitionId: childRequisitionIdParam, status: 'ACTIVE' }
        : { quoteId: quote.id, status: 'ACTIVE' },
      include: {
        levelOneApprover: true,
        levelTwoApprover: true,
        levelThreeApprover: true,
      },
    });

    const effectiveChildRequisitionId =
      childRequisitionIdParam ?? existingPO?.requisitionId ?? null;
    const splitContext = await resolveSplitContextForQuoteConfirm(
      quoteId,
      effectiveChildRequisitionId
    );

    if (childRequisitionIdParam && !splitContext) {
      return NextResponse.json(
        { error: 'Split allocation not found for this child requisition and quote' },
        { status: 404 }
      );
    }

    const poRequisition = splitContext?.childRequisition ?? quote.requisition;
    const quoteForPo = splitContext?.quoteForPo ?? quote;
    const vesselForPo =
      poRequisition.vessel ?? splitContext?.parentRequisition.vessel ?? quote.requisition.vessel;

    if (!vesselForPo) {
      return NextResponse.json({ error: 'Vessel not found for this requisition' }, { status: 404 });
    }

    if (!canAccessPoConfirmData(userAccessLevel, { poExists: !!existingPO })) {
      const message = existingPO
        ? `Access level ${userAccessLevel} is not authorized to approve this purchase order`
        : `Access level ${userAccessLevel} is not authorized to create or send purchase orders. Required: purchaser (32/33)`;
      console.error(`❌ [CONFIRM-DATA] Access denied - User level: ${userAccessLevel}, poExists: ${!!existingPO}`);
      return NextResponse.json(
        {
          error: 'Insufficient permissions to confirm quotes',
          message,
        },
        { status: 403 }
      );
    }

    const accessMode = poConfirmAccessMode(userAccessLevel, { poExists: !!existingPO });
    const canSendToVendor = canSendPoToVendor(userAccessLevel);

    console.log(`✅ [CONFIRM-DATA] Quote validated - ID: ${quote.id}, Status: ${quote.status}, Vessel: ${vesselForPo?.name}`);

    const totalAmount = splitContext?.effectiveTotalAmount ?? (quote.totalAmount ? Number(quote.totalAmount) : 0);
    const companyId = vesselForPo?.companyId ?? null;
    const poPolicy = await getPoApprovalPolicy(companyId, poRequisition.vesselId);
    const requiresApproval = totalAmount >= poPolicy.thresholdLevel2;
    const requiresThreeApprovals = totalAmount >= poPolicy.thresholdLevel3;

    const requisitionItems =
      splitContext?.childRequisition.items ??
      (await prisma.requisitionItem.findMany({
        where: { requisitionId: poRequisition.id },
        orderBy: { createdAt: 'asc' },
      }));

    const lineItems = requisitionItems
      .map((item, index) => {
        const quoted =
          quoteForPo.quotedItems.find((q) => q.requisitionItemId === item.id) ??
          quoteForPo.quotedItems.find(
            (q) =>
              q.itemName?.toLowerCase().trim() === item.itemName?.toLowerCase().trim()
          ) ??
          quoteForPo.quotedItems[index];
        const quantity =
          quoted?.quantity != null ? Number(quoted.quantity) : Number(item.quantity);
        const unitPrice = quoted?.unitPrice != null ? Number(quoted.unitPrice) : null;
        const totalPrice = quoted?.totalPrice != null ? Number(quoted.totalPrice) : null;

        return {
          lineNumber: index + 1,
          itemName: item.itemName,
          description: item.description,
          quantity,
          unit: item.unit,
          unitPrice,
          totalPrice,
          impaNumber: item.impaNumber ?? item.partNumber ?? null,
        };
      })
      .filter((line) => line.quantity > 0 || (line.totalPrice ?? 0) > 0);

    const quoteDataPayload = {
      quoteId: quote.id,
      requisitionId: poRequisition.id,
      requisitionNumber: poRequisition.requisitionNumber,
      heading: poRequisition.heading,
      budgetCode: poRequisition.budgetCode,
      isBudgeted: poRequisition.isBudgeted,
      vessel: {
        id: vesselForPo!.id,
        name: vesselForPo!.name,
        code: vesselForPo!.code,
      },
      quote: {
        id: quote.id,
        totalAmount: quoteForPo.totalAmount,
        currency: quote.currency,
        vendor: {
          id: quote.vendor.id,
          name: quote.vendor.name,
          primaryEmail: quote.vendor.primaryEmail,
          secondaryEmail: quote.vendor.secondaryEmail,
        },
      },
      isSplitChild: !!splitContext,
      parentRequisitionId: splitContext?.parentRequisitionId ?? null,
      lineItems,
    };

    if (!existingPO) {
      console.log(`ℹ️ [CONFIRM-DATA] No PO yet for quote ${quoteId} — purchaser must create PO first`);
      return NextResponse.json({
        success: true,
        poExists: false,
        quoteData: quoteDataPayload,
        poNumber: null,
        poId: null,
        pdfUrl: null,
        workflowStatus: null,
        readyToSend: false,
        approvalStatus: [],
        requiresApproval,
        requiresThreeApprovals,
        createPoPath: quoteCreatePoPath(quote.id, {
          from: request.nextUrl.searchParams.get('from') === 'notification' ? 'notification' : undefined,
          childRequisitionId: childRequisitionIdParam,
          revision:
            poRequisition.status === RequisitionStatus.QUOTE_APPROVED ? true : undefined,
        }),
        accessMode,
        canSendToVendor,
      });
    }

    const poNumber = existingPO.poNumber;
    const pdfUrl = existingPO.originalPdfUrl ?? null;

    const inferredWorkflow =
      existingPO.workflowStatus ??
      resolveWorkflowStatusAfterApproval(existingPO, totalAmount, poPolicy);

    let approvalStatus: ApprovalStatus[] = [];

    const l1Approved = Boolean(existingPO?.levelOneApprovedAt);
    approvalStatus.push({
      level: 1,
      status: l1Approved ? 'APPROVED' : 'PENDING',
      approverName: existingPO?.levelOneApprover
        ? `${existingPO.levelOneApprover.firstName} ${existingPO.levelOneApprover.lastName}`
        : undefined,
      approvedAt: existingPO?.levelOneApprovedAt?.toISOString(),
    });

    if (requiresApproval) {
      if (requiresThreeApprovals) {
        approvalStatus.push(
          {
            level: 2,
            status: existingPO?.levelTwoApprovedAt
              ? 'APPROVED'
              : l1Approved
                ? 'PENDING'
                : 'NOT_REQUIRED',
            approverName: existingPO?.levelTwoApprover
              ? `${existingPO.levelTwoApprover.firstName} ${existingPO.levelTwoApprover.lastName}`
              : undefined,
            approvedAt: existingPO?.levelTwoApprovedAt?.toISOString(),
          },
          {
            level: 3,
            status: existingPO?.levelThreeApprovedAt
              ? 'APPROVED'
              : existingPO?.levelTwoApprovedAt
                ? 'PENDING'
                : 'NOT_REQUIRED',
            approverName: existingPO?.levelThreeApprover
              ? `${existingPO.levelThreeApprover.firstName} ${existingPO.levelThreeApprover.lastName}`
              : undefined,
            approvedAt: existingPO?.levelThreeApprovedAt?.toISOString(),
          }
        );
      } else {
        approvalStatus.push({
          level: 2,
          status: existingPO?.levelTwoApprovedAt
            ? 'APPROVED'
            : l1Approved
              ? 'PENDING'
              : 'NOT_REQUIRED',
          approverName: existingPO?.levelTwoApprover
            ? `${existingPO.levelTwoApprover.firstName} ${existingPO.levelTwoApprover.lastName}`
            : undefined,
          approvedAt: existingPO?.levelTwoApprovedAt?.toISOString(),
        });
      }
    }

    const readyToSend = inferredWorkflow === PurchaseOrderWorkflowStatus.PO_CONFIRMED;

    // Revision is only needed when there is no active PO (handled in the !existingPO branch above).
    // A PO in PO_CREATED / L1/L2 approval is valid — do not send purchasers back to Create PO.
    const needsPoRevision = false;

    const workflowSteps = await buildPoConfirmWorkflowSteps({
      requisitionId: poRequisition.id,
      quoteId: quote.id,
      poId: existingPO.id,
      poNumber,
      vendorName: quote.vendor.name,
      requiresApproval,
      requiresThreeApprovals,
      approvalStatus,
      workflowStatus: inferredWorkflow,
      readyToSend,
    });

    const pendingApprovalLevel = resolvePendingPoApprovalLevel(approvalStatus);
    const { canApprove: canApproveNow } = canUserApprovePendingPoLevel(
      userAccessLevel,
      approvalStatus,
      poPolicy
    );

    const rejectableLevel = approvalLevelForWorkflowStatus(inferredWorkflow);
    const canRejectNow =
      rejectableLevel != null &&
      rejectAccessLevelsForWorkflow(inferredWorkflow, poPolicy).includes(userAccessLevel) &&
      inferredWorkflow !== PurchaseOrderWorkflowStatus.PO_SENT &&
      inferredWorkflow !== PurchaseOrderWorkflowStatus.CANCELLED &&
      inferredWorkflow !== PurchaseOrderWorkflowStatus.PO_CONFIRMED;
    const rejectResult =
      canRejectNow && rejectableLevel
        ? resolveWorkflowStatusAfterReject(rejectableLevel)
        : null;
    const rejectTargetStatus = null;
    const rejectTargetStatusLabel = rejectResult?.removePo
      ? "Purchaser — revise and re-create PO"
      : null;

    return NextResponse.json({
      success: true,
      poExists: true,
      quoteData: quoteDataPayload,
      poNumber,
      poId: existingPO.id,
      pdfUrl,
      workflowStatus: inferredWorkflow,
      readyToSend,
      approvalStatus,
      requiresApproval,
      requiresThreeApprovals,
      workflowSteps,
      pendingApprovalLevel,
      canApproveNow,
      canRejectNow,
      rejectableLevel,
      rejectTargetStatus,
      rejectTargetStatusLabel,
      canReturnToQuoteSelection:
        inferredWorkflow !== PurchaseOrderWorkflowStatus.PO_SENT,
      needsPoRevision,
      revisionCreatePoPath: null,
      accessMode,
      canSendToVendor,
      sessionUserId: currentUser.id,
      userAccessLevel,
    });
  } catch (error: any) {
    console.error('❌ [CONFIRM-DATA] Error fetching confirm data:', error);
    console.error('❌ [CONFIRM-DATA] Error stack:', error.stack);
    console.error('❌ [CONFIRM-DATA] Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      quoteId: quoteId || 'unknown',
    });
    
    // Return more detailed error information
    const errorMessage = error.message || 'Unknown error occurred';
    const errorDetails = {
      error: 'Failed to fetch confirmation data',
      details: errorMessage,
      errorType: error.name || 'UnknownError',
      quoteId: quoteId || 'unknown',
    };
    
    // Only include stack in development
    if (process.env.NODE_ENV === 'development') {
      (errorDetails as any).stack = error.stack;
    }
    
    return NextResponse.json(
      errorDetails,
      { status: 500 }
    );
  }
}

