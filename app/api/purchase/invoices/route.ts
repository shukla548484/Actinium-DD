import { NextResponse } from "next/server";
import { requirePurchaseApiAccess } from "@/lib/auth/purchaseAccess";
import { listPurchaseInvoices } from "@/lib/db/purchase";

export const runtime = "nodejs";

/** GET /api/purchase/invoices?vesselId=&take=&skip= */
export async function GET(request: Request) {
  const access = await requirePurchaseApiAccess("page.purchase.invoices");
  if ("denied" in access) return access.denied;

  const url = new URL(request.url);
  const result = await listPurchaseInvoices(access.ctx, {
    vesselId: url.searchParams.get("vesselId"),
    take: url.searchParams.get("take") ? Number(url.searchParams.get("take")) : 50,
    skip: url.searchParams.get("skip") ? Number(url.searchParams.get("skip")) : 0,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
