import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import {
  createVesselRequisition,
  listRequisitionEligibleDefects,
  listVesselRequisitions,
} from "@/lib/db/vesselRequisitions";
import { parsePagination } from "@/lib/superintendent/helpers";
import { getCrewSessionContext } from "@/lib/shipAccess/crewContext";
import {
  parseRequisitionBody,
  vesselRequisitionCreateSchema,
} from "@/lib/shipAccess/requisitionValidation";
import {
  assertShipVesselInScope,
  getSelectedShipVesselId,
} from "@/lib/shipAccess/scope";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const { page, limit } = parsePagination(searchParams);
  const status = searchParams.get("status") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const eligibleDefects = searchParams.get("eligibleDefects") === "true";

  const vesselId = (searchParams.get("vesselId") ?? (await getSelectedShipVesselId())) ?? undefined;
  if (!vesselId) {
    if (eligibleDefects) return NextResponse.json({ defects: [] });
    return NextResponse.json({ requisitions: [], total: 0, page, limit, totalPages: 0 });
  }

  const access = await assertShipVesselInScope(vesselId);
  if (!access.ok) return access.response;

  if (eligibleDefects) {
    const defects = await listRequisitionEligibleDefects(vesselId);
    return NextResponse.json({ defects });
  }

  const result = await listVesselRequisitions({ page, limit, vesselId, status, search });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const parsed = parseRequisitionBody(vesselRequisitionCreateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const vesselAccess = await assertShipVesselInScope(parsed.data.vesselId);
  if (!vesselAccess.ok) return vesselAccess.response;

  const crew = await getCrewSessionContext();
  const { submit, ...createData } = parsed.data;
  const status = submit ? "submitted" : "draft";

  try {
    const requisition = await createVesselRequisition({
      ...createData,
      status,
      requestedByEmployeeId: crew?.employeeId ?? null,
      requestedByName: createData.requestedByName ?? crew?.designation ?? null,
    });
    return NextResponse.json({ requisition }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create requisition" },
      { status: 400 },
    );
  }
}
