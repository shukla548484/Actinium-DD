import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import {
  getVesselMachineryHours,
  updateVesselMachineryHours,
} from "@/lib/db/vesselMachineryHours";
import { getCrewSessionContext } from "@/lib/shipAccess/crewContext";
import {
  assertShipVesselInScope,
  getSelectedShipVesselId,
} from "@/lib/shipAccess/scope";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const vesselId = searchParams.get("vesselId") ?? (await getSelectedShipVesselId());
  if (!vesselId) {
    return NextResponse.json({ error: "No vessel in scope" }, { status: 400 });
  }

  const access = await assertShipVesselInScope(vesselId);
  if (!access.ok) return access.response;

  const hours = await getVesselMachineryHours(vesselId);
  return NextResponse.json({ hours });
}

export async function PATCH(request: Request) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const body = (await request.json()) as {
    vesselId?: string;
    mainEngineRunningHours?: number | null;
    auxiliaryEngineRunningHours?: number | null;
    boilerRunningHours?: number | null;
  };

  const vesselId = body.vesselId ?? (await getSelectedShipVesselId());
  if (!vesselId) {
    return NextResponse.json({ error: "No vessel in scope" }, { status: 400 });
  }

  const access = await assertShipVesselInScope(vesselId);
  if (!access.ok) return access.response;

  const crew = await getCrewSessionContext();
  const updatedBy =
    crew?.designation ??
    crew?.roleName ??
    crew?.vesselLoginId ??
    "Onboard crew";

  const hours = await updateVesselMachineryHours(vesselId, {
    mainEngineRunningHours: body.mainEngineRunningHours,
    auxiliaryEngineRunningHours: body.auxiliaryEngineRunningHours,
    boilerRunningHours: body.boilerRunningHours,
    updatedBy,
  });

  return NextResponse.json({ hours });
}
