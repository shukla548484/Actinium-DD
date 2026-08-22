import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import {
  getDdSimpleJob,
  softDeleteDdSimpleJob,
  updateDdSimpleJob,
} from "@/lib/db/dryDockSimpleJobs";
import { getCrewSessionContext } from "@/lib/shipAccess/crewContext";
import {
  ddSimpleJobUpdateSchema,
  parseDdSimpleJobBody,
} from "@/lib/dryDockJobs/validation";
import { assertShipVesselInScope } from "@/lib/shipAccess/scope";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const job = await getDdSimpleJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const access = await assertShipVesselInScope(job.vesselId);
  if (!access.ok) return access.response;

  return NextResponse.json({ job });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const existing = await getDdSimpleJob(id);
  if (!existing) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const access = await assertShipVesselInScope(existing.vesselId);
  if (!access.ok) return access.response;

  if (existing.status !== "draft" && existing.status !== "rejected") {
    return NextResponse.json(
      { error: "Only draft or rejected jobs can be edited" },
      { status: 400 },
    );
  }

  const parsed = parseDdSimpleJobBody(ddSimpleJobUpdateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const crew = await getCrewSessionContext();
  const job = await updateDdSimpleJob(id, {
    ...parsed.data,
    cancelledByName: parsed.data.cancel
      ? (parsed.data.createdByName ?? crew?.designation ?? null)
      : undefined,
  });

  return NextResponse.json({ job });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const existing = await getDdSimpleJob(id);
  if (!existing) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const access = await assertShipVesselInScope(existing.vesselId);
  if (!access.ok) return access.response;

  if (existing.status !== "draft") {
    return NextResponse.json({ error: "Only draft jobs can be deleted" }, { status: 400 });
  }

  await softDeleteDdSimpleJob(id);
  return NextResponse.json({ ok: true });
}
