import type { DdJobPriority, DdJobStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted, parsePageLimit } from "@/lib/db/superintendent/pagination";
import type { DdJobDto, ListQuery } from "@/lib/superintendent/types";

function mapJob(row: Prisma.DdJobGetPayload<object>): DdJobDto {
  return {
    id: row.id,
    dryDockProjectId: row.dryDockProjectId,
    jobCode: row.jobCode,
    title: row.title,
    category: row.category,
    description: row.description,
    workshop: row.workshop,
    priority: row.priority,
    status: row.status,
    progressPct: row.progressPct,
    budgetAmount: row.budgetAmount,
    quotedAmount: row.quotedAmount,
    actualAmount: row.actualAmount,
    responsibleParty: row.responsibleParty,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildWhere(query: ListQuery): Prisma.DdJobWhereInput {
  const where: Prisma.DdJobWhereInput = { ...notDeleted };
  if (query.dryDockProjectId) where.dryDockProjectId = query.dryDockProjectId;
  if (query.category) where.category = query.category;
  if (query.status && query.status !== "all") {
    where.status = query.status as DdJobStatus;
  }
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { jobCode: { contains: query.search, mode: "insensitive" } },
      { category: { contains: query.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listDdJobs(query: ListQuery = {}) {
  const { page, limit, skip } = parsePageLimit(query);
  const where = buildWhere(query);

  const [total, rows] = await Promise.all([
    prisma.ddJob.count({ where }),
    prisma.ddJob.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    }),
  ]);

  return {
    jobs: rows.map(mapJob),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

export async function getDdJob(id: string) {
  const row = await prisma.ddJob.findFirst({ where: { id, ...notDeleted } });
  if (!row) return null;
  return mapJob(row);
}

export async function createDdJob(input: {
  dryDockProjectId: string;
  jobCode?: string | null;
  title: string;
  category: string;
  description?: string | null;
  workshop?: string | null;
  priority?: DdJobPriority;
  status?: DdJobStatus;
  progressPct?: number | null;
  budgetAmount?: number | null;
  quotedAmount?: number | null;
  actualAmount?: number | null;
  responsibleParty?: string | null;
  sortOrder?: number;
}) {
  const row = await prisma.ddJob.create({
    data: {
      dryDockProjectId: input.dryDockProjectId,
      jobCode: input.jobCode?.trim() || null,
      title: input.title.trim(),
      category: input.category.trim(),
      description: input.description?.trim() || null,
      workshop: input.workshop?.trim() || null,
      priority: input.priority ?? "medium",
      status: input.status ?? "planned",
      progressPct: input.progressPct ?? 0,
      budgetAmount: input.budgetAmount ?? null,
      quotedAmount: input.quotedAmount ?? null,
      actualAmount: input.actualAmount ?? null,
      responsibleParty: input.responsibleParty?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
    },
  });
  return mapJob(row);
}

export async function updateDdJob(
  id: string,
  input: Partial<{
    dryDockProjectId: string;
    jobCode: string | null;
    title: string;
    category: string;
    description: string | null;
    workshop: string | null;
    priority: DdJobPriority;
    status: DdJobStatus;
    progressPct: number | null;
    budgetAmount: number | null;
    quotedAmount: number | null;
    actualAmount: number | null;
    responsibleParty: string | null;
    sortOrder: number;
  }>,
) {
  const row = await prisma.ddJob.update({
    where: { id },
    data: {
      ...(input.dryDockProjectId != null ? { dryDockProjectId: input.dryDockProjectId } : {}),
      ...(input.jobCode !== undefined ? { jobCode: input.jobCode?.trim() || null } : {}),
      ...(input.title != null ? { title: input.title.trim() } : {}),
      ...(input.category != null ? { category: input.category.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.workshop !== undefined ? { workshop: input.workshop?.trim() || null } : {}),
      ...(input.priority != null ? { priority: input.priority } : {}),
      ...(input.status != null ? { status: input.status } : {}),
      ...(input.progressPct !== undefined ? { progressPct: input.progressPct } : {}),
      ...(input.budgetAmount !== undefined ? { budgetAmount: input.budgetAmount } : {}),
      ...(input.quotedAmount !== undefined ? { quotedAmount: input.quotedAmount } : {}),
      ...(input.actualAmount !== undefined ? { actualAmount: input.actualAmount } : {}),
      ...(input.responsibleParty !== undefined
        ? { responsibleParty: input.responsibleParty?.trim() || null }
        : {}),
      ...(input.sortOrder != null ? { sortOrder: input.sortOrder } : {}),
    },
  });
  return mapJob(row);
}

export async function deleteDdJob(id: string) {
  await prisma.ddJob.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
