import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { notDeleted } from "@/lib/superintendent/helpers";
import { assertChildDryDockProjectInScope } from "@/lib/superintendent/childRouteScope";
import { ddSurveyItemUpdateSchema, parseBody } from "@/lib/superintendent/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const surveyItem = await prisma.ddSurveyItem.findFirst({ where: { id, ...notDeleted } });
  if (!surveyItem) return NextResponse.json({ error: "Survey item not found" }, { status: 404 });
  const access = await assertChildDryDockProjectInScope(surveyItem.dryDockProjectId);
  if (!access.ok) return access.response;
  return NextResponse.json({ surveyItem });
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseBody(ddSurveyItemUpdateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await prisma.ddSurveyItem.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return NextResponse.json({ error: "Survey item not found" }, { status: 404 });

  const access = await assertChildDryDockProjectInScope(existing.dryDockProjectId);
  if (!access.ok) return access.response;

  const surveyItem = await prisma.ddSurveyItem.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ surveyItem });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const existing = await prisma.ddSurveyItem.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return NextResponse.json({ error: "Survey item not found" }, { status: 404 });

  const access = await assertChildDryDockProjectInScope(existing.dryDockProjectId);
  if (!access.ok) return access.response;

  await prisma.ddSurveyItem.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
