import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { listVesselDefects } from "@/lib/db/vesselDefects";
import { assertDryDockProjectInScope, assertVesselInScope } from "@/lib/superintendent/scope";
import { parsePagination } from "@/lib/superintendent/helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const { page, limit } = parsePagination(searchParams);
  const dryDockProjectId = searchParams.get("dryDockProjectId") ?? undefined;
  const vesselId = searchParams.get("vesselId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const search = searchParams.get("search") ?? undefined;

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

  const result = await listVesselDefects({
    page,
    limit,
    vesselId: resolvedVesselId,
    status,
    search,
  });

  return NextResponse.json(result);
}
