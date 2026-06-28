import type { DdApprovalStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted, parsePageLimit } from "@/lib/db/superintendent/pagination";
import type { DdBudgetLineDto, ListQuery } from "@/lib/superintendent/types";

function mapBudgetLine(row: Prisma.DdBudgetLineGetPayload<object>): DdBudgetLineDto {
  return {
    id: row.id,
    dryDockProjectId: row.dryDockProjectId,
    category: row.category,
    description: row.description,
    budgetAmount: row.budgetAmount,
    quotedAmount: row.quotedAmount,
    approvedAmount: row.approvedAmount,
    actualAmount: row.actualAmount,
    responsibleParty: row.responsibleParty,
    varianceReason: row.varianceReason,
    approvalStatus: row.approvalStatus,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildWhere(query: ListQuery): Prisma.DdBudgetLineWhereInput {
  const where: Prisma.DdBudgetLineWhereInput = { ...notDeleted };
  if (query.dryDockProjectId) where.dryDockProjectId = query.dryDockProjectId;
  if (query.category) where.category = query.category;
  if (query.status && query.status !== "all") {
    where.approvalStatus = query.status as DdApprovalStatus;
  }
  if (query.search) {
    where.OR = [
      { category: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listDdBudgetLines(query: ListQuery = {}) {
  const { page, limit, skip } = parsePageLimit(query);
  const where = buildWhere(query);

  const [total, rows] = await Promise.all([
    prisma.ddBudgetLine.count({ where }),
    prisma.ddBudgetLine.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ sortOrder: "asc" }, { category: "asc" }],
    }),
  ]);

  return {
    budgetLines: rows.map(mapBudgetLine),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

export async function getDdBudgetLine(id: string) {
  const row = await prisma.ddBudgetLine.findFirst({ where: { id, ...notDeleted } });
  if (!row) return null;
  return mapBudgetLine(row);
}

export async function createDdBudgetLine(input: {
  dryDockProjectId: string;
  category: string;
  description?: string | null;
  budgetAmount?: number;
  quotedAmount?: number | null;
  approvedAmount?: number | null;
  actualAmount?: number | null;
  responsibleParty?: string | null;
  varianceReason?: string | null;
  approvalStatus?: DdApprovalStatus;
  sortOrder?: number;
}) {
  const row = await prisma.ddBudgetLine.create({
    data: {
      dryDockProjectId: input.dryDockProjectId,
      category: input.category.trim(),
      description: input.description?.trim() || null,
      budgetAmount: input.budgetAmount ?? 0,
      quotedAmount: input.quotedAmount ?? null,
      approvedAmount: input.approvedAmount ?? null,
      actualAmount: input.actualAmount ?? null,
      responsibleParty: input.responsibleParty?.trim() || null,
      varianceReason: input.varianceReason?.trim() || null,
      approvalStatus: input.approvalStatus ?? "pending",
      sortOrder: input.sortOrder ?? 0,
    },
  });
  return mapBudgetLine(row);
}

export async function updateDdBudgetLine(
  id: string,
  input: Partial<{
    dryDockProjectId: string;
    category: string;
    description: string | null;
    budgetAmount: number;
    quotedAmount: number | null;
    approvedAmount: number | null;
    actualAmount: number | null;
    responsibleParty: string | null;
    varianceReason: string | null;
    approvalStatus: DdApprovalStatus;
    sortOrder: number;
  }>,
) {
  const row = await prisma.ddBudgetLine.update({
    where: { id },
    data: {
      ...(input.dryDockProjectId != null ? { dryDockProjectId: input.dryDockProjectId } : {}),
      ...(input.category != null ? { category: input.category.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.budgetAmount != null ? { budgetAmount: input.budgetAmount } : {}),
      ...(input.quotedAmount !== undefined ? { quotedAmount: input.quotedAmount } : {}),
      ...(input.approvedAmount !== undefined ? { approvedAmount: input.approvedAmount } : {}),
      ...(input.actualAmount !== undefined ? { actualAmount: input.actualAmount } : {}),
      ...(input.responsibleParty !== undefined
        ? { responsibleParty: input.responsibleParty?.trim() || null }
        : {}),
      ...(input.varianceReason !== undefined
        ? { varianceReason: input.varianceReason?.trim() || null }
        : {}),
      ...(input.approvalStatus != null ? { approvalStatus: input.approvalStatus } : {}),
      ...(input.sortOrder != null ? { sortOrder: input.sortOrder } : {}),
    },
  });
  return mapBudgetLine(row);
}

export async function deleteDdBudgetLine(id: string) {
  await prisma.ddBudgetLine.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
