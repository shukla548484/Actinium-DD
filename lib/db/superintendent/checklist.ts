import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted, parsePageLimit } from "@/lib/db/superintendent/pagination";
import type { DdChecklistItemDto, ListQuery } from "@/lib/superintendent/types";

function mapChecklistItem(row: Prisma.DdChecklistItemGetPayload<object>): DdChecklistItemDto {
  return {
    id: row.id,
    dryDockProjectId: row.dryDockProjectId,
    title: row.title,
    category: row.category,
    isCompleted: row.isCompleted,
    dueDate: row.dueDate?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    assignedTo: row.assignedTo,
    notes: row.notes,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildWhere(query: ListQuery): Prisma.DdChecklistItemWhereInput {
  const where: Prisma.DdChecklistItemWhereInput = { ...notDeleted };
  if (query.dryDockProjectId) where.dryDockProjectId = query.dryDockProjectId;
  if (query.category) where.category = query.category;
  if (query.status === "completed") where.isCompleted = true;
  if (query.status === "pending") where.isCompleted = false;
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { category: { contains: query.search, mode: "insensitive" } },
      { assignedTo: { contains: query.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listDdChecklistItems(query: ListQuery = {}) {
  const { page, limit, skip } = parsePageLimit(query);
  const where = buildWhere(query);

  const [total, rows] = await Promise.all([
    prisma.ddChecklistItem.count({ where }),
    prisma.ddChecklistItem.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    }),
  ]);

  return {
    checklistItems: rows.map(mapChecklistItem),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

export async function getDdChecklistItem(id: string) {
  const row = await prisma.ddChecklistItem.findFirst({ where: { id, ...notDeleted } });
  if (!row) return null;
  return mapChecklistItem(row);
}

export async function createDdChecklistItem(input: {
  dryDockProjectId: string;
  title: string;
  category?: string | null;
  isCompleted?: boolean;
  dueDate?: Date | null;
  completedAt?: Date | null;
  assignedTo?: string | null;
  notes?: string | null;
  sortOrder?: number;
}) {
  const row = await prisma.ddChecklistItem.create({
    data: {
      dryDockProjectId: input.dryDockProjectId,
      title: input.title.trim(),
      category: input.category?.trim() || null,
      isCompleted: input.isCompleted ?? false,
      dueDate: input.dueDate ?? null,
      completedAt: input.completedAt ?? null,
      assignedTo: input.assignedTo?.trim() || null,
      notes: input.notes?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
    },
  });
  return mapChecklistItem(row);
}

export async function updateDdChecklistItem(
  id: string,
  input: Partial<{
    dryDockProjectId: string;
    title: string;
    category: string | null;
    isCompleted: boolean;
    dueDate: Date | null;
    completedAt: Date | null;
    assignedTo: string | null;
    notes: string | null;
    sortOrder: number;
  }>,
) {
  const row = await prisma.ddChecklistItem.update({
    where: { id },
    data: {
      ...(input.dryDockProjectId != null ? { dryDockProjectId: input.dryDockProjectId } : {}),
      ...(input.title != null ? { title: input.title.trim() } : {}),
      ...(input.category !== undefined ? { category: input.category?.trim() || null } : {}),
      ...(input.isCompleted != null ? { isCompleted: input.isCompleted } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
      ...(input.completedAt !== undefined ? { completedAt: input.completedAt } : {}),
      ...(input.assignedTo !== undefined ? { assignedTo: input.assignedTo?.trim() || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(input.sortOrder != null ? { sortOrder: input.sortOrder } : {}),
    },
  });
  return mapChecklistItem(row);
}

export async function deleteDdChecklistItem(id: string) {
  await prisma.ddChecklistItem.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
