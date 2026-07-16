import { NextResponse } from "next/server";
import { requirePurchaseApiAccess } from "@/lib/auth/purchaseAccess";
import { getPurchaseDashboardStats } from "@/lib/db/purchase";

export const runtime = "nodejs";

/** GET /api/purchase/dashboard/stats?vesselId= */
export async function GET(request: Request) {
  const access = await requirePurchaseApiAccess("page.purchase.dashboard");
  if ("denied" in access) return access.denied;

  const vesselId = new URL(request.url).searchParams.get("vesselId");
  const result = await getPurchaseDashboardStats(access.ctx, vesselId);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ stats: result });
}
