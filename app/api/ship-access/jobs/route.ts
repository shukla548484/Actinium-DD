import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import {
  createDdVesselJob,
  listDdVesselJobs,
  resolveVesselIdFromProject,
} from "@/lib/db/superintendent/vesselJobs";
import { parsePagination } from "@/lib/superintendent/helpers";
import { ddVesselJobCreateSchema, parseBody } from "@/lib/superintendent/validation";
import {
  assertShipVesselInScope,
  getSelectedShipVesselId,
} from "@/lib/shipAccess/scope";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireShipAccessApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const { page, limit } = parsePagination(searchParams);
  const dryDockProjectId = searchParams.get("dryDockProjectId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const bankOnly = searchParams.get("bankOnly") === "true";

  const vesselId = (searchParams.get("vesselId") ?? (await getSelectedShipVesselId())) ?? undefined;
  if (!vesselId) {
    return NextResponse.json({ vesselJobs: [], total: 0, page, limit, totalPages: 0 });
  }

  const access = await assertShipVesselInScope(vesselId);
  if (!access.ok) return access.response;

  const result = await listDdVesselJobs({
    page,
    limit,
    vesselId,
    dryDockProjectId,
    status,
    search,
    bankOnly,
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const denied = await requireShipAccessApiAccess();
  if (denied) return denied;

  const parsed = parseBody(ddVesselJobCreateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  let vesselId = parsed.data.vesselId;

  if (parsed.data.targetDryDockProjectId) {
    const projectVesselId = await resolveVesselIdFromProject(parsed.data.targetDryDockProjectId);
    if (!projectVesselId) {
      return NextResponse.json({ error: "Target dry dock project not found" }, { status: 404 });
    }
    vesselId = projectVesselId;
  }

  const vesselAccess = await assertShipVesselInScope(vesselId);
  if (!vesselAccess.ok) return vesselAccess.response;

  const { submit, ...createData } = parsed.data;
  const status = submit ? "submitted" : (createData.status ?? "draft");

  const vesselJob = await createDdVesselJob({
    ...createData,
    vesselId,
    status,
  });

  return NextResponse.json({ vesselJob }, { status: 201 });
}
