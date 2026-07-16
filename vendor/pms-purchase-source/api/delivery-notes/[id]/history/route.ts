import { NextRequest, NextResponse } from "next/server";
import { assertPurchaseEntityHistoryAccess } from "@/lib/purchase/purchase-entity-history-access";
import prisma from "@/lib/prisma";
import { buildDeliveryNoteTimeline } from "@/lib/purchase/build-entity-history";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/delivery-notes/[id]/history — chronological audit trail (latest first). */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const access = await assertPurchaseEntityHistoryAccess(request);
    if (!access.allowed) {
      return access.response;
    }

    const { id } = await context.params;

    const dn = await prisma.deliveryNote.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!dn) {
      return NextResponse.json({ error: "Delivery note not found" }, { status: 404 });
    }

    const history = await buildDeliveryNoteTimeline(id);
    return NextResponse.json({ history });
  } catch (error) {
    console.error("Error fetching delivery note history:", error);
    return NextResponse.json({ error: "Failed to fetch delivery note history" }, { status: 500 });
  }
}
