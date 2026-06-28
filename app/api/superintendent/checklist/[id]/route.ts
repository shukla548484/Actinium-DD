import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { notDeleted } from "@/lib/superintendent/helpers";
import { assertChildDryDockProjectInScope } from "@/lib/superintendent/childRouteScope";
import { ddChecklistItemUpdateSchema, parseBody } from "@/lib/superintendent/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const checklistItem = await prisma.ddChecklistItem.findFirst({ where: { id, ...notDeleted } });
  if (!checklistItem) return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
  const access = await assertChildDryDockProjectInScope(checklistItem.dryDockProjectId);
  if (!access.ok) return access.response;
  return NextResponse.json({ checklistItem });
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseBody(ddChecklistItemUpdateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await prisma.ddChecklistItem.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });

  const access = await assertChildDryDockProjectInScope(existing.dryDockProjectId);
  if (!access.ok) return access.response;

  const checklistItem = await prisma.ddChecklistItem.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ checklistItem });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const existing = await prisma.ddChecklistItem.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });

  const access = await assertChildDryDockProjectInScope(existing.dryDockProjectId);
  if (!access.ok) return access.response;

  await prisma.ddChecklistItem.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
