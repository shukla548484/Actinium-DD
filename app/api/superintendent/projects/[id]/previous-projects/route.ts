import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { listPreviousProjectsForVessel } from "@/lib/db/superintendent/copyScope";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  const { vesselId } = access;
  const previous = await listPreviousProjectsForVessel(vesselId, id);

  return NextResponse.json({
    projects: previous.map((p) => ({
      ...p,
      plannedStart: p.plannedStart?.toISOString() ?? null,
      plannedEnd: p.plannedEnd?.toISOString() ?? null,
    })),
  });
}
