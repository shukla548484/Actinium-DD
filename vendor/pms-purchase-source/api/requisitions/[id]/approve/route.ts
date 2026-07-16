import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { 
  GenerationStatus, 
  RequisitionStatus,
  canMasterApproveVesselRequisitionDraft,
  canOfficeApproveNotReadyRequisition,
} from "@/lib/types/requisition";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import { isCrewOriginatedRequisitionNumber } from "@/lib/sync/record-origin-suffix";
import { getCurrentUserFromRequest } from "@/lib/session";
import { markTaskNotificationsAsRead } from "@/lib/utils/mark-task-notifications-read";
import {
  notifyRequisitionApprovalPending,
  notifyRequisitionApprovedForPurchasing,
} from "@/lib/procurement/approval-notifications";
import { recordRequisitionApprovalHistory } from "@/lib/procurement/record-procurement-history";

const approveBodySchema = z.object({ comments: z.string().optional() });

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// PATCH /api/requisitions/[id]/approve — Crew submits draft → CREATED + NOT_READY first; then Master (25) / admins release V.* to NEW_REQ; shore 37/39/50 after NEW_REQ.
// SECURITY: approvedById is derived from session, not request body.
// 1. CREATED + NOT_READY → NEW_REQ
// 2. NEW_REQ → REQ_APPROVED
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    const approvedById = currentUser.id;

    const { id } = (await context.params);
    const rawBody = await request.json().catch(() => ({}));
    let comments: string | undefined;
    try {
      ({ comments } = approveBodySchema.parse(rawBody));
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid request body', details: e instanceof z.ZodError ? e.flatten() : null },
        { status: 400 }
      );
    }

    // Check if requisition exists
    const existingRequisition = await prisma.requisition.findUnique({
      where: { id },
      include: { createdBy: true },
    });

    if (!existingRequisition) {
      return NextResponse.json(
        { error: "Requisition not found" },
        { status: 404 }
      );
    }

    // Get approver's designation to check access level
    // IMPORTANT: Always use designationAccessLevel from database, NOT hardcoded mapping
    const approver = await prisma.employee.findUnique({
      where: { id: approvedById },
      select: { designationAccessLevel: true }
    });

    if (!approver) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    const accessLevel = approver.designationAccessLevel;

    const crewReq = isCrewOriginatedRequisitionNumber(existingRequisition.requisitionNumber);
    const canShoreApproveNewReq =
      accessLevel === 37 ||
      [39, 50].includes(accessLevel) ||
      isAdminEquivalentAccessLevel(accessLevel);

    if (existingRequisition.generationStatus === GenerationStatus.SAVED_AS_DRAFT) {
      return NextResponse.json(
        {
          error:
            "Draft requisitions must be submitted by the crew first (Ready / CREATED). Use edit/save to submit, then approve to release to New Requisition.",
        },
        { status: 400 }
      );
    } else if (
      existingRequisition.generationStatus === GenerationStatus.CREATED &&
      existingRequisition.status === RequisitionStatus.NOT_READY
    ) {
      // Scenario 2: V.*/T.* → still vessel Master gate; O.* office path → 39 / 50 / admins
      if (crewReq) {
        if (!canMasterApproveVesselRequisitionDraft(accessLevel)) {
          return NextResponse.json(
            {
              error:
                "Only users with designation access level 25 (Master), or administrators (50 / 99 / 100), can release vessel requisitions to shore (NOT_READY → New Requisition).",
            },
            { status: 403 }
          );
        }
      } else if (!canOfficeApproveNotReadyRequisition(accessLevel)) {
        return NextResponse.json(
          {
            error:
              "Only users with access level 39, 50, or administrators (50 / 99 / 100) can approve this requisition at this stage.",
          },
          { status: 403 }
        );
      }

      // Approve created requisition - change from NOT_READY to NEW_REQ
      const approvedRequisition = await prisma.requisition.update({
        where: { id },
        data: {
          status: RequisitionStatus.NEW_REQ,
          isEditable: false, // Once status is NEW_REQ, items cannot be modified
          approvedById,
          approvedAt: new Date(),
        },
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              designation: true,
            },
          },
          vessel: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              designation: true,
            },
          },
          items: true,
        },
      });

      await recordRequisitionApprovalHistory({
        requisitionId: id,
        performedById: approvedById,
        previousStatus: existingRequisition.status,
        newStatus: approvedRequisition.status,
        description: "Requisition released from NOT_READY to NEW_REQ",
        comments,
      });

      await markTaskNotificationsAsRead(approvedById, id);
      try {
        await notifyRequisitionApprovalPending({
          request,
          actorUserId: approvedById,
          requisitionId: id,
          requisitionNumber: approvedRequisition.requisitionNumber,
          vesselId: approvedRequisition.vessel?.id,
          stage: "NEW_REQ",
        });
      } catch (notifyErr) {
        console.error("Requisition release notification failed:", notifyErr);
      }
      return NextResponse.json(approvedRequisition);
    } else if (
      existingRequisition.status === RequisitionStatus.NEW_REQ
    ) {
      // Scenario 3: Shore — NEW_REQ → REQ_APPROVED (37 only at this status)
      if (!canShoreApproveNewReq) {
        return NextResponse.json(
          { error: "Only users with access level 37, 39, 50, 99, or 100 can approve requisitions at this stage" },
          { status: 403 }
        );
      }

      // Approve new requisition - change from NEW_REQ to REQ_APPROVED
      const approvedRequisition = await prisma.requisition.update({
        where: { id },
        data: {
          status: RequisitionStatus.REQ_APPROVED,
          isEditable: false, // Once approved, items cannot be modified
          approvedById,
          approvedAt: new Date(),
        },
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              designation: true,
            },
          },
          vessel: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              designation: true,
            },
          },
          items: true,
        },
      });

      await recordRequisitionApprovalHistory({
        requisitionId: id,
        performedById: approvedById,
        previousStatus: existingRequisition.status,
        newStatus: approvedRequisition.status,
        description: "Requisition approved from NEW_REQ to REQ_APPROVED",
        comments,
      });

      await markTaskNotificationsAsRead(approvedById, id);
      try {
        await notifyRequisitionApprovedForPurchasing({
          request,
          actorUserId: approvedById,
          requisitionId: id,
          requisitionNumber: approvedRequisition.requisitionNumber,
          vesselId: approvedRequisition.vessel?.id,
        });
      } catch (notifyErr) {
        console.error("Requisition approved notification failed:", notifyErr);
      }
      return NextResponse.json(approvedRequisition);
    } else {
      return NextResponse.json(
        { error: "Requisition is not in a state that can be approved" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error approving requisition:", error);
    return NextResponse.json(
      { error: "Failed to approve requisition" },
      { status: 500 }
    );
  }
}