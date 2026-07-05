import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { getVesselMachineryHours } from "@/lib/db/vesselMachineryHours";
import { assertDryDockProjectInScope, assertVesselInScope } from "@/lib/superintendent/scope";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const dryDockProjectId = searchParams.get("dryDockProjectId") ?? undefined;
  const vesselId = searchParams.get("vesselId") ?? undefined;

  let resolvedVesselId = vesselId;

  if (dryDockProjectId) {
    const access = await assertDryDockProjectInScope(dryDockProjectId);
    if (!access.ok) return access.response;
    resolvedVesselId = access.vesselId;
  } else if (vesselId) {
    const access = await assertVesselInScope(vesselId);
    if (!access.ok) return access.response;
  } else {
    return NextResponse.json({ error: "dryDockProjectId or vesselId required" }, { status: 400 });
  }

  const hours = await getVesselMachineryHours(resolvedVesselId!);
  return NextResponse.json({ hours });
}
