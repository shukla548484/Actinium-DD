import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { PurchaseHistoryActionType } from "@/lib/services/purchase-history.service";
import { canAccessRequisitionRemarks } from "@/lib/requisition-remarks-access";
import { mapPurchaseHistoryToRemark } from "@/lib/procurement/requisition-remark-history";
import { notifyRequisitionRemarkUpdated } from "@/lib/procurement/requisition-remark-notifications";

interface RouteContext {
  params: Promise<{
    id: string;
    remarkId: string;
  }>;
}

const requisitionNotifySelect = {
  id: true,
  requisitionNumber: true,
  status: true,
  generationStatus: true,
  createdById: true,
  vesselId: true,
  createdBy: {
    select: {
      designationAccessLevel: true,
    },
  },
  vessel: {
    select: {
      companyId: true,
      name: true,
    },
  },
} as const;

function actorName(user: { firstName?: string | null; lastName?: string | null }): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || "User";
}

// PATCH /api/requisitions/[id]/remarks/[remarkId] - Update a remark
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id, remarkId } = await context.params;
    const body = await request.json();
    const { remark } = body;

    if (!remark || !remark.trim()) {
      return NextResponse.json({ error: "Remark is required" }, { status: 400 });
    }

    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (!canAccessRequisitionRemarks(currentUser.designationAccessLevel)) {
      return NextResponse.json(
        { error: "You don't have permission to update remarks" },
        { status: 403 }
      );
    }

    const existing = await prisma.purchaseHistory.findFirst({
      where: {
        id: remarkId,
        requisitionId: id,
        actionType: PurchaseHistoryActionType.COMMENT_ADDED,
      },
      include: {
        performedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Remark not found" }, { status: 404 });
    }

    const trimmed = remark.trim();
    if (trimmed === (existing.comments ?? "").trim()) {
      return NextResponse.json({
        message: "No changes",
        remark: mapPurchaseHistoryToRemark(existing),
      });
    }

    const requisition = await prisma.requisition.findUnique({
      where: { id },
      select: requisitionNotifySelect,
    });

    if (!requisition) {
      return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
    }

    const name = actorName(currentUser);
    const updated = await prisma.purchaseHistory.update({
      where: { id: remarkId },
      data: {
        comments: trimmed,
        previousValue: JSON.stringify({ text: existing.comments ?? "" }),
        newValue: JSON.stringify({
          updatedAt: new Date().toISOString(),
          updatedById: currentUser.id,
          updatedByName: name,
        }),
        actionDescription: `Remark updated on requisition ${requisition.requisitionNumber}`,
      },
      include: {
        performedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    void notifyRequisitionRemarkUpdated({
      requisition,
      remarkId: updated.id,
      remarkText: trimmed,
      actorUserId: currentUser.id,
      actorName: name,
    });

    return NextResponse.json({
      message: "Remark updated successfully",
      remark: mapPurchaseHistoryToRemark(updated),
    });
  } catch (error) {
    console.error("Error updating remark:", error);
    return NextResponse.json({ error: "Failed to update remark" }, { status: 500 });
  }
}
