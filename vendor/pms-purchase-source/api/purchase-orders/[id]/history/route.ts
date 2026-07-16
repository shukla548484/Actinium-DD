import { NextRequest, NextResponse } from "next/server";
import { assertPurchaseEntityHistoryAccess } from "@/lib/purchase/purchase-entity-history-access";
import { buildPurchaseOrderTimeline } from "@/lib/purchase/build-entity-history";

/** GET /api/purchase-orders/[id]/history — chronological audit trail (latest first). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await assertPurchaseEntityHistoryAccess(request);
    if (!access.allowed) {
      return access.response;
    }

    const { id } = await params;
    const history = await buildPurchaseOrderTimeline(id);

    return NextResponse.json({ success: true, history });
  } catch (error: unknown) {
    console.error("Error fetching purchase order history:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch purchase order history", details: message },
      { status: 500 }
    );
  }
}
