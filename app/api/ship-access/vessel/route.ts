import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import {
  assertShipVesselInScope,
  SHIP_ACCESS_VESSEL_COOKIE,
} from "@/lib/shipAccess/scope";
import { sessionCookieOptions } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const body = (await request.json()) as { vesselId?: string };
  const vesselId = body.vesselId?.trim();
  if (!vesselId) {
    return NextResponse.json({ error: "vesselId is required" }, { status: 400 });
  }

  const access = await assertShipVesselInScope(vesselId);
  if (!access.ok) return access.response;

  const res = NextResponse.json({ ok: true, vesselId });
  res.cookies.set(SHIP_ACCESS_VESSEL_COOKIE, vesselId, {
    ...sessionCookieOptions(),
    httpOnly: true,
  });
  return res;
}
