import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import { mapVesselJobUpdateInput } from "@/lib/db/superintendent/vesselJobInput";
import { getDdVesselJob, updateDdVesselJob } from "@/lib/db/superintendent/vesselJobs";
import { ddVesselJobUpdateSchema, parseBody } from "@/lib/superintendent/validation";
import { getCrewSessionContext } from "@/lib/shipAccess/crewContext";
import { isJobCategoryAllowedForCrew } from "@/lib/shipAccess/crewJobCategories";
import { assertShipVesselInScope } from "@/lib/shipAccess/scope";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const { id } = await context.params;
  const job = await getDdVesselJob(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const access = await assertShipVesselInScope(job.vesselId);
  if (!access.ok) return access.response;

  return NextResponse.json({ vesselJob: job });
}

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const { id } = await context.params;
  const existing = await getDdVesselJob(id);
  if (!existing) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const access = await assertShipVesselInScope(existing.vesselId);
  if (!access.ok) return access.response;

  if (existing.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft jobs can be updated onboard" },
      { status: 400 },
    );
  }

  const parsed = parseBody(ddVesselJobUpdateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const crew = await getCrewSessionContext();
  const nextCategory = parsed.data.category ?? existing.category;
  if (
    crew?.isVesselCrew &&
    !isJobCategoryAllowedForCrew(crew.roleCode, nextCategory)
  ) {
    return NextResponse.json(
      { error: "Your rank cannot assign jobs to this category" },
      { status: 403 },
    );
  }

  const { submit, ...updateData } = parsed.data;
  const vesselJob = await updateDdVesselJob(id, {
    ...mapVesselJobUpdateInput(updateData),
    ...(submit ? { status: "submitted" as const } : {}),
  });

  return NextResponse.json({ vesselJob });
}
