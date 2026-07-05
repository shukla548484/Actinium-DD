import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { mapVesselJobCreateInput } from "@/lib/db/superintendent/vesselJobInput";
import {
  createDdVesselJob,
  listDdVesselJobs,
  resolveVesselIdFromProject,
} from "@/lib/db/superintendent/vesselJobs";
import { assertDryDockProjectInScope, assertVesselInScope } from "@/lib/superintendent/scope";
import { parsePagination } from "@/lib/superintendent/helpers";
import { ddVesselJobCreateSchema, parseBody } from "@/lib/superintendent/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const { page, limit } = parsePagination(searchParams);
  const vesselId = searchParams.get("vesselId") ?? undefined;
  const dryDockProjectId = searchParams.get("dryDockProjectId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const bankOnly = searchParams.get("bankOnly") === "true";

  if (dryDockProjectId) {
    const access = await assertDryDockProjectInScope(dryDockProjectId);
    if (!access.ok) return access.response;
  } else if (vesselId) {
    const access = await assertVesselInScope(vesselId);
    if (!access.ok) return access.response;
  }

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
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const parsed = parseBody(ddVesselJobCreateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  let vesselId = parsed.data.vesselId;

  if (parsed.data.targetDryDockProjectId) {
    const projectVesselId = await resolveVesselIdFromProject(parsed.data.targetDryDockProjectId);
    if (!projectVesselId) {
      return NextResponse.json({ error: "Target dry dock project not found" }, { status: 404 });
    }
    const access = await assertDryDockProjectInScope(parsed.data.targetDryDockProjectId);
    if (!access.ok) return access.response;
    vesselId = projectVesselId;
  }

  const vesselAccess = await assertVesselInScope(vesselId);
  if (!vesselAccess.ok) return vesselAccess.response;

  const { submit, ...createData } = parsed.data;
  const status = submit ? "submitted" : (createData.status ?? "draft");

  const vesselJob = await createDdVesselJob(
    mapVesselJobCreateInput(parsed.data, vesselId, status),
  );

  return NextResponse.json({ vesselJob }, { status: 201 });
}
