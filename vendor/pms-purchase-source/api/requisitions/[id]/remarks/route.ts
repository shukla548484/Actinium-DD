import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import {
  recordPurchaseHistory,
  PurchaseHistoryActionType,
} from "@/lib/services/purchase-history.service";
import { canAccessRequisitionRemarks } from "@/lib/requisition-remarks-access";
import { mapPurchaseHistoryToRemark } from "@/lib/procurement/requisition-remark-history";
import {
  notifyRequisitionRemarkAdded,
} from "@/lib/procurement/requisition-remark-notifications";

interface RouteContext {
  params: Promise<{
    id: string;
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

// GET /api/requisitions/[id]/remarks - Get requisition remarks
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (!canAccessRequisitionRemarks(currentUser.designationAccessLevel)) {
      return NextResponse.json(
        { error: "You don't have permission to view remarks" },
        { status: 403 }
      );
    }

    const requisition = await prisma.requisition.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!requisition) {
      return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
    }

    const history = await prisma.purchaseHistory.findMany({
      where: {
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
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      remarks: history.map(mapPurchaseHistoryToRemark),
    });
  } catch (error) {
    console.error("Error fetching requisition remarks:", error);
    return NextResponse.json(
      { error: "Failed to fetch requisition remarks" },
      { status: 500 }
    );
  }
}

// POST /api/requisitions/[id]/remarks - Add a remark to requisition
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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
        { error: "You don't have permission to add remarks" },
        { status: 403 }
      );
    }

    const requisition = await prisma.requisition.findUnique({
      where: { id },
      select: requisitionNotifySelect,
    });

    if (!requisition) {
      return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
    }

    const trimmed = remark.trim();
    const created = await prisma.purchaseHistory.create({
      data: {
        requisitionId: id,
        actionType: PurchaseHistoryActionType.COMMENT_ADDED as any,
        performedById: currentUser.id,
        actionDescription: `Remark added to requisition ${requisition.requisitionNumber}`,
        comments: trimmed,
      },
    });

    void notifyRequisitionRemarkAdded({
      requisition,
      remarkId: created.id,
      remarkText: trimmed,
      actorUserId: currentUser.id,
      actorName: actorName(currentUser),
    });

    return NextResponse.json({
      message: "Remark added successfully",
      remark: mapPurchaseHistoryToRemark({
        ...created,
        performedBy: {
          id: currentUser.id,
          firstName: currentUser.firstName ?? "",
          lastName: currentUser.lastName ?? "",
        },
      }),
    });
  } catch (error) {
    console.error("Error adding remark:", error);
    return NextResponse.json({ error: "Failed to add remark" }, { status: 500 });
  }
}
