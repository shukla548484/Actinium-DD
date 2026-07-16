import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { 
  RequisitionStatus,
  GenerationStatus,
  getIsEditableFromStatus,
  canReturnRequisition
} from "@/lib/types/requisition";
import { recordPurchaseHistory, PurchaseHistoryActionType } from "@/lib/services/purchase-history.service";
import { markTaskNotificationsAsRead } from "@/lib/utils/mark-task-notifications-read";
import { notifyRequisitionReturned } from "@/lib/procurement/approval-notifications";
import { getCurrentUserFromRequest } from "@/lib/session";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// PATCH /api/requisitions/[id]/return - Return requisition for editing (Access level 39, 50)
// Returns requisition to CREATED status (NOT_READY) making it editable by users 17-25
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = (await context.params);
    const body = await request.json();
    const { returnedById, reason } = body;

    if (!returnedById) {
      return NextResponse.json(
        { error: "Missing returnedById" },
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

    // Check if already cancelled - cannot return cancelled requisitions
    if (existingRequisition.status === RequisitionStatus.CANCELLED) {
      return NextResponse.json(
        { error: "Cannot return a cancelled requisition" },
        { status: 400 }
      );
    }

    // Get returner's designation to check access level
    // IMPORTANT: Always use designationAccessLevel from database, NOT hardcoded mapping
    const returner = await prisma.employee.findUnique({
      where: { id: returnedById },
      select: { designationAccessLevel: true }
    });

    if (!returner) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    const accessLevel = returner.designationAccessLevel;
    
    // Check if user has access level 39 or 50
    if (!canReturnRequisition(accessLevel)) {
      return NextResponse.json(
        { error: "Only users with access level 39 or 50 can return requisitions" },
        { status: 403 }
      );
    }

    // Return the requisition - set status to NOT_READY (CREATED) making it editable
    const returnedRequisition = await prisma.requisition.update({
      where: { id },
      data: {
        status: RequisitionStatus.NOT_READY, // Return to CREATED status (NOT_READY)
        generationStatus: GenerationStatus.CREATED, // Ensure it's marked as CREATED
        isEditable: true, // Make it editable for users 17-25
        returnComments: reason || null, // Store return comments for users who will edit
        remarks: existingRequisition.remarks, // Keep existing remarks
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
        items: true,
      },
    });

    // Record purchase history
    await recordPurchaseHistory({
      requisitionId: id,
      actionType: PurchaseHistoryActionType.RETURNED,
      performedById: returnedById,
      actionDescription: `Requisition ${returnedRequisition.requisitionNumber} returned for editing`,
      previousStatus: existingRequisition.status,
      newStatus: returnedRequisition.status,
      comments: reason || undefined,
    });

    // Log activity with notification
    try {
      const currentUser = await getCurrentUserFromRequest(request);
      await notifyRequisitionReturned({
        request,
        actorUserId: returnedById,
        requisitionId: id,
        requisitionNumber: returnedRequisition.requisitionNumber,
        vesselId: returnedRequisition.vesselId,
        returnComments: reason,
        targetUserIds: [existingRequisition.createdById],
        metadata: {
          previousStatus: existingRequisition.status,
          newStatus: returnedRequisition.status,
        },
      });
    } catch (activityError: unknown) {
      console.error("Error logging requisition return:", activityError);
    }

    await markTaskNotificationsAsRead(returnedById, id);
    return NextResponse.json(returnedRequisition);
  } catch (error) {
    console.error("Error returning requisition:", error);
    return NextResponse.json(
      { error: "Failed to return requisition" },
      { status: 500 }
    );
  }
}

