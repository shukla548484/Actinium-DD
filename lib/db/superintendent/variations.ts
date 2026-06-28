import type { DdApprovalStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted, parsePageLimit } from "@/lib/db/superintendent/pagination";
import type { DdVariationOrderDto, ListQuery } from "@/lib/superintendent/types";

function mapVariationOrder(row: Prisma.DdVariationOrderGetPayload<object>): DdVariationOrderDto {
  return {
    id: row.id,
    dryDockProjectId: row.dryDockProjectId,
    voNumber: row.voNumber,
    title: row.title,
    description: row.description,
    amount: row.amount,
    approvalStatus: row.approvalStatus,
    requestedBy: row.requestedBy,
    approvedBy: row.approvedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildWhere(query: ListQuery): Prisma.DdVariationOrderWhereInput {
  const where: Prisma.DdVariationOrderWhereInput = { ...notDeleted };
  if (query.dryDockProjectId) where.dryDockProjectId = query.dryDockProjectId;
  if (query.status && query.status !== "all") {
    where.approvalStatus = query.status as DdApprovalStatus;
  }
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { voNumber: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listDdVariationOrders(query: ListQuery = {}) {
  const { page, limit, skip } = parsePageLimit(query);
  const where = buildWhere(query);

  const [total, rows] = await Promise.all([
    prisma.ddVariationOrder.count({ where }),
    prisma.ddVariationOrder.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    variations: rows.map(mapVariationOrder),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

export async function getDdVariationOrder(id: string) {
  const row = await prisma.ddVariationOrder.findFirst({ where: { id, ...notDeleted } });
  if (!row) return null;
  return mapVariationOrder(row);
}

export async function createDdVariationOrder(input: {
  dryDockProjectId: string;
  voNumber?: string | null;
  title: string;
  description?: string | null;
  amount?: number;
  approvalStatus?: DdApprovalStatus;
  requestedBy?: string | null;
  approvedBy?: string | null;
}) {
  const row = await prisma.ddVariationOrder.create({
    data: {
      dryDockProjectId: input.dryDockProjectId,
      voNumber: input.voNumber?.trim() || null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      amount: input.amount ?? 0,
      approvalStatus: input.approvalStatus ?? "pending",
      requestedBy: input.requestedBy?.trim() || null,
      approvedBy: input.approvedBy?.trim() || null,
    },
  });
  return mapVariationOrder(row);
}

export async function updateDdVariationOrder(
  id: string,
  input: Partial<{
    dryDockProjectId: string;
    voNumber: string | null;
    title: string;
    description: string | null;
    amount: number;
    approvalStatus: DdApprovalStatus;
    requestedBy: string | null;
    approvedBy: string | null;
  }>,
) {
  const row = await prisma.ddVariationOrder.update({
    where: { id },
    data: {
      ...(input.dryDockProjectId != null ? { dryDockProjectId: input.dryDockProjectId } : {}),
      ...(input.voNumber !== undefined ? { voNumber: input.voNumber?.trim() || null } : {}),
      ...(input.title != null ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.amount != null ? { amount: input.amount } : {}),
      ...(input.approvalStatus != null ? { approvalStatus: input.approvalStatus } : {}),
      ...(input.requestedBy !== undefined ? { requestedBy: input.requestedBy?.trim() || null } : {}),
      ...(input.approvedBy !== undefined ? { approvedBy: input.approvedBy?.trim() || null } : {}),
    },
  });
  return mapVariationOrder(row);
}

export async function deleteDdVariationOrder(id: string) {
  await prisma.ddVariationOrder.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
