import { NextResponse } from "next/server";
import { requireShipyardApiAccess } from "@/lib/auth/shipyardAccess";
import { getShipyardPortalDashboard } from "@/lib/db/shipyardDashboard";

export const runtime = "nodejs";

export async function GET() {
  const denied = await requireShipyardApiAccess();
  if (denied) return denied;

  const dashboard = await getShipyardPortalDashboard();
  return NextResponse.json(dashboard);
}
