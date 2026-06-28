import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { notDeleted } from "@/lib/superintendent/helpers";
import { assertChildDryDockProjectInScope } from "@/lib/superintendent/childRouteScope";
import { ddSparesItemUpdateSchema, parseBody } from "@/lib/superintendent/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const sparesItem = await prisma.ddSparesItem.findFirst({ where: { id, ...notDeleted } });
  if (!sparesItem) return NextResponse.json({ error: "Spares item not found" }, { status: 404 });
  const access = await assertChildDryDockProjectInScope(sparesItem.dryDockProjectId);
  if (!access.ok) return access.response;
  return NextResponse.json({ sparesItem });
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseBody(ddSparesItemUpdateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await prisma.ddSparesItem.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return NextResponse.json({ error: "Spares item not found" }, { status: 404 });

  const access = await assertChildDryDockProjectInScope(existing.dryDockProjectId);
  if (!access.ok) return access.response;

  const sparesItem = await prisma.ddSparesItem.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ sparesItem });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const existing = await prisma.ddSparesItem.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return NextResponse.json({ error: "Spares item not found" }, { status: 404 });

  const access = await assertChildDryDockProjectInScope(existing.dryDockProjectId);
  if (!access.ok) return access.response;

  await prisma.ddSparesItem.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
