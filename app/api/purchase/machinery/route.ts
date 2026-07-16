import { NextResponse } from "next/server";
import { requirePurchaseApiAccess } from "@/lib/auth/purchaseAccess";
import { listPurchaseMachineryForVessel } from "@/lib/db/purchase";

export const runtime = "nodejs";

/** GET /api/purchase/machinery?vesselId=&limit= */
export async function GET(request: Request) {
  const access = await requirePurchaseApiAccess("page.purchase.requisitions");
  if ("denied" in access) return access.denied;

  const url = new URL(request.url);
  const vesselId = url.searchParams.get("vesselId")?.trim();
  if (!vesselId) {
    return NextResponse.json({ error: "vesselId is required." }, { status: 400 });
  }
  const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 1000;

  const result = await listPurchaseMachineryForVessel(access.ctx, vesselId, limit);
  if (result && typeof result === "object" && "error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ data: result });
}
