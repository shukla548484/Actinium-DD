import { NextRequest, NextResponse } from "next/server";
import { assertPurchaseEntityHistoryAccess } from "@/lib/purchase/purchase-entity-history-access";
import { buildRequisitionTimeline } from "@/lib/purchase/build-entity-history";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/requisitions/[id]/history — chronological audit trail (latest first). */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const access = await assertPurchaseEntityHistoryAccess(request);
    if (!access.allowed) {
      return access.response;
    }

    const { id } = await context.params;
    const history = await buildRequisitionTimeline(id);

    return NextResponse.json({ history });
  } catch (error) {
    console.error("Error fetching requisition history:", error);
    return NextResponse.json({ error: "Failed to fetch requisition history" }, { status: 500 });
  }
}
