import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import { getShipAccessContext } from "@/lib/shipAccess/context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const context = await getShipAccessContext();
  return NextResponse.json(context);
}
