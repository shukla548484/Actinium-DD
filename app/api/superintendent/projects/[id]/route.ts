import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { findDryDockProject, notDeleted } from "@/lib/superintendent/helpers";
import { assertDryDockProjectInScope, assertVesselInScope } from "@/lib/superintendent/scope";
import {
  dryDockProjectUpdateSchema,
  parseBody,
} from "@/lib/superintendent/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  const project = await prisma.dryDockProject.findFirst({
    where: { id, ...notDeleted },
    include: {
      vessel: { select: { id: true, name: true, code: true, imoNumber: true } },
      tenderProject: { select: { id: true, name: true } },
      _count: {
        select: {
          jobs: true,
          budgetLines: true,
          checklistItems: true,
          milestones: true,
          risks: true,
          variations: true,
          dailyReports: true,
          delays: true,
          surveyItems: true,
          sparesItems: true,
          approvals: true,
        },
      },
    },
  });

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseBody(dryDockProjectUpdateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await findDryDockProject(id);
  if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  if (parsed.data.vesselId) {
    const vessel = await prisma.vessel.findFirst({
      where: { id: parsed.data.vesselId, ...notDeleted },
    });
    if (!vessel) return NextResponse.json({ error: "Vessel not found" }, { status: 404 });
    const vesselAccess = await assertVesselInScope(parsed.data.vesselId);
    if (!vesselAccess.ok) return vesselAccess.response;
  }

  if (parsed.data.status && parsed.data.status !== existing.status) {
    const { canTransitionStatus } = await import("@/lib/superintendent/engine/statusWorkflow");
    if (!canTransitionStatus(existing.status, parsed.data.status)) {
      return NextResponse.json(
        { error: `Invalid status transition from ${existing.status} to ${parsed.data.status}` },
        { status: 400 },
      );
    }
  }

  const project = await prisma.dryDockProject.update({
    where: { id },
    data: parsed.data,
    include: {
      vessel: { select: { id: true, name: true, code: true } },
    },
  });

  return NextResponse.json({ project });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const existing = await findDryDockProject(id);
  if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  await prisma.dryDockProject.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
