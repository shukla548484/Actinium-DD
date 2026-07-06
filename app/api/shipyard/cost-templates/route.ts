import { NextResponse } from "next/server";
import { requireShipyardApiAccess } from "@/lib/auth/shipyardAccess";
import { listYardCostTemplates } from "@/lib/db/yardCostTemplates";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = await requireShipyardApiAccess(request);
  if (denied) return denied;

  const companyId = new URL(request.url).searchParams.get("companyId");
  const templates = await listYardCostTemplates(companyId);
  return NextResponse.json({ templates });
}
