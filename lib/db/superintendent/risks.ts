import type { DdRiskLevel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted, parsePageLimit } from "@/lib/db/superintendent/pagination";
import type { DdRiskItemDto, ListQuery } from "@/lib/superintendent/types";

function mapRiskItem(row: Prisma.DdRiskItemGetPayload<object>): DdRiskItemDto {
  return {
    id: row.id,
    dryDockProjectId: row.dryDockProjectId,
    title: row.title,
    description: row.description,
    likelihood: row.likelihood,
    impact: row.impact,
    mitigation: row.mitigation,
    owner: row.owner,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildWhere(query: ListQuery): Prisma.DdRiskItemWhereInput {
  const where: Prisma.DdRiskItemWhereInput = { ...notDeleted };
  if (query.dryDockProjectId) where.dryDockProjectId = query.dryDockProjectId;
  if (query.status && query.status !== "all") where.status = query.status;
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
      { owner: { contains: query.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listDdRiskItems(query: ListQuery = {}) {
  const { page, limit, skip } = parsePageLimit(query);
  const where = buildWhere(query);

  const [total, rows] = await Promise.all([
    prisma.ddRiskItem.count({ where }),
    prisma.ddRiskItem.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ status: "asc" }, { title: "asc" }],
    }),
  ]);

  return {
    risks: rows.map(mapRiskItem),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

export async function getDdRiskItem(id: string) {
  const row = await prisma.ddRiskItem.findFirst({ where: { id, ...notDeleted } });
  if (!row) return null;
  return mapRiskItem(row);
}

export async function createDdRiskItem(input: {
  dryDockProjectId: string;
  title: string;
  description?: string | null;
  likelihood?: DdRiskLevel;
  impact?: DdRiskLevel;
  mitigation?: string | null;
  owner?: string | null;
  status?: string;
}) {
  const row = await prisma.ddRiskItem.create({
    data: {
      dryDockProjectId: input.dryDockProjectId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      likelihood: input.likelihood ?? "medium",
      impact: input.impact ?? "medium",
      mitigation: input.mitigation?.trim() || null,
      owner: input.owner?.trim() || null,
      status: input.status ?? "open",
    },
  });
  return mapRiskItem(row);
}

export async function updateDdRiskItem(
  id: string,
  input: Partial<{
    dryDockProjectId: string;
    title: string;
    description: string | null;
    likelihood: DdRiskLevel;
    impact: DdRiskLevel;
    mitigation: string | null;
    owner: string | null;
    status: string;
  }>,
) {
  const row = await prisma.ddRiskItem.update({
    where: { id },
    data: {
      ...(input.dryDockProjectId != null ? { dryDockProjectId: input.dryDockProjectId } : {}),
      ...(input.title != null ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.likelihood != null ? { likelihood: input.likelihood } : {}),
      ...(input.impact != null ? { impact: input.impact } : {}),
      ...(input.mitigation !== undefined ? { mitigation: input.mitigation?.trim() || null } : {}),
      ...(input.owner !== undefined ? { owner: input.owner?.trim() || null } : {}),
      ...(input.status != null ? { status: input.status } : {}),
    },
  });
  return mapRiskItem(row);
}

export async function deleteDdRiskItem(id: string) {
  await prisma.ddRiskItem.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
