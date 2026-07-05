import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import { proposeOverdueMaintenanceJobs } from "@/lib/db/vesselReadiness";
import { getCrewSessionContext } from "@/lib/shipAccess/crewContext";
import { assertShipVesselInScope, getSelectedShipVesselId } from "@/lib/shipAccess/scope";
import { getShipAccessContext } from "@/lib/shipAccess/context";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    vesselId?: string;
    dryDockProjectId?: string;
  };

  const vesselId = body.vesselId ?? (await getSelectedShipVesselId());
  if (!vesselId) {
    return NextResponse.json({ error: "No vessel in scope" }, { status: 400 });
  }

  const access = await assertShipVesselInScope(vesselId);
  if (!access.ok) return access.response;

  let targetDryDockProjectId = body.dryDockProjectId;
  if (!targetDryDockProjectId) {
    const ctx = await getShipAccessContext();
    targetDryDockProjectId = ctx.dryDockProject?.id;
  }

  const crew = await getCrewSessionContext();
  const createdByName =
    crew?.designation ?? crew?.roleName ?? crew?.vesselLoginId ?? "PMS monitor";

  const result = await proposeOverdueMaintenanceJobs({
    vesselId,
    targetDryDockProjectId: targetDryDockProjectId ?? null,
    createdByName,
  });

  return NextResponse.json(result, { status: 201 });
}
