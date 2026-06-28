import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { buildBudgetVsQuoteSummary } from "@/lib/superintendent/budgetFromComparison";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  const { searchParams } = new URL(request.url);
  const yardInviteId = searchParams.get("yardInviteId");

  const summary = await buildBudgetVsQuoteSummary(id, yardInviteId);
  if (!summary) {
    return NextResponse.json(
      { error: "Link a tender project with yard quotes to compare budget vs quote." },
      { status: 404 },
    );
  }

  return NextResponse.json({ summary });
}
