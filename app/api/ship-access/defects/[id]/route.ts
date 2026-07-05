import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import {
  deleteVesselDefect,
  getVesselDefect,
  isDefectCancellableByCrew,
  isDefectEditableByCrew,
  updateVesselDefect,
} from "@/lib/db/vesselDefects";
import { getCrewSessionContext } from "@/lib/shipAccess/crewContext";
import {
  parseDefectBody,
  vesselDefectUpdateSchema,
} from "@/lib/shipAccess/defectValidation";
import { assertShipVesselInScope } from "@/lib/shipAccess/scope";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const { id } = await context.params;
  const defect = await getVesselDefect(id);
  if (!defect) {
    return NextResponse.json({ error: "Defect not found" }, { status: 404 });
  }

  const access = await assertShipVesselInScope(defect.vesselId);
  if (!access.ok) return access.response;

  return NextResponse.json({ defect });
}

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const { id } = await context.params;
  const existing = await getVesselDefect(id);
  if (!existing) {
    return NextResponse.json({ error: "Defect not found" }, { status: 404 });
  }

  const access = await assertShipVesselInScope(existing.vesselId);
  if (!access.ok) return access.response;

  const parsed = parseDefectBody(vesselDefectUpdateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const crew = await getCrewSessionContext();
  const actorName = crew?.designation ?? crew?.roleName ?? null;

  if (parsed.data.cancel) {
    if (!isDefectCancellableByCrew(existing.status)) {
      return NextResponse.json(
        { error: "This defect cannot be cancelled in its current status" },
        { status: 400 },
      );
    }
    const defect = await updateVesselDefect(id, {
      status: "cancelled",
      cancelledByName: actorName,
    });
    return NextResponse.json({ defect });
  }

  if (!isDefectEditableByCrew(existing.status)) {
    return NextResponse.json(
      { error: "Only draft or rejected defects can be updated onboard" },
      { status: 400 },
    );
  }

  const { submit, cancel: _cancel, ...updateData } = parsed.data;
  const defect = await updateVesselDefect(id, {
    ...updateData,
    ...(submit ? { status: "submitted" } : {}),
  });

  return NextResponse.json({ defect });
}

export async function DELETE(request: Request, context: RouteContext) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const { id } = await context.params;
  const existing = await getVesselDefect(id);
  if (!existing) {
    return NextResponse.json({ error: "Defect not found" }, { status: 404 });
  }

  const access = await assertShipVesselInScope(existing.vesselId);
  if (!access.ok) return access.response;

  if (existing.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft defects can be deleted" },
      { status: 400 },
    );
  }

  await deleteVesselDefect(id);
  return NextResponse.json({ ok: true });
}
