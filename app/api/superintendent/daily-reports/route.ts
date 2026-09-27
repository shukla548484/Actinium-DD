import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import {
  findDryDockProject,
  notDeleted,
  paginatedResult,
  parsePagination,
} from "@/lib/superintendent/helpers";
import {
  buildChildEntityWhere,
  guardChildListAccess,
} from "@/lib/superintendent/childRouteScope";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { ddDailyReportCreateSchema, parseBody } from "@/lib/superintendent/validation";
import {
  countFilledSections,
  emptyDailyReportSections,
  normalizeDailyReportSections,
  normalizeReportDate,
  resolveDailyReportSections,
} from "@/lib/superintendent/dailyReportSections";
import { prisma } from "@/lib/prisma";
import { allocateDailyReportNumber } from "@/lib/superintendent/dailyReportNumber";

export const dynamic = "force-dynamic";

function serializeReport(row: {
  id: string;
  dryDockProjectId: string;
  reportNumber: string;
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
    reportNumber: row.reportNumber,
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

export async function GET(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const dryDockProjectId = searchParams.get("dryDockProjectId") ?? undefined;
  const search = searchParams.get("search")?.trim();

  const guard = await guardChildListAccess(dryDockProjectId, page, limit);
  if (!guard.ok) return NextResponse.json(guard.response);

  const where: Prisma.DdDailyReportWhereInput = {
    ...notDeleted,
    ...buildChildEntityWhere(dryDockProjectId, guard.projectFilter),
    ...(search
      ? {
          OR: [
            { reportNumber: { contains: search, mode: "insensitive" } },
            { weatherCondition: { contains: search, mode: "insensitive" } },
            { completedWork: { contains: search, mode: "insensitive" } },
            { plannedWork: { contains: search, mode: "insensitive" } },
            { safetyNotes: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.ddDailyReport.count({ where }),
    prisma.ddDailyReport.findMany({
      where,
      skip,
      take: limit,
      orderBy: { reportDate: "desc" },
      include: { _count: { select: { attachments: true } } },
    }),
  ]);

  return NextResponse.json(paginatedResult(rows.map(serializeReport), total, page, limit));
}

export async function POST(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const parsed = parseBody(ddDailyReportCreateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const project = await findDryDockProject(parsed.data.dryDockProjectId);
  if (!project) return NextResponse.json({ error: "Dry dock project not found" }, { status: 404 });

  const access = await assertDryDockProjectInScope(parsed.data.dryDockProjectId);
  if (!access.ok) return access.response;

  let reportDate: Date;
  try {
    reportDate = normalizeReportDate(parsed.data.reportDate as string | Date);
  } catch {
    return NextResponse.json({ error: "Invalid report date" }, { status: 400 });
  }

  const duplicate = await prisma.ddDailyReport.findFirst({
    where: {
      dryDockProjectId: parsed.data.dryDockProjectId,
      reportDate,
      ...notDeleted,
    },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "A daily report already exists for this project and date" },
      { status: 409 },
    );
  }

  const sections = parsed.data.sections
    ? normalizeDailyReportSections(parsed.data.sections)
    : emptyDailyReportSections();

  const row = await prisma.$transaction(async (tx) => {
    const reportNumber = await allocateDailyReportNumber(tx, project);

    return tx.ddDailyReport.create({
      data: {
        dryDockProjectId: parsed.data.dryDockProjectId,
        reportNumber,
        reportDate,
      weatherCondition: parsed.data.weatherCondition?.trim() || null,
      sectionsJson: sections as unknown as Prisma.InputJsonValue,
      completedWork: parsed.data.completedWork?.trim() || null,
      plannedWork: parsed.data.plannedWork?.trim() || null,
      manpowerCount: parsed.data.manpowerCount ?? null,
      safetyNotes: parsed.data.safetyNotes?.trim() || null,
      delayNotes: parsed.data.delayNotes?.trim() || null,
        progressPct: parsed.data.progressPct ?? null,
      },
      include: { _count: { select: { attachments: true } } },
    });
  });

  return NextResponse.json({ dailyReport: serializeReport(row) }, { status: 201 });
}
