import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { integrateDdVesselJobs } from "@/lib/db/superintendent/vesselJobs";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { ddVesselJobIntegrateSchema, parseBody } from "@/lib/superintendent/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const parsed = parseBody(ddVesselJobIntegrateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const access = await assertDryDockProjectInScope(parsed.data.dryDockProjectId);
  if (!access.ok) return access.response;

  const result = await integrateDdVesselJobs(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ integrated: result.integrated });
}
