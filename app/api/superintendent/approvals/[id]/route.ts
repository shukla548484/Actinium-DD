import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { notDeleted } from "@/lib/superintendent/helpers";
import { assertChildDryDockProjectInScope } from "@/lib/superintendent/childRouteScope";
import { ddApprovalRequestUpdateSchema, parseBody } from "@/lib/superintendent/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const approval = await prisma.ddApprovalRequest.findFirst({ where: { id, ...notDeleted } });
  if (!approval) return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  const access = await assertChildDryDockProjectInScope(approval.dryDockProjectId);
  if (!access.ok) return access.response;
  return NextResponse.json({ approval });
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseBody(ddApprovalRequestUpdateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await prisma.ddApprovalRequest.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return NextResponse.json({ error: "Approval not found" }, { status: 404 });

  const access = await assertChildDryDockProjectInScope(existing.dryDockProjectId);
  if (!access.ok) return access.response;

  const approval = await prisma.ddApprovalRequest.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ approval });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const existing = await prisma.ddApprovalRequest.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return NextResponse.json({ error: "Approval not found" }, { status: 404 });

  const access = await assertChildDryDockProjectInScope(existing.dryDockProjectId);
  if (!access.ok) return access.response;

  await prisma.ddApprovalRequest.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
