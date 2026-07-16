import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import {
  GenerationStatus,
  RequisitionStatus,
} from "@/lib/types/requisition";
import { recordPurchaseHistory, PurchaseHistoryActionType } from "@/lib/services/purchase-history.service";
import { getCurrentUserFromRequest } from "@/lib/session";
import { markTaskNotificationsAsRead } from "@/lib/utils/mark-task-notifications-read";
import { notifyRequisitionRejected } from "@/lib/procurement/approval-notifications";

const rejectBodySchema = z.object({ comments: z.string().min(1, "Rejection comments are required") });

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/requisitions/[id]/reject - Reject requisition with comments
 * SECURITY: Rejected by user from session. Only approver-level users (37, 39, 50, 99, 100) can reject.
 * Allowed states: SAVED_AS_DRAFT, CREATED+NOT_READY, NEW_REQ (before PO issued).
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = (await context.params);
    const rawBody = await request.json().catch(() => ({}));
    let rawComments: string;
    try {
      ({ comments: rawComments } = rejectBodySchema.parse(rawBody));
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid request body', details: e instanceof z.ZodError ? e.flatten() : null },
        { status: 400 }
      );
    }
    const comments = rawComments.trim();
    if (!comments) {
      return NextResponse.json(
        { error: "Rejection comments are required" },
        { status: 400 }
      );
    }

    const existingRequisition = await prisma.requisition.findUnique({
      where: { id },
      include: { createdBy: true, vessel: true },
    });

    if (!existingRequisition) {
      return NextResponse.json(
        { error: "Requisition not found" },
        { status: 404 }
      );
    }

    const approver = await prisma.employee.findUnique({
      where: { id: currentUser.id },
      select: { designationAccessLevel: true },
    });
    if (!approver) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const accessLevel = approver.designationAccessLevel;
    const canReject = [37, 39, 50, 99, 100].includes(accessLevel);
    if (!canReject) {
      return NextResponse.json(
        { error: "Only users with access level 37, 39, 50, 99, or 100 can reject requisitions" },
        { status: 403 }
      );
    }

    if (existingRequisition.status === RequisitionStatus.CANCELLED) {
      return NextResponse.json(
        { error: "Requisition is already cancelled" },
        { status: 400 }
      );
    }

    // Allow reject only in pre-PO states
    const canRejectState =
      (existingRequisition.generationStatus === GenerationStatus.SAVED_AS_DRAFT) ||
      (existingRequisition.generationStatus === GenerationStatus.CREATED &&
        existingRequisition.status === RequisitionStatus.NOT_READY) ||
      (existingRequisition.status === RequisitionStatus.NEW_REQ);

    if (!canRejectState) {
      return NextResponse.json(
        { error: "Requisition cannot be rejected in its current status. Only draft, not ready, or new requisition can be rejected." },
        { status: 400 }
      );
    }

    const previousStatus = existingRequisition.status;

    const updated = await prisma.requisition.update({
      where: { id },
      data: {
        status: RequisitionStatus.CANCELLED,
        returnComments: comments,
        approvedById: currentUser.id,
        approvedAt: new Date(),
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, designation: true } },
        vessel: { select: { id: true, name: true, code: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true, designation: true } },
        items: true,
      },
    });

    await recordPurchaseHistory({
      requisitionId: id,
      actionType: PurchaseHistoryActionType.REJECTED,
      performedById: currentUser.id,
      actionDescription: "Requisition rejected",
      previousStatus,
      newStatus: RequisitionStatus.CANCELLED,
      comments,
    });

    try {
      await notifyRequisitionRejected({
        request,
        actorUserId: currentUser.id,
        requisitionId: id,
        requisitionNumber: existingRequisition.requisitionNumber,
        vesselId: existingRequisition.vesselId,
        companyId: existingRequisition.vessel?.companyId ?? null,
        rejectionComments: comments,
        targetUserIds: [existingRequisition.createdById],
      });
    } catch (notifyErr) {
      console.error("Requisition rejection notification failed:", notifyErr);
    }

    await markTaskNotificationsAsRead(currentUser.id, id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error rejecting requisition:", error);
    return NextResponse.json(
      { error: "Failed to reject requisition" },
      { status: 500 }
    );
  }
}
