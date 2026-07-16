import { NextResponse } from "next/server";
import { requirePurchaseApiAccess } from "@/lib/auth/purchaseAccess";
import { listPurchaseStoreLocations } from "@/lib/db/purchase";

export const runtime = "nodejs";

/** GET /api/purchase/store-locations?vesselId= */
export async function GET(request: Request) {
  const access = await requirePurchaseApiAccess("page.purchase.requisitions");
  if ("denied" in access) return access.denied;

  const vesselId = new URL(request.url).searchParams.get("vesselId")?.trim();
  if (!vesselId) {
    return NextResponse.json({ error: "vesselId is required." }, { status: 400 });
  }

  const result = await listPurchaseStoreLocations(access.ctx, vesselId);
  if (result && typeof result === "object" && "error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ storeLocations: result });
}
