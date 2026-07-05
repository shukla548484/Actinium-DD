import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import { listVesselPmsSchedule } from "@/lib/db/vesselPms";
import { assertShipVesselInScope, getSelectedShipVesselId } from "@/lib/shipAccess/scope";

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

  const data = await listVesselPmsSchedule(vesselId);
  return NextResponse.json(data);
}
