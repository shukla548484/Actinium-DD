import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { carryForwardDdVesselJob, getDdVesselJob } from "@/lib/db/superintendent/vesselJobs";
import { assertVesselInScope } from "@/lib/superintendent/scope";
import { ddVesselJobCarryForwardSchema, parseBody } from "@/lib/superintendent/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await context.params;
  const existing = await getDdVesselJob(id);
  if (!existing) return NextResponse.json({ error: "Vessel job not found" }, { status: 404 });

  const access = await assertVesselInScope(existing.vesselId);
  if (!access.ok) return access.response;

  const parsed = parseBody(ddVesselJobCarryForwardSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = await carryForwardDdVesselJob(id, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ vesselJob: result.vesselJob });
}
