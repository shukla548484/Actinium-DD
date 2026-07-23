import { NextResponse } from "next/server";
import { requireShipyardApiAccess } from "@/lib/auth/shipyardAccess";
import { getSessionUserId } from "@/lib/auth/session";
import {
  listQuotationRequestsForYard,
  resolveYardCompanyIdForSession,
} from "@/lib/db/shipyardQuotation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = await requireShipyardApiAccess(request);
  if (denied) return denied;

  const userId = await getSessionUserId();
  const yardCompanyId = await resolveYardCompanyIdForSession(userId);
  if (!yardCompanyId) {
    return NextResponse.json({ error: "No shipyard company in scope" }, { status: 403 });
  }

  const rows = await listQuotationRequestsForYard(yardCompanyId);
  return NextResponse.json({ rows, yardCompanyId });
}
