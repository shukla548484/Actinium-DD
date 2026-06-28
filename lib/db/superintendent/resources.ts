import type { DdResourceStatus, DdResourceType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted, parsePageLimit } from "@/lib/db/superintendent/pagination";
import type { DdResourceAllocationDto, ListQuery } from "@/lib/superintendent/types";

function mapResource(row: Prisma.DdResourceAllocationGetPayload<object>): DdResourceAllocationDto {
  return {
    id: row.id,
    dryDockProjectId: row.dryDockProjectId,
    title: row.title,
    resourceType: row.resourceType,
    quantity: row.quantity,
    unit: row.unit,
    status: row.status,
    startDate: row.startDate?.toISOString() ?? null,
    endDate: row.endDate?.toISOString() ?? null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listDdResourceAllocations(query: ListQuery = {}) {
  const { page, limit, skip } = parsePageLimit(query);
  const where: Prisma.DdResourceAllocationWhereInput = { ...notDeleted };
  if (query.dryDockProjectId) where.dryDockProjectId = query.dryDockProjectId;
  if (query.status && query.status !== "all") {
    where.status = query.status as DdResourceStatus;
  }
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { notes: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.ddResourceAllocation.count({ where }),
    prisma.ddResourceAllocation.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ startDate: "asc" }, { title: "asc" }],
    }),
  ]);

  return {
    resources: rows.map(mapResource),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

export async function createDdResourceAllocation(input: {
  dryDockProjectId: string;
  title: string;
  resourceType?: DdResourceType;
  quantity?: number;
  unit?: string | null;
  status?: DdResourceStatus;
  startDate?: Date | null;
  endDate?: Date | null;
  notes?: string | null;
}) {
  const row = await prisma.ddResourceAllocation.create({
    data: {
      dryDockProjectId: input.dryDockProjectId,
      title: input.title.trim(),
      resourceType: input.resourceType ?? "other",
      quantity: input.quantity ?? 1,
      unit: input.unit?.trim() || null,
      status: input.status ?? "planned",
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      notes: input.notes?.trim() || null,
    },
  });
  return mapResource(row);
}

export async function updateDdResourceAllocation(
  id: string,
  input: Partial<{
    title: string;
    resourceType: DdResourceType;
    quantity: number;
    unit: string | null;
    status: DdResourceStatus;
    startDate: Date | null;
    endDate: Date | null;
    notes: string | null;
  }>,
) {
  const row = await prisma.ddResourceAllocation.update({
    where: { id },
    data: {
      ...(input.title != null ? { title: input.title.trim() } : {}),
      ...(input.resourceType != null ? { resourceType: input.resourceType } : {}),
      ...(input.quantity != null ? { quantity: input.quantity } : {}),
      ...(input.unit !== undefined ? { unit: input.unit?.trim() || null } : {}),
      ...(input.status != null ? { status: input.status } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    },
  });
  return mapResource(row);
}

export async function deleteDdResourceAllocation(id: string) {
  await prisma.ddResourceAllocation.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
