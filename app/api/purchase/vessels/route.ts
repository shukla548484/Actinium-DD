import { NextResponse } from "next/server";
import { requirePurchaseApiAccess } from "@/lib/auth/purchaseAccess";
import { listPurchaseVesselsForUser } from "@/lib/db/purchase";

export const runtime = "nodejs";

/** GET /api/purchase/vessels — vessels visible to the current purchase user. */
export async function GET() {
  const access = await requirePurchaseApiAccess("page.purchase");
  if ("denied" in access) return access.denied;

  const vessels = await listPurchaseVesselsForUser(access.ctx);
  return NextResponse.json({ vessels });
}
