import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import {
  deleteVesselRequisition,
  getVesselRequisition,
  isRequisitionCancellableByCrew,
  isRequisitionEditableByCrew,
  updateVesselRequisition,
} from "@/lib/db/vesselRequisitions";
import { getCrewSessionContext } from "@/lib/shipAccess/crewContext";
import {
  parseRequisitionBody,
  vesselRequisitionUpdateSchema,
} from "@/lib/shipAccess/requisitionValidation";
import { assertShipVesselInScope } from "@/lib/shipAccess/scope";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const { id } = await context.params;
  const requisition = await getVesselRequisition(id);
  if (!requisition) {
    return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
  }

  const access = await assertShipVesselInScope(requisition.vesselId);
  if (!access.ok) return access.response;

  return NextResponse.json({ requisition });
}

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const { id } = await context.params;
  const existing = await getVesselRequisition(id);
  if (!existing) {
    return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
  }

  const access = await assertShipVesselInScope(existing.vesselId);
  if (!access.ok) return access.response;

  const parsed = parseRequisitionBody(vesselRequisitionUpdateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const crew = await getCrewSessionContext();
  const actorName = crew?.designation ?? crew?.roleName ?? null;

  if (parsed.data.cancel) {
    if (!isRequisitionCancellableByCrew(existing.status)) {
      return NextResponse.json(
        { error: "This requisition cannot be cancelled in its current status" },
        { status: 400 },
      );
    }
    const requisition = await updateVesselRequisition(id, {
      status: "cancelled",
      cancelledByName: actorName,
    });
    return NextResponse.json({ requisition });
  }

  if (!isRequisitionEditableByCrew(existing.status)) {
    return NextResponse.json(
      { error: "Only draft or rejected requisitions can be updated onboard" },
      { status: 400 },
    );
  }

  const { submit, cancel: _cancel, lines, ...updateData } = parsed.data;
  if (submit && (!lines || lines.length === 0) && existing.lines.length === 0) {
    return NextResponse.json({ error: "Add at least one line item before submitting" }, { status: 400 });
  }

  const requisition = await updateVesselRequisition(id, {
    ...updateData,
    lines,
    defaultEquipmentLabel: existing.defect?.equipmentLabel ?? null,
    ...(submit ? { status: "submitted" } : {}),
  });

  return NextResponse.json({ requisition });
}

export async function DELETE(request: Request, context: RouteContext) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const { id } = await context.params;
  const existing = await getVesselRequisition(id);
  if (!existing) {
    return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
  }

  const access = await assertShipVesselInScope(existing.vesselId);
  if (!access.ok) return access.response;

  if (existing.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft requisitions can be deleted" },
      { status: 400 },
    );
  }

  await deleteVesselRequisition(id);
  return NextResponse.json({ ok: true });
}
