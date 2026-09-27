import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted, parsePageLimit } from "@/lib/db/superintendent/pagination";
import {
  countFilledSections,
  emptyDailyReportSections,
  normalizeDailyReportSections,
  normalizeReportDate,
  resolveDailyReportSections,
  type DailyReportSections,
} from "@/lib/superintendent/dailyReportSections";
import type { DdDailyReportDto, ListQuery } from "@/lib/superintendent/types";

type ReportRow = Prisma.DdDailyReportGetPayload<{
  include: { _count: { select: { attachments: true } } };
}>;

function mapDailyReport(row: ReportRow | Prisma.DdDailyReportGetPayload<object>): DdDailyReportDto {
  const sections = resolveDailyReportSections({
    sectionsJson: row.sectionsJson,
    completedWork: row.completedWork,
    plannedWork: row.plannedWork,
  });
  const attachmentCount =
    "_count" in row && row._count ? row._count.attachments : undefined;
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
    attachmentCount,
    sectionsFilled: countFilledSections(sections),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function sectionsToJson(sections: DailyReportSections): Prisma.InputJsonValue {
  return sections as unknown as Prisma.InputJsonValue;
}

function buildWhere(query: ListQuery): Prisma.DdDailyReportWhereInput {
  const where: Prisma.DdDailyReportWhereInput = { ...notDeleted };
  if (query.dryDockProjectId) where.dryDockProjectId = query.dryDockProjectId;
  if (query.search) {
    where.OR = [
      { weatherCondition: { contains: query.search, mode: "insensitive" } },
      { completedWork: { contains: query.search, mode: "insensitive" } },
      { plannedWork: { contains: query.search, mode: "insensitive" } },
      { safetyNotes: { contains: query.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listDdDailyReports(query: ListQuery = {}) {
  const { page, limit, skip } = parsePageLimit(query);
  const where = buildWhere(query);

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

  return {
    dailyReports: rows.map(mapDailyReport),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

export async function getDdDailyReport(id: string) {
  const row = await prisma.ddDailyReport.findFirst({
    where: { id, ...notDeleted },
    include: { _count: { select: { attachments: true } } },
  });
  if (!row) return null;
  return mapDailyReport(row);
}

export async function findActiveReportForDay(
  dryDockProjectId: string,
  reportDate: Date,
  excludeId?: string,
) {
  return prisma.ddDailyReport.findFirst({
    where: {
      dryDockProjectId,
      reportDate,
      ...notDeleted,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
}

export async function createDdDailyReport(input: {
  dryDockProjectId: string;
  reportDate: Date | string;
  weatherCondition?: string | null;
  sections?: unknown;
  completedWork?: string | null;
  plannedWork?: string | null;
  manpowerCount?: number | null;
  safetyNotes?: string | null;
  delayNotes?: string | null;
  progressPct?: number | null;
}) {
  const reportDate = normalizeReportDate(input.reportDate);
  const sections = input.sections
    ? normalizeDailyReportSections(input.sections)
    : emptyDailyReportSections();

  const row = await prisma.ddDailyReport.create({
    data: {
      dryDockProjectId: input.dryDockProjectId,
      reportDate,
      weatherCondition: input.weatherCondition?.trim() || null,
      sectionsJson: sectionsToJson(sections),
      completedWork: input.completedWork?.trim() || null,
      plannedWork: input.plannedWork?.trim() || null,
      manpowerCount: input.manpowerCount ?? null,
      safetyNotes: input.safetyNotes?.trim() || null,
      delayNotes: input.delayNotes?.trim() || null,
      progressPct: input.progressPct ?? null,
    },
    include: { _count: { select: { attachments: true } } },
  });
  return mapDailyReport(row);
}

export async function updateDdDailyReport(
  id: string,
  input: Partial<{
    dryDockProjectId: string;
    reportDate: Date | string;
    weatherCondition: string | null;
    sections: unknown;
    completedWork: string | null;
    plannedWork: string | null;
    manpowerCount: number | null;
    safetyNotes: string | null;
    delayNotes: string | null;
    progressPct: number | null;
  }>,
) {
  const row = await prisma.ddDailyReport.update({
    where: { id },
    data: {
      ...(input.dryDockProjectId != null ? { dryDockProjectId: input.dryDockProjectId } : {}),
      ...(input.reportDate != null ? { reportDate: normalizeReportDate(input.reportDate) } : {}),
      ...(input.weatherCondition !== undefined
        ? { weatherCondition: input.weatherCondition?.trim() || null }
        : {}),
      ...(input.sections !== undefined
        ? { sectionsJson: sectionsToJson(normalizeDailyReportSections(input.sections)) }
        : {}),
      ...(input.completedWork !== undefined ? { completedWork: input.completedWork?.trim() || null } : {}),
      ...(input.plannedWork !== undefined ? { plannedWork: input.plannedWork?.trim() || null } : {}),
      ...(input.manpowerCount !== undefined ? { manpowerCount: input.manpowerCount } : {}),
      ...(input.safetyNotes !== undefined ? { safetyNotes: input.safetyNotes?.trim() || null } : {}),
      ...(input.delayNotes !== undefined ? { delayNotes: input.delayNotes?.trim() || null } : {}),
      ...(input.progressPct !== undefined ? { progressPct: input.progressPct } : {}),
    },
    include: { _count: { select: { attachments: true } } },
  });
  return mapDailyReport(row);
}

export async function deleteDdDailyReport(id: string) {
  await prisma.ddDailyReport.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export { mapDailyReport, resolveDailyReportSections, normalizeReportDate };
