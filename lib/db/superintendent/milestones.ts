import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted, parsePageLimit } from "@/lib/db/superintendent/pagination";
import type { DdMilestoneDto, ListQuery } from "@/lib/superintendent/types";

function mapMilestone(row: Prisma.DdMilestoneGetPayload<object>): DdMilestoneDto {
  return {
    id: row.id,
    dryDockProjectId: row.dryDockProjectId,
    title: row.title,
    plannedDate: row.plannedDate?.toISOString() ?? null,
    baselineDate: row.baselineDate?.toISOString() ?? null,
    actualDate: row.actualDate?.toISOString() ?? null,
    status: row.status,
    notes: row.notes,
    dependsOnMilestoneId: row.dependsOnMilestoneId,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildWhere(query: ListQuery): Prisma.DdMilestoneWhereInput {
  const where: Prisma.DdMilestoneWhereInput = { ...notDeleted };
  if (query.dryDockProjectId) where.dryDockProjectId = query.dryDockProjectId;
  if (query.status && query.status !== "all") where.status = query.status;
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { notes: { contains: query.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listDdMilestones(query: ListQuery = {}) {
  const { page, limit, skip } = parsePageLimit(query);
  const where = buildWhere(query);

  const [total, rows] = await Promise.all([
    prisma.ddMilestone.count({ where }),
    prisma.ddMilestone.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ sortOrder: "asc" }, { plannedDate: "asc" }],
    }),
  ]);

  return {
    milestones: rows.map(mapMilestone),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

export async function getDdMilestone(id: string) {
  const row = await prisma.ddMilestone.findFirst({ where: { id, ...notDeleted } });
  if (!row) return null;
  return mapMilestone(row);
}

export async function createDdMilestone(input: {
  dryDockProjectId: string;
  title: string;
  plannedDate?: Date | null;
  actualDate?: Date | null;
  status?: string;
  notes?: string | null;
  sortOrder?: number;
}) {
  const row = await prisma.ddMilestone.create({
    data: {
      dryDockProjectId: input.dryDockProjectId,
      title: input.title.trim(),
      plannedDate: input.plannedDate ?? null,
      actualDate: input.actualDate ?? null,
      status: input.status ?? "planned",
      notes: input.notes?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
    },
  });
  return mapMilestone(row);
}

export async function updateDdMilestone(
  id: string,
  input: Partial<{
    dryDockProjectId: string;
    title: string;
    plannedDate: Date | null;
    actualDate: Date | null;
    status: string;
    notes: string | null;
    sortOrder: number;
  }>,
) {
  const row = await prisma.ddMilestone.update({
    where: { id },
    data: {
      ...(input.dryDockProjectId != null ? { dryDockProjectId: input.dryDockProjectId } : {}),
      ...(input.title != null ? { title: input.title.trim() } : {}),
      ...(input.plannedDate !== undefined ? { plannedDate: input.plannedDate } : {}),
      ...(input.actualDate !== undefined ? { actualDate: input.actualDate } : {}),
      ...(input.status != null ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(input.sortOrder != null ? { sortOrder: input.sortOrder } : {}),
    },
  });
  return mapMilestone(row);
}

export async function deleteDdMilestone(id: string) {
  await prisma.ddMilestone.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
