import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { syncBudgetLinesFromComparison } from "@/lib/superintendent/budgetFromComparison";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  const body = (await request.json().catch(() => ({}))) as { yardInviteId?: string | null };
  const result = await syncBudgetLinesFromComparison(id, body.yardInviteId ?? null);

  if (!result.summary) {
    return NextResponse.json(
      { error: "Link a tender project with yard quotes before syncing." },
      { status: 404 },
    );
  }

  return NextResponse.json(result);
}
