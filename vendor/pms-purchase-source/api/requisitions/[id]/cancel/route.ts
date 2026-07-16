import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { 
  RequisitionStatus,
  getIsEditableFromStatus,
  canCancelRequisition
} from "@/lib/types/requisition";
import { recordPurchaseHistory, PurchaseHistoryActionType } from "@/lib/services/purchase-history.service";
import { getCurrentUserFromRequest } from "@/lib/session";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// PATCH /api/requisitions/[id]/cancel - Cancel requisition (Access level 32, 33, 39, 50)
// SECURITY: cancelledById is derived from session, not request body.
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const cancelledById = currentUser.id;

    const { id } = (await context.params);
    const body = await request.json().catch(() => ({}));
    const reason = body.reason;

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

    // Check if already cancelled
    if (existingRequisition.status === RequisitionStatus.CANCELLED) {
      return NextResponse.json(
        { error: "Requisition is already cancelled" },
        { status: 400 }
      );
    }

    // Check if purchase order has been issued for this requisition
    // If PO exists, requisition cannot be cancelled directly - must cancel PO first
    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: {
        requisitionId: id,
        status: { not: 'CANCELLED' }, // Check for non-cancelled PO
      },
    });

    if (purchaseOrder) {
      return NextResponse.json(
        { error: "Cannot cancel requisition. A purchase order has been issued for this requisition. Please cancel the purchase order first." },
        { status: 400 }
      );
    }

    // Also check by requisition status
    if (
      existingRequisition.status === RequisitionStatus.QUOTE_CONFIRMED_PO_SENT ||
      existingRequisition.status === RequisitionStatus.REQ_RECEIVED_DELIVERED
    ) {
      return NextResponse.json(
        { error: "Cannot cancel requisition. A purchase order has been issued for this requisition. Please cancel the purchase order first." },
        { status: 400 }
      );
    }

    // Get canceller's designation to check access level
    // IMPORTANT: Always use designationAccessLevel from database, NOT hardcoded mapping
    const canceller = await prisma.employee.findUnique({
      where: { id: cancelledById },
      select: { designationAccessLevel: true }
    });

    if (!canceller) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    const accessLevel = canceller.designationAccessLevel;
    
    // Check if user has access level 32, 33, 39, or 50
    if (!canCancelRequisition(accessLevel)) {
      return NextResponse.json(
        { error: "Only users with access level 32, 33, 39, or 50 can cancel requisitions" },
        { status: 403 }
      );
    }

    // Cancel the requisition
    const cancelledRequisition = await prisma.requisition.update({
      where: { id },
      data: {
        status: RequisitionStatus.CANCELLED,
        isEditable: false, // Cancelled requisitions cannot be edited
        returnComments: reason ? `[Cancelled: ${reason}]` : existingRequisition.returnComments,
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
      actionType: PurchaseHistoryActionType.CANCELLED,
      performedById: cancelledById,
      actionDescription: `Requisition ${cancelledRequisition.requisitionNumber} cancelled`,
      previousStatus: existingRequisition.status,
      newStatus: cancelledRequisition.status,
      comments: reason || undefined,
    });

    return NextResponse.json(cancelledRequisition);
  } catch (error) {
    console.error("Error cancelling requisition:", error);
    return NextResponse.json(
      { error: "Failed to cancel requisition" },
      { status: 500 }
    );
  }
}




