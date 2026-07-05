import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { getVesselDryDockReadiness } from "@/lib/db/vesselReadiness";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  const readiness = await getVesselDryDockReadiness(access.vesselId, id);
  return NextResponse.json({ readiness });
}
