import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { notDeleted } from "@/lib/superintendent/helpers";
import { assertChildDryDockProjectInScope } from "@/lib/superintendent/childRouteScope";
import { ddDailyReportUpdateSchema, parseBody } from "@/lib/superintendent/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const dailyReport = await prisma.ddDailyReport.findFirst({ where: { id, ...notDeleted } });
  if (!dailyReport) return NextResponse.json({ error: "Daily report not found" }, { status: 404 });
  const access = await assertChildDryDockProjectInScope(dailyReport.dryDockProjectId);
  if (!access.ok) return access.response;
  return NextResponse.json({ dailyReport });
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseBody(ddDailyReportUpdateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await prisma.ddDailyReport.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return NextResponse.json({ error: "Daily report not found" }, { status: 404 });

  const access = await assertChildDryDockProjectInScope(existing.dryDockProjectId);
  if (!access.ok) return access.response;

  const dailyReport = await prisma.ddDailyReport.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ dailyReport });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const existing = await prisma.ddDailyReport.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return NextResponse.json({ error: "Daily report not found" }, { status: 404 });

  const access = await assertChildDryDockProjectInScope(existing.dryDockProjectId);
  if (!access.ok) return access.response;

  await prisma.ddDailyReport.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
