import { NextResponse } from "next/server";
import { requirePurchaseApiAccess } from "@/lib/auth/purchaseAccess";
import { listPurchaseVendors } from "@/lib/db/purchase";

export const runtime = "nodejs";

/** GET /api/purchase/vendors?q=&take=&skip= */
export async function GET(request: Request) {
  const access = await requirePurchaseApiAccess("page.purchase.vendors");
  if ("denied" in access) return access.denied;

  const url = new URL(request.url);
  const result = await listPurchaseVendors({
    q: url.searchParams.get("q"),
    take: url.searchParams.get("take") ? Number(url.searchParams.get("take")) : 50,
    skip: url.searchParams.get("skip") ? Number(url.searchParams.get("skip")) : 0,
  });

  return NextResponse.json(result);
}
