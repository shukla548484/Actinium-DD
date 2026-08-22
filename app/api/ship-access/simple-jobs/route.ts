import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import {
  createDdSimpleJob,
  listDdSimpleJobs,
} from "@/lib/db/dryDockSimpleJobs";
import { parsePagination } from "@/lib/superintendent/helpers";
import { getCrewSessionContext } from "@/lib/shipAccess/crewContext";
import {
  ddSimpleJobCreateSchema,
  parseDdSimpleJobBody,
} from "@/lib/dryDockJobs/validation";
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
  const jobType = searchParams.get("jobType") ?? undefined;
  const search = searchParams.get("search") ?? undefined;

  const vesselId =
    (searchParams.get("vesselId") ?? (await getSelectedShipVesselId())) ?? undefined;
  if (!vesselId) {
    return NextResponse.json({ jobs: [], total: 0, page, limit, totalPages: 0 });
  }

  const access = await assertShipVesselInScope(vesselId);
  if (!access.ok) return access.response;

  const result = await listDdSimpleJobs({ page, limit, vesselId, status, jobType, search });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const parsed = parseDdSimpleJobBody(ddSimpleJobCreateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const vesselAccess = await assertShipVesselInScope(parsed.data.vesselId);
  if (!vesselAccess.ok) return vesselAccess.response;

  const crew = await getCrewSessionContext();
  const { submit, ...createData } = parsed.data;
  const status = submit ? "submitted" : "draft";

  const job = await createDdSimpleJob({
    ...createData,
    status,
    createdByEmployeeId: crew?.employeeId ?? null,
    createdByName: createData.createdByName ?? crew?.designation ?? null,
  });

  return NextResponse.json({ job }, { status: 201 });
}
