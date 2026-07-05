import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import { createVesselDefect, listVesselDefects } from "@/lib/db/vesselDefects";
import { parsePagination } from "@/lib/superintendent/helpers";
import { getCrewSessionContext } from "@/lib/shipAccess/crewContext";
import {
  parseDefectBody,
  vesselDefectCreateSchema,
} from "@/lib/shipAccess/defectValidation";
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

  const vesselId = (searchParams.get("vesselId") ?? (await getSelectedShipVesselId())) ?? undefined;
  if (!vesselId) {
    return NextResponse.json({ defects: [], total: 0, page, limit, totalPages: 0 });
  }

  const access = await assertShipVesselInScope(vesselId);
  if (!access.ok) return access.response;

  const result = await listVesselDefects({ page, limit, vesselId, status, search });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const parsed = parseDefectBody(vesselDefectCreateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const vesselAccess = await assertShipVesselInScope(parsed.data.vesselId);
  if (!vesselAccess.ok) return vesselAccess.response;

  const crew = await getCrewSessionContext();
  const { submit, ...createData } = parsed.data;
  const status = submit ? "submitted" : "draft";

  const defect = await createVesselDefect({
    ...createData,
    status,
    reportedByEmployeeId: crew?.employeeId ?? null,
    reportedByName: createData.reportedByName ?? crew?.designation ?? null,
  });

  return NextResponse.json({ defect }, { status: 201 });
}
