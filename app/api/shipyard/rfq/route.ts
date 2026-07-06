import { NextResponse } from "next/server";
import { requireShipyardApiAccess } from "@/lib/auth/shipyardAccess";
import { listShipyardRfqQueue } from "@/lib/db/shipyardRfq";

export const runtime = "nodejs";

/** Shipyard RFQ queue — office YardInvite rows assigned to yard workflow. */
export async function GET() {
  const denied = await requireShipyardApiAccess();
  if (denied) return denied;

  const queue = await listShipyardRfqQueue();
  return NextResponse.json({ queue, total: queue.length });
}
