import { NextRequest, NextResponse } from 'next/server';
import {
  secureApiRoute,
  SecureRequestContext,
  validateUUID,
  sanitizeInput,
} from '@/lib/api-security';
import { validatePoResourceAccess } from '@/lib/procurement/po-resource-access';
import { prisma } from '@/lib/prisma';
import { markTaskNotificationsAsRead } from '@/lib/utils/mark-task-notifications-read';
import { getPoApprovalPolicy } from '@/lib/services/po-approval-policy.service';
import {
  notifyPoApprovalPending,
  notifyPoReadyToSend,
  resolveNextPoApproverLevels,
} from '@/lib/procurement/approval-notifications';
import { recordPoApprovalHistory } from '@/lib/procurement/record-procurement-history';
import {
  approvalLevelForWorkflowStatus,
  resolveWorkflowStatusAfterApproval,
} from '@/lib/services/po-workflow-status.service';
import { PurchaseOrderWorkflowStatus } from '@/lib/types/purchase-order-workflow';

/**
 * POST /api/purchase-orders/[id]/approve - Approve Purchase Order at a specific level
 * SECURITY: Protected by secureApiRoute - requires authentication
 * 
 * Approval Levels:
 * - Level 1: Access levels 37, 39, or 50 (for PO amounts >= $3,000)
 * - Level 2: Access levels 41, 44, or 50 (for PO amounts >= $3,000)
 * - Level 3: Access levels 46, 47, 48, or 50 (for PO amounts >= $10,000)
 * 
 * Approval Sequence:
 * - $3,000 - $10,000: Level 1 (37/39) -> Level 2 (41/44)
 * - >= $10,000: Level 1 (37/39) -> Level 2 (41/44) -> Level 3 (46/47/48)
 */
const handler = async (
  request: NextRequest,
  context: SecureRequestContext,
  params?: { id: string } | Promise<{ id: string }>
) => {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    if (!resolvedParams?.id) {
      return NextResponse.json(
        { error: 'Purchase order ID is required' },
        { status: 400 }
      );
    }
    
    const id = validateUUID(resolvedParams.id, 'Purchase Order ID');
    if (!id) {
      return NextResponse.json(
        { error: 'Invalid purchase order ID' },
        { status: 400 }
      );
    }
    
    const userAccessLevel = context.user.designationAccessLevel || 0;
    const body = await request.json();
    const cleanData = sanitizeInput(body);
    const { comments } = cleanData;

    // Get PO with vessel for access validation
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        requisition: {
          include: {
            vessel: {
              select: {
                id: true,
                companyId: true,
              },
            },
          },
        },
        quote: true,
        levelOneApprover: true,
        levelTwoApprover: true,
        levelThreeApprover: true,
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 });
    }
    
    const vessel = purchaseOrder.requisition?.vessel;
    if (vessel) {
      const hasAccess = await validatePoResourceAccess(context, vessel, id);

      if (!hasAccess) {
        return NextResponse.json(
          {
            error: 'Access denied',
            message:
              'You do not have access to approve POs for this vessel. Ask an administrator to assign you to the vessel or verify your company scope.',
          },
          { status: 403 }
        );
      }
    }

    const totalAmount = purchaseOrder.totalAmount ? Number(purchaseOrder.totalAmount) : 0;
    const companyId = purchaseOrder.requisition?.vessel?.companyId ?? null;
    const vesselId = purchaseOrder.requisition?.vesselId ?? null;
    const policy = await getPoApprovalPolicy(companyId, vesselId);

    const threshold2 = policy.thresholdLevel2;
    const threshold3 = policy.thresholdLevel3;
    const requiresApproval = totalAmount >= threshold2;
    const requiresThreeApprovals = totalAmount >= threshold3;
    const requiresTier2OrMore = requiresApproval;

    const workflowStatus =
      purchaseOrder.workflowStatus ?? PurchaseOrderWorkflowStatus.PO_CREATED;

    if (
      workflowStatus === PurchaseOrderWorkflowStatus.PO_SENT ||
      workflowStatus === PurchaseOrderWorkflowStatus.CANCELLED ||
      workflowStatus === PurchaseOrderWorkflowStatus.PO_CONFIRMED
    ) {
      return NextResponse.json(
        { error: 'This Purchase Order is not awaiting tier approval' },
        { status: 400 }
      );
    }

    const level1Levels = policy.level1AccessLevels;
    const level2Levels = policy.level2AccessLevels;
    const level3Levels = policy.level3AccessLevels;

    // Determine which approval level the user can perform
    let approvalLevel: 1 | 2 | 3 | null = null;

    if (level1Levels.includes(userAccessLevel) && !purchaseOrder.levelOneApprovedAt) {
      approvalLevel = 1;
    }
    if (requiresTier2OrMore) {
      if (level2Levels.includes(userAccessLevel) && purchaseOrder.levelOneApprovedAt && !purchaseOrder.levelTwoApprovedAt) {
        approvalLevel = 2;
      }
      if (level3Levels.includes(userAccessLevel) && requiresThreeApprovals && purchaseOrder.levelTwoApprovedAt && !purchaseOrder.levelThreeApprovedAt) {
        approvalLevel = 3;
      }
    }

    if (!approvalLevel) {
      // Admin (50, 99, 100) can approve any level
      if ([50, 99, 100].includes(userAccessLevel)) {
        if (!purchaseOrder.levelOneApprovedAt) approvalLevel = 1;
        else if (requiresTier2OrMore && !purchaseOrder.levelTwoApprovedAt) approvalLevel = 2;
        else if (requiresTier2OrMore && requiresThreeApprovals && !purchaseOrder.levelThreeApprovedAt) approvalLevel = 3;
      }

      if (!approvalLevel) {
        return NextResponse.json(
          { 
            error: 'You cannot approve this Purchase Order at this time',
            message: 'Either you do not have the required access level, or the previous approval level has not been completed yet.',
            currentApprovalStatus: {
              levelOne: !!purchaseOrder.levelOneApprovedAt,
              levelTwo: !!purchaseOrder.levelTwoApprovedAt,
              levelThree: !!purchaseOrder.levelThreeApprovedAt,
            },
            userAccessLevel,
          },
          { status: 403 }
        );
      }
    }

    const activeLevel = approvalLevelForWorkflowStatus(workflowStatus);
    if (activeLevel !== null && activeLevel !== approvalLevel) {
      return NextResponse.json(
        {
          error: 'Approval level does not match the current workflow stage',
          workflowStatus,
          attemptedLevel: approvalLevel,
        },
        { status: 400 }
      );
    }

    // Update PO with approval
    const now = new Date();
    const updateData: Record<string, unknown> = {};

    if (approvalLevel === 1) {
      updateData.levelOneApprovedAt = now;
      updateData.levelOneApprovedBy = context.userId;
    } else if (approvalLevel === 2) {
      updateData.levelTwoApprovedAt = now;
      updateData.levelTwoApprovedBy = context.userId;
    } else if (approvalLevel === 3) {
      updateData.levelThreeApprovedAt = now;
      updateData.levelThreeApprovedBy = context.userId;
    }

    const projectedTiers = {
      levelOneApprovedAt:
        approvalLevel === 1 ? now : purchaseOrder.levelOneApprovedAt,
      levelTwoApprovedAt:
        approvalLevel === 2 ? now : purchaseOrder.levelTwoApprovedAt,
      levelThreeApprovedAt:
        approvalLevel === 3 ? now : purchaseOrder.levelThreeApprovedAt,
    };
    updateData.workflowStatus = resolveWorkflowStatusAfterApproval(
      projectedTiers,
      totalAmount,
      policy
    );

    const updatedPO = await prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: {
        levelOneApprover: true,
        levelTwoApprover: true,
        levelThreeApprover: true,
      },
    });

    const allApprovalsComplete = requiresThreeApprovals
      ? !!updatedPO.levelOneApprovedAt &&
        !!updatedPO.levelTwoApprovedAt &&
        !!updatedPO.levelThreeApprovedAt
      : !!updatedPO.levelOneApprovedAt && !!updatedPO.levelTwoApprovedAt;

    try {
      await recordPoApprovalHistory({
        purchaseOrderId: id,
        requisitionId: purchaseOrder.requisitionId,
        performedById: context.userId,
        poNumber: purchaseOrder.poNumber,
        approvalLevel,
        comments: comments || undefined,
        allApprovalsComplete,
      });
    } catch (historyError: unknown) {
      console.error('Error recording PO approval history:', historyError);
    }

    // Notify next approver tier or purchaser when complete
    try {
      const notifyCtx = {
        request,
        actorUserId: context.userId,
        vesselId: purchaseOrder.requisition?.vesselId,
        companyId: purchaseOrder.requisition?.vessel?.companyId,
        requisitionNumber: purchaseOrder.requisition?.requisitionNumber,
        purchaseOrderNumber: purchaseOrder.poNumber,
        quoteId: purchaseOrder.quoteId ?? undefined,
        poId: id,
        metadata: {
          approvedLevel: approvalLevel,
          totalAmount: purchaseOrder.totalAmount,
          currency: purchaseOrder.currency,
        },
      };

      if (allApprovalsComplete) {
        await notifyPoReadyToSend(notifyCtx);
      } else {
        const nextLevels = resolveNextPoApproverLevels(policy, updatedPO, requiresThreeApprovals);
        if (nextLevels.length > 0) {
          const nextLevelNum = !updatedPO.levelOneApprovedAt
            ? 1
            : !updatedPO.levelTwoApprovedAt
              ? 2
              : 3;
          await notifyPoApprovalPending({
            ...notifyCtx,
            approvalLevel: nextLevelNum as 1 | 2 | 3,
            targetAccessLevels: nextLevels,
          });
        }
      }
    } catch (activityError: unknown) {
      console.error('Error sending PO approval notification:', activityError);
    }

    await markTaskNotificationsAsRead(context.userId, purchaseOrder.poNumber || id);
    return NextResponse.json({
      success: true,
      message: `Purchase Order approved at Level ${approvalLevel}`,
      purchaseOrder: updatedPO,
      approvalLevel,
      allApprovalsComplete: requiresThreeApprovals
        ? !!updatedPO.levelOneApprovedAt && !!updatedPO.levelTwoApprovedAt && !!updatedPO.levelThreeApprovedAt
        : !!updatedPO.levelOneApprovedAt && !!updatedPO.levelTwoApprovedAt,
    });
  } catch (error: any) {
    console.error('Error approving Purchase Order:', error);
    return NextResponse.json(
      { error: 'Failed to approve Purchase Order', details: error.message },
      { status: 500 }
    );
  }
};

// Export with security wrapper (Next.js 15 compatible)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  return secureApiRoute(
    (req, ctx) => handler(req, ctx, params),
    { requireAuth: true, allowedMethods: ['POST'], minAccessLevel: 37 } // Minimum level for approval
  )(request, { params });
}











