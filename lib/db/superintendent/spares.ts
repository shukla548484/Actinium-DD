import type { DdSparesStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted, parsePageLimit } from "@/lib/db/superintendent/pagination";
import type { DdSparesItemDto, ListQuery } from "@/lib/superintendent/types";

function mapSparesItem(row: Prisma.DdSparesItemGetPayload<object>): DdSparesItemDto {
  return {
    id: row.id,
    dryDockProjectId: row.dryDockProjectId,
    partName: row.partName,
    partNumber: row.partNumber,
    quantity: row.quantity,
    supplyType: row.supplyType,
    status: row.status,
    requiredDate: row.requiredDate?.toISOString() ?? null,
    deliveredDate: row.deliveredDate?.toISOString() ?? null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildWhere(query: ListQuery): Prisma.DdSparesItemWhereInput {
  const where: Prisma.DdSparesItemWhereInput = { ...notDeleted };
  if (query.dryDockProjectId) where.dryDockProjectId = query.dryDockProjectId;
  if (query.status && query.status !== "all") {
    where.status = query.status as DdSparesStatus;
  }
  if (query.search) {
    where.OR = [
      { partName: { contains: query.search, mode: "insensitive" } },
      { partNumber: { contains: query.search, mode: "insensitive" } },
      { notes: { contains: query.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listDdSparesItems(query: ListQuery = {}) {
  const { page, limit, skip } = parsePageLimit(query);
  const where = buildWhere(query);

  const [total, rows] = await Promise.all([
    prisma.ddSparesItem.count({ where }),
    prisma.ddSparesItem.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ requiredDate: "asc" }, { partName: "asc" }],
    }),
  ]);

  return {
    sparesItems: rows.map(mapSparesItem),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

export async function getDdSparesItem(id: string) {
  const row = await prisma.ddSparesItem.findFirst({ where: { id, ...notDeleted } });
  if (!row) return null;
  return mapSparesItem(row);
}

export async function createDdSparesItem(input: {
  dryDockProjectId: string;
  partName: string;
  partNumber?: string | null;
  quantity?: number;
  supplyType?: string;
  status?: DdSparesStatus;
  requiredDate?: Date | null;
  deliveredDate?: Date | null;
  notes?: string | null;
}) {
  const row = await prisma.ddSparesItem.create({
    data: {
      dryDockProjectId: input.dryDockProjectId,
      partName: input.partName.trim(),
      partNumber: input.partNumber?.trim() || null,
      quantity: input.quantity ?? 1,
      supplyType: input.supplyType ?? "owner",
      status: input.status ?? "required",
      requiredDate: input.requiredDate ?? null,
      deliveredDate: input.deliveredDate ?? null,
      notes: input.notes?.trim() || null,
    },
  });
  return mapSparesItem(row);
}

export async function updateDdSparesItem(
  id: string,
  input: Partial<{
    dryDockProjectId: string;
    partName: string;
    partNumber: string | null;
    quantity: number;
    supplyType: string;
    status: DdSparesStatus;
    requiredDate: Date | null;
    deliveredDate: Date | null;
    notes: string | null;
  }>,
) {
  const row = await prisma.ddSparesItem.update({
    where: { id },
    data: {
      ...(input.dryDockProjectId != null ? { dryDockProjectId: input.dryDockProjectId } : {}),
      ...(input.partName != null ? { partName: input.partName.trim() } : {}),
      ...(input.partNumber !== undefined ? { partNumber: input.partNumber?.trim() || null } : {}),
      ...(input.quantity != null ? { quantity: input.quantity } : {}),
      ...(input.supplyType != null ? { supplyType: input.supplyType } : {}),
      ...(input.status != null ? { status: input.status } : {}),
      ...(input.requiredDate !== undefined ? { requiredDate: input.requiredDate } : {}),
      ...(input.deliveredDate !== undefined ? { deliveredDate: input.deliveredDate } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    },
  });
  return mapSparesItem(row);
}

export async function deleteDdSparesItem(id: string) {
  await prisma.ddSparesItem.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
