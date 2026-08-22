import { NextResponse } from "next/server";
import { getOfficeAuthContext } from "@/lib/auth/officePageAccess";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { getSessionUserId } from "@/lib/auth/session";
import { denyProjectDeleteUnlessAdmin } from "@/lib/projects/archive";
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
      vessel: { select: { id: true, name: true, code: true, imoNumber: true, vesselType: true } },
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

  const userId = await getSessionUserId();
  const nextStatus = parsed.data.status;
  const archiveSync =
    nextStatus === "archived"
      ? {
          archivedAt: existing.archivedAt ?? new Date(),
          archivedByUserId: existing.archivedByUserId ?? userId,
        }
      : nextStatus !== undefined && existing.archivedAt
        ? { archivedAt: null, archivedByUserId: null }
        : {};

  try {
    const project = await prisma.dryDockProject.update({
      where: { id },
      data: { ...parsed.data, ...archiveSync },
      include: {
        vessel: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json({ project });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const auth = await getOfficeAuthContext();
  const adminDenied = denyProjectDeleteUnlessAdmin(auth);
  if (adminDenied) return adminDenied;

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
