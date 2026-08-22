import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { getPreviousSeaValvesForProject } from "@/lib/db/superintendent/seaValves";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  const result = await getPreviousSeaValvesForProject(id);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
