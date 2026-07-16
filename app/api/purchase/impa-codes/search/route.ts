import { NextResponse } from "next/server";
import { requirePurchaseApiAccess } from "@/lib/auth/purchaseAccess";
import { searchPurchaseImpaCodes } from "@/lib/db/purchase";

export const runtime = "nodejs";

/** GET /api/purchase/impa-codes/search?q=&limit=&scope=provision|chemical */
export async function GET(request: Request) {
  const access = await requirePurchaseApiAccess("page.purchase.requisitions");
  if ("denied" in access) return access.denied;

  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 20;
  const scopeRaw = url.searchParams.get("scope");
  const scope =
    scopeRaw === "provision" || scopeRaw === "chemical" ? scopeRaw : null;

  const impaCodes = await searchPurchaseImpaCodes({ q, limit, scope });
  return NextResponse.json({ impaCodes });
}
