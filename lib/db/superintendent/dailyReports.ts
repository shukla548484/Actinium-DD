import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted, parsePageLimit } from "@/lib/db/superintendent/pagination";
import type { DdDailyReportDto, ListQuery } from "@/lib/superintendent/types";

function mapDailyReport(row: Prisma.DdDailyReportGetPayload<object>): DdDailyReportDto {
  return {
    id: row.id,
    dryDockProjectId: row.dryDockProjectId,
    reportDate: row.reportDate.toISOString(),
    completedWork: row.completedWork,
    plannedWork: row.plannedWork,
    manpowerCount: row.manpowerCount,
    safetyNotes: row.safetyNotes,
    delayNotes: row.delayNotes,
    progressPct: row.progressPct,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildWhere(query: ListQuery): Prisma.DdDailyReportWhereInput {
  const where: Prisma.DdDailyReportWhereInput = { ...notDeleted };
  if (query.dryDockProjectId) where.dryDockProjectId = query.dryDockProjectId;
  if (query.search) {
    where.OR = [
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
  const row = await prisma.ddDailyReport.findFirst({ where: { id, ...notDeleted } });
  if (!row) return null;
  return mapDailyReport(row);
}

export async function createDdDailyReport(input: {
  dryDockProjectId: string;
  reportDate: Date;
  completedWork?: string | null;
  plannedWork?: string | null;
  manpowerCount?: number | null;
  safetyNotes?: string | null;
  delayNotes?: string | null;
  progressPct?: number | null;
}) {
  const row = await prisma.ddDailyReport.create({
    data: {
      dryDockProjectId: input.dryDockProjectId,
      reportDate: input.reportDate,
      completedWork: input.completedWork?.trim() || null,
      plannedWork: input.plannedWork?.trim() || null,
      manpowerCount: input.manpowerCount ?? null,
      safetyNotes: input.safetyNotes?.trim() || null,
      delayNotes: input.delayNotes?.trim() || null,
      progressPct: input.progressPct ?? null,
    },
  });
  return mapDailyReport(row);
}

export async function updateDdDailyReport(
  id: string,
  input: Partial<{
    dryDockProjectId: string;
    reportDate: Date;
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
      ...(input.reportDate != null ? { reportDate: input.reportDate } : {}),
      ...(input.completedWork !== undefined ? { completedWork: input.completedWork?.trim() || null } : {}),
      ...(input.plannedWork !== undefined ? { plannedWork: input.plannedWork?.trim() || null } : {}),
      ...(input.manpowerCount !== undefined ? { manpowerCount: input.manpowerCount } : {}),
      ...(input.safetyNotes !== undefined ? { safetyNotes: input.safetyNotes?.trim() || null } : {}),
      ...(input.delayNotes !== undefined ? { delayNotes: input.delayNotes?.trim() || null } : {}),
      ...(input.progressPct !== undefined ? { progressPct: input.progressPct } : {}),
    },
  });
  return mapDailyReport(row);
}

export async function deleteDdDailyReport(id: string) {
  await prisma.ddDailyReport.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
