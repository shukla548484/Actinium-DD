import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import { crewHasPermission } from "@/lib/db/crewPageAccess";
import { getVesselDefect, masterReviewVesselDefect } from "@/lib/db/vesselDefects";
import { getCrewSessionContext } from "@/lib/shipAccess/crewContext";
import {
  parseDefectBody,
  vesselDefectMasterReviewSchema,
} from "@/lib/shipAccess/defectValidation";
import { assertShipVesselInScope } from "@/lib/shipAccess/scope";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const crew = await getCrewSessionContext();
  const isMasterRole = crew?.roleCode === "MASTER";
  const hasApprovePermission =
    crew?.employeeId &&
    (await crewHasPermission(crew.employeeId, "ship.defect.masterApprove"));

  if (crew?.isVesselCrew && !isMasterRole && !hasApprovePermission) {
    return NextResponse.json(
      { error: "Only the Master can approve or reject submitted defects" },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await getVesselDefect(id);
  if (!existing) {
    return NextResponse.json({ error: "Defect not found" }, { status: 404 });
  }

  const access = await assertShipVesselInScope(existing.vesselId);
  if (!access.ok) return access.response;

  if (existing.status !== "submitted") {
    return NextResponse.json(
      { error: "Only submitted defects awaiting Master review can be actioned" },
      { status: 400 },
    );
  }

  const parsed = parseDefectBody(vesselDefectMasterReviewSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  if (parsed.data.action === "reject" && !parsed.data.rejectionReason?.trim()) {
    return NextResponse.json(
      { error: "Rejection reason is required" },
      { status: 400 },
    );
  }

  const actorName =
    parsed.data.actorName?.trim() ||
    crew?.designation ||
    crew?.roleName ||
    "Master";

  const defect = await masterReviewVesselDefect(id, {
    action: parsed.data.action,
    actorName,
    actorEmployeeId: crew?.employeeId ?? null,
    rejectionReason: parsed.data.rejectionReason ?? null,
  });

  return NextResponse.json({ defect });
}
