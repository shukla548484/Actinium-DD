import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import { ceReviewDdVesselJob, getDdVesselJob } from "@/lib/db/superintendent/vesselJobs";
import { ddVesselJobCeReviewSchema, parseBody } from "@/lib/superintendent/validation";
import { assertShipVesselInScope } from "@/lib/shipAccess/scope";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteCtx) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const existing = await getDdVesselJob(id);
  if (!existing) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const access = await assertShipVesselInScope(existing.vesselId);
  if (!access.ok) return access.response;

  const parsed = parseBody(ddVesselJobCeReviewSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = await ceReviewDdVesselJob(id, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ vesselJob: result.vesselJob });
}
