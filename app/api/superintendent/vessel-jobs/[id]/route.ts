import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import {
  getDdVesselJob,
  softDeleteDdVesselJob,
  updateDdVesselJob,
} from "@/lib/db/superintendent/vesselJobs";
import { assertVesselInScope } from "@/lib/superintendent/scope";
import { ddVesselJobUpdateSchema, parseBody } from "@/lib/superintendent/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function loadScopedJob(id: string) {
  const vesselJob = await getDdVesselJob(id);
  if (!vesselJob) {
    return { ok: false as const, response: NextResponse.json({ error: "Vessel job not found" }, { status: 404 }) };
  }
  const access = await assertVesselInScope(vesselJob.vesselId);
  if (!access.ok) return { ok: false as const, response: access.response };
  return { ok: true as const, vesselJob };
}

export async function GET(_request: Request, context: RouteContext) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await context.params;
  const loaded = await loadScopedJob(id);
  if (!loaded.ok) return loaded.response;

  return NextResponse.json({ vesselJob: loaded.vesselJob });
}

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await context.params;
  const loaded = await loadScopedJob(id);
  if (!loaded.ok) return loaded.response;

  if (loaded.vesselJob.status === "integrated") {
    return NextResponse.json({ error: "Integrated jobs cannot be edited" }, { status: 400 });
  }

  const parsed = parseBody(ddVesselJobUpdateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const vesselJob = await updateDdVesselJob(id, parsed.data);
  return NextResponse.json({ vesselJob });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await context.params;
  const loaded = await loadScopedJob(id);
  if (!loaded.ok) return loaded.response;

  if (loaded.vesselJob.status === "integrated") {
    return NextResponse.json({ error: "Integrated jobs cannot be deleted" }, { status: 400 });
  }

  await softDeleteDdVesselJob(id);
  return NextResponse.json({ ok: true });
}
