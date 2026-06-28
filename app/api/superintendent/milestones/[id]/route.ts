import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { notDeleted } from "@/lib/superintendent/helpers";
import { assertChildDryDockProjectInScope } from "@/lib/superintendent/childRouteScope";
import { wouldCreateMilestoneCycle } from "@/lib/superintendent/milestoneDeps";
import { ddMilestoneUpdateSchema, parseBody } from "@/lib/superintendent/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const milestone = await prisma.ddMilestone.findFirst({ where: { id, ...notDeleted } });
  if (!milestone) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  const access = await assertChildDryDockProjectInScope(milestone.dryDockProjectId);
  if (!access.ok) return access.response;
  return NextResponse.json({ milestone });
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseBody(ddMilestoneUpdateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await prisma.ddMilestone.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });

  const access = await assertChildDryDockProjectInScope(existing.dryDockProjectId);
  if (!access.ok) return access.response;

  if (parsed.data.dependsOnMilestoneId !== undefined) {
    const siblings = await prisma.ddMilestone.findMany({
      where: { dryDockProjectId: existing.dryDockProjectId, ...notDeleted },
      select: { id: true, dependsOnMilestoneId: true },
    });
    if (
      wouldCreateMilestoneCycle(id, parsed.data.dependsOnMilestoneId ?? null, siblings)
    ) {
      return NextResponse.json({ error: "Invalid dependency — would create a cycle" }, { status: 400 });
    }
  }

  const milestone = await prisma.ddMilestone.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ milestone });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const existing = await prisma.ddMilestone.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });

  const access = await assertChildDryDockProjectInScope(existing.dryDockProjectId);
  if (!access.ok) return access.response;

  await prisma.ddMilestone.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
