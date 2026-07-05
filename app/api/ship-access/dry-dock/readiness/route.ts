import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import { getVesselDryDockReadiness } from "@/lib/db/vesselReadiness";
import { assertShipVesselInScope, getSelectedShipVesselId } from "@/lib/shipAccess/scope";
import { getShipAccessContext } from "@/lib/shipAccess/context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  let vesselId = searchParams.get("vesselId") ?? (await getSelectedShipVesselId());
  let dryDockProjectId = searchParams.get("dryDockProjectId");

  if (!dryDockProjectId) {
    const ctx = await getShipAccessContext();
    dryDockProjectId = ctx.dryDockProject?.id ?? null;
  }

  if (!vesselId) {
    return NextResponse.json({ error: "No vessel in scope" }, { status: 400 });
  }

  const access = await assertShipVesselInScope(vesselId);
  if (!access.ok) return access.response;

  const readiness = await getVesselDryDockReadiness(vesselId, dryDockProjectId);
  return NextResponse.json({ readiness });
}
