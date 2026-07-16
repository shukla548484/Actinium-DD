import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import prisma from "@/lib/prisma";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import {
  canUploadPurchaseInvoice,
  isInvoiceVerifierAccessLevel,
} from "@/lib/purchase/invoice-access";

const MAX_PO_IDS = 200;

// GET /api/purchase-orders/chat/unread-counts?poIds=id1,id2,...
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userAccessLevel = currentUser.designationAccessLevel || 0;
    const canAccessChat =
      canUploadPurchaseInvoice(userAccessLevel) ||
      isInvoiceVerifierAccessLevel(userAccessLevel) ||
      isAdminEquivalentAccessLevel(userAccessLevel);

    if (!canAccessChat) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const poIdsParam = request.nextUrl.searchParams.get("poIds") ?? "";
    const poIds = poIdsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, MAX_PO_IDS);

    if (poIds.length === 0) {
      return NextResponse.json({ success: true, counts: {} });
    }

    const grouped = await prisma.vendorChatMessage.groupBy({
      by: ["purchaseOrderId"],
      where: {
        purchaseOrderId: { in: poIds },
        senderType: "VENDOR",
        isRead: false,
        isDeleted: false,
      },
      _count: { id: true },
    });

    const counts: Record<string, number> = {};
    for (const id of poIds) {
      counts[id] = 0;
    }
    for (const row of grouped) {
      counts[row.purchaseOrderId] = row._count.id;
    }

    return NextResponse.json({ success: true, counts });
  } catch (error) {
    console.error("Error fetching vendor chat unread counts:", error);
    return NextResponse.json(
      { error: "Failed to fetch unread message counts" },
      { status: 500 }
    );
  }
}
