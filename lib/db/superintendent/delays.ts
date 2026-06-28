import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted, parsePageLimit } from "@/lib/db/superintendent/pagination";
import type { DdDelayItemDto, ListQuery } from "@/lib/superintendent/types";

function mapDelayItem(row: Prisma.DdDelayItemGetPayload<object>): DdDelayItemDto {
  return {
    id: row.id,
    dryDockProjectId: row.dryDockProjectId,
    title: row.title,
    reason: row.reason,
    impactDays: row.impactDays,
    responsibleParty: row.responsibleParty,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildWhere(query: ListQuery): Prisma.DdDelayItemWhereInput {
  const where: Prisma.DdDelayItemWhereInput = { ...notDeleted };
  if (query.dryDockProjectId) where.dryDockProjectId = query.dryDockProjectId;
  if (query.status && query.status !== "all") where.status = query.status;
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { reason: { contains: query.search, mode: "insensitive" } },
      { responsibleParty: { contains: query.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listDdDelayItems(query: ListQuery = {}) {
  const { page, limit, skip } = parsePageLimit(query);
  const where = buildWhere(query);

  const [total, rows] = await Promise.all([
    prisma.ddDelayItem.count({ where }),
    prisma.ddDelayItem.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  return {
    delays: rows.map(mapDelayItem),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

export async function getDdDelayItem(id: string) {
  const row = await prisma.ddDelayItem.findFirst({ where: { id, ...notDeleted } });
  if (!row) return null;
  return mapDelayItem(row);
}

export async function createDdDelayItem(input: {
  dryDockProjectId: string;
  title: string;
  reason?: string | null;
  impactDays?: number | null;
  responsibleParty?: string | null;
  status?: string;
}) {
  const row = await prisma.ddDelayItem.create({
    data: {
      dryDockProjectId: input.dryDockProjectId,
      title: input.title.trim(),
      reason: input.reason?.trim() || null,
      impactDays: input.impactDays ?? null,
      responsibleParty: input.responsibleParty?.trim() || null,
      status: input.status ?? "open",
    },
  });
  return mapDelayItem(row);
}

export async function updateDdDelayItem(
  id: string,
  input: Partial<{
    dryDockProjectId: string;
    title: string;
    reason: string | null;
    impactDays: number | null;
    responsibleParty: string | null;
    status: string;
  }>,
) {
  const row = await prisma.ddDelayItem.update({
    where: { id },
    data: {
      ...(input.dryDockProjectId != null ? { dryDockProjectId: input.dryDockProjectId } : {}),
      ...(input.title != null ? { title: input.title.trim() } : {}),
      ...(input.reason !== undefined ? { reason: input.reason?.trim() || null } : {}),
      ...(input.impactDays !== undefined ? { impactDays: input.impactDays } : {}),
      ...(input.responsibleParty !== undefined
        ? { responsibleParty: input.responsibleParty?.trim() || null }
        : {}),
      ...(input.status != null ? { status: input.status } : {}),
    },
  });
  return mapDelayItem(row);
}

export async function deleteDdDelayItem(id: string) {
  await prisma.ddDelayItem.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
