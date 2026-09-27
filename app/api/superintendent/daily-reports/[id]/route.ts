import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { notDeleted } from "@/lib/superintendent/helpers";
import { assertChildDryDockProjectInScope } from "@/lib/superintendent/childRouteScope";
import { ddDailyReportUpdateSchema, parseBody } from "@/lib/superintendent/validation";
import {
  countFilledSections,
  normalizeDailyReportSections,
  normalizeReportDate,
  resolveDailyReportSections,
} from "@/lib/superintendent/dailyReportSections";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

function serializeReport(row: {
  id: string;
  dryDockProjectId: string;
  reportDate: Date;
  weatherCondition: string | null;
  sectionsJson: Prisma.JsonValue;
  completedWork: string | null;
  plannedWork: string | null;
  manpowerCount: number | null;
  safetyNotes: string | null;
  delayNotes: string | null;
  progressPct: number | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { attachments: number };
}) {
  const sections = resolveDailyReportSections({
    sectionsJson: row.sectionsJson,
    completedWork: row.completedWork,
    plannedWork: row.plannedWork,
  });
  return {
    id: row.id,
    dryDockProjectId: row.dryDockProjectId,
    reportDate: row.reportDate.toISOString(),
    weatherCondition: row.weatherCondition,
    sections,
    completedWork: row.completedWork,
    plannedWork: row.plannedWork,
    manpowerCount: row.manpowerCount,
    safetyNotes: row.safetyNotes,
    delayNotes: row.delayNotes,
    progressPct: row.progressPct,
    attachmentCount: row._count?.attachments,
    sectionsFilled: countFilledSections(sections),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const dailyReport = await prisma.ddDailyReport.findFirst({
    where: { id, ...notDeleted },
    include: {
      _count: { select: { attachments: true } },
      dryDockProject: {
        select: {
          id: true,
          name: true,
          referenceCode: true,
          plannedStart: true,
          plannedEnd: true,
          actualStart: true,
          expectedSailing: true,
          vessel: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });
  if (!dailyReport) return NextResponse.json({ error: "Daily report not found" }, { status: 404 });
  const access = await assertChildDryDockProjectInScope(dailyReport.dryDockProjectId);
  if (!access.ok) return access.response;

  const { dryDockProject, ...row } = dailyReport;
  return NextResponse.json({
    dailyReport: serializeReport(row),
    project: {
      id: dryDockProject.id,
      name: dryDockProject.name,
      referenceCode: dryDockProject.referenceCode,
      plannedStart: dryDockProject.plannedStart?.toISOString() ?? null,
      plannedEnd: dryDockProject.plannedEnd?.toISOString() ?? null,
      actualStart: dryDockProject.actualStart?.toISOString() ?? null,
      expectedSailing: dryDockProject.expectedSailing?.toISOString() ?? null,
      vessel: dryDockProject.vessel,
    },
  });
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

  let reportDate: Date | undefined;
  if (parsed.data.reportDate != null) {
    try {
      reportDate = normalizeReportDate(parsed.data.reportDate as string | Date);
    } catch {
      return NextResponse.json({ error: "Invalid report date" }, { status: 400 });
    }
    const duplicate = await prisma.ddDailyReport.findFirst({
      where: {
        dryDockProjectId: existing.dryDockProjectId,
        reportDate,
        ...notDeleted,
        NOT: { id },
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "A daily report already exists for this project and date" },
        { status: 409 },
      );
    }
  }

  const data: Prisma.DdDailyReportUpdateInput = {
    ...(reportDate != null ? { reportDate } : {}),
    ...(parsed.data.weatherCondition !== undefined
      ? { weatherCondition: parsed.data.weatherCondition?.trim() || null }
      : {}),
    ...(parsed.data.sections !== undefined
      ? {
          sectionsJson: normalizeDailyReportSections(
            parsed.data.sections,
          ) as unknown as Prisma.InputJsonValue,
        }
      : {}),
    ...(parsed.data.completedWork !== undefined
      ? { completedWork: parsed.data.completedWork?.trim() || null }
      : {}),
    ...(parsed.data.plannedWork !== undefined
      ? { plannedWork: parsed.data.plannedWork?.trim() || null }
      : {}),
    ...(parsed.data.manpowerCount !== undefined ? { manpowerCount: parsed.data.manpowerCount } : {}),
    ...(parsed.data.safetyNotes !== undefined
      ? { safetyNotes: parsed.data.safetyNotes?.trim() || null }
      : {}),
    ...(parsed.data.delayNotes !== undefined
      ? { delayNotes: parsed.data.delayNotes?.trim() || null }
      : {}),
    ...(parsed.data.progressPct !== undefined ? { progressPct: parsed.data.progressPct } : {}),
  };

  const dailyReport = await prisma.ddDailyReport.update({
    where: { id },
    data,
    include: { _count: { select: { attachments: true } } },
  });
  return NextResponse.json({ dailyReport: serializeReport(dailyReport) });
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
