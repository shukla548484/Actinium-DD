import { NextResponse } from "next/server";
import { requireShipyardApiAccess } from "@/lib/auth/shipyardAccess";
import { listShipyardEstimators } from "@/lib/db/shipyardRfq";

export const runtime = "nodejs";

export async function GET() {
  const denied = await requireShipyardApiAccess();
  if (denied) return denied;

  const estimators = await listShipyardEstimators();
  return NextResponse.json({ estimators });
}
