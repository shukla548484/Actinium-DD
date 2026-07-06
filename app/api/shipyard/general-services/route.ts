import { NextResponse } from "next/server";
import { requireShipyardApiAccess } from "@/lib/auth/shipyardAccess";
import { listYardGeneralServices } from "@/lib/db/yardGeneralServices";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = await requireShipyardApiAccess(request);
  if (denied) return denied;

  const companyId = new URL(request.url).searchParams.get("companyId");
  const items = await listYardGeneralServices(companyId);
  return NextResponse.json({ items });
}
