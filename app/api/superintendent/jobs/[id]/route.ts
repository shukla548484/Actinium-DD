import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { notDeleted } from "@/lib/superintendent/helpers";
import { assertChildDryDockProjectInScope } from "@/lib/superintendent/childRouteScope";
import { syncDryDockProjectProgress } from "@/lib/db/superintendent/projectProgress";
import { ddJobUpdateSchema, parseBody } from "@/lib/superintendent/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const job = await prisma.ddJob.findFirst({ where: { id, ...notDeleted } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const access = await assertChildDryDockProjectInScope(job.dryDockProjectId);
  if (!access.ok) return access.response;
  return NextResponse.json({ job });
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseBody(ddJobUpdateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await prisma.ddJob.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const access = await assertChildDryDockProjectInScope(existing.dryDockProjectId);
  if (!access.ok) return access.response;

  const job = await prisma.ddJob.update({ where: { id }, data: parsed.data });
  await syncDryDockProjectProgress(existing.dryDockProjectId);
  return NextResponse.json({ job });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const existing = await prisma.ddJob.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const access = await assertChildDryDockProjectInScope(existing.dryDockProjectId);
  if (!access.ok) return access.response;

  await prisma.ddJob.update({ where: { id }, data: { deletedAt: new Date() } });
  await syncDryDockProjectProgress(existing.dryDockProjectId);
  return NextResponse.json({ ok: true });
}
