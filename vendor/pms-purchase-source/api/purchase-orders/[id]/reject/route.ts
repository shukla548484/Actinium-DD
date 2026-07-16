import { NextRequest, NextResponse } from "next/server";
import {
  secureApiRoute,
  SecureRequestContext,
  validateUUID,
  sanitizeInput,
} from "@/lib/api-security";
import { validatePoResourceAccess } from "@/lib/procurement/po-resource-access";
import { prisma } from "@/lib/prisma";
import { markTaskNotificationsAsRead } from "@/lib/utils/mark-task-notifications-read";
import { getPoApprovalPolicy } from "@/lib/services/po-approval-policy.service";
import {
  approvalLevelForWorkflowStatus,
  rejectAccessLevelsForWorkflow,
  resolveWorkflowStatusAfterReject,
} from "@/lib/services/po-workflow-status.service";
import { PurchaseOrderWorkflowStatus } from "@/lib/types/purchase-order-workflow";
import { notifyPoReturnedForRevision } from "@/lib/procurement/approval-notifications";
import { recordPoRejectionHistory } from "@/lib/procurement/record-procurement-history";
import { purgePurchaseOrderRecord } from "@/lib/procurement/purge-purchase-order";
import { clearPoApprovalPendingNotifications } from "@/lib/procurement/clear-po-approval-notifications";

/**
 * POST /api/purchase-orders/[id]/reject — Reject PO at current approval tier with comment.
 * Any rejection returns work to purchaser (access levels 32/33) to re-create the PO.
 */
const handler = async (
  request: NextRequest,
  context: SecureRequestContext,
  params?: { id: string } | Promise<{ id: string }>
) => {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    if (!resolvedParams?.id) {
      return NextResponse.json({ error: "Purchase order ID is required" }, { status: 400 });
    }

    const id = validateUUID(resolvedParams.id, "Purchase Order ID");
    if (!id) {
      return NextResponse.json({ error: "Invalid purchase order ID" }, { status: 400 });
    }

    const userAccessLevel = context.user.designationAccessLevel || 0;
    const body = await request.json();
    const cleanData = sanitizeInput(body);
    const comments = typeof cleanData.comments === "string" ? cleanData.comments.trim() : "";

    if (!comments) {
      return NextResponse.json(
        { error: "Comments are required when rejecting a Purchase Order" },
        { status: 400 }
      );
    }

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        requisition: {
          include: {
            vessel: { select: { id: true, companyId: true } },
          },
        },
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json({ error: "Purchase Order not found" }, { status: 404 });
    }

    const vessel = purchaseOrder.requisition?.vessel;
    if (vessel) {
      const hasAccess = await validatePoResourceAccess(context, vessel, id);
      if (!hasAccess) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const workflowStatus =
      purchaseOrder.workflowStatus ?? PurchaseOrderWorkflowStatus.PO_CREATED;

    if (
      workflowStatus === PurchaseOrderWorkflowStatus.PO_SENT ||
      workflowStatus === PurchaseOrderWorkflowStatus.CANCELLED ||
      workflowStatus === PurchaseOrderWorkflowStatus.PO_CONFIRMED
    ) {
      return NextResponse.json(
        { error: "This Purchase Order cannot be rejected at its current stage" },
        { status: 400 }
      );
    }

    const companyId = purchaseOrder.requisition?.vessel?.companyId ?? null;
    const vesselId = purchaseOrder.requisition?.vesselId ?? null;
    const policy = await getPoApprovalPolicy(companyId, vesselId);

    const rejectedLevel = approvalLevelForWorkflowStatus(workflowStatus);
    if (!rejectedLevel) {
      return NextResponse.json(
        { error: "No approval level is active for this Purchase Order" },
        { status: 400 }
      );
    }

    const allowedLevels = rejectAccessLevelsForWorkflow(workflowStatus, policy);
    if (!allowedLevels.includes(userAccessLevel)) {
      return NextResponse.json(
        {
          error: "You cannot reject this Purchase Order at this stage",
          userAccessLevel,
          workflowStatus,
        },
        { status: 403 }
      );
    }

    if (!purchaseOrder.quoteId) {
      return NextResponse.json(
        { error: "Purchase Order cannot be returned — no linked quote" },
        { status: 400 }
      );
    }

    const rejectResult = resolveWorkflowStatusAfterReject(rejectedLevel);

    try {
      await recordPoRejectionHistory({
        purchaseOrderId: id,
        requisitionId: purchaseOrder.requisitionId,
        performedById: context.userId,
        poNumber: purchaseOrder.poNumber,
        rejectedLevel,
        previousWorkflowStatus: workflowStatus,
        newWorkflowStatus: "PURCHASER_REVISION",
        comments,
        quoteId: purchaseOrder.quoteId,
      });
    } catch (historyError: unknown) {
      console.error("Error recording PO rejection history:", historyError);
    }

    await markTaskNotificationsAsRead(context.userId, purchaseOrder.poNumber || id);
    await clearPoApprovalPendingNotifications(id);

    await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: "CANCELLED",
        workflowStatus: rejectResult.workflowStatus,
        levelOneApprovedAt: null,
        levelOneApprovedBy: null,
        levelTwoApprovedAt: null,
        levelTwoApprovedBy: null,
        levelThreeApprovedAt: null,
        levelThreeApprovedBy: null,
      },
    });

    // Must purge synchronously. Background `after()` left CANCELLED rows that
    // no longer blocked re-issue (ACTIVE-only check), so a second PO could be created.
    try {
      await purgePurchaseOrderRecord({
        purchaseOrderId: id,
        performedById: context.userId,
        reason: comments,
        allowAlreadyCancelled: true,
      });
    } catch (purgeError: unknown) {
      console.error("PO purge after reject failed:", purgeError);
      const message =
        purgeError instanceof Error ? purgeError.message : "Failed to remove rejected PO";
      return NextResponse.json(
        {
          error: "Purchase Order was rejected but could not be removed for re-issue",
          details: message,
        },
        { status: 500 }
      );
    }

    const notifyCtx = {
      request,
      actorUserId: context.userId,
      vesselId,
      companyId,
      requisitionNumber: purchaseOrder.requisition?.requisitionNumber,
      purchaseOrderNumber: purchaseOrder.poNumber,
      quoteId: purchaseOrder.quoteId,
      rejectionComments: comments,
      metadata: {
        totalAmount: purchaseOrder.totalAmount,
        currency: purchaseOrder.currency,
        rejectedLevel,
      },
    };

    try {
      await notifyPoReturnedForRevision(notifyCtx);
    } catch (notifyErr) {
      console.error("PO reject purchaser notify failed:", notifyErr);
    }

    return NextResponse.json({
      success: true,
      message: `Purchase Order rejected at Level ${rejectedLevel} — returned to purchaser to re-create PO`,
      removed: true,
      rejectedLevel,
      returnedToPurchaser: true,
    });
  } catch (error: unknown) {
    console.error("Error rejecting Purchase Order:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to reject Purchase Order", details: message },
      { status: 500 }
    );
  }
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  return secureApiRoute(
    (req, ctx) => handler(req, ctx, params),
    { requireAuth: true, allowedMethods: ["POST"], minAccessLevel: 37 }
  )(request, { params });
}
