import type { DdSurveyStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted, parsePageLimit } from "@/lib/db/superintendent/pagination";
import type { DdSurveyItemDto, ListQuery } from "@/lib/superintendent/types";

function mapSurveyItem(row: Prisma.DdSurveyItemGetPayload<object>): DdSurveyItemDto {
  return {
    id: row.id,
    dryDockProjectId: row.dryDockProjectId,
    surveyType: row.surveyType,
    title: row.title,
    description: row.description,
    dueDate: row.dueDate?.toISOString() ?? null,
    status: row.status,
    classReference: row.classReference,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildWhere(query: ListQuery): Prisma.DdSurveyItemWhereInput {
  const where: Prisma.DdSurveyItemWhereInput = { ...notDeleted };
  if (query.dryDockProjectId) where.dryDockProjectId = query.dryDockProjectId;
  if (query.category) where.surveyType = query.category;
  if (query.status && query.status !== "all") {
    where.status = query.status as DdSurveyStatus;
  }
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { surveyType: { contains: query.search, mode: "insensitive" } },
      { classReference: { contains: query.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listDdSurveyItems(query: ListQuery = {}) {
  const { page, limit, skip } = parsePageLimit(query);
  const where = buildWhere(query);

  const [total, rows] = await Promise.all([
    prisma.ddSurveyItem.count({ where }),
    prisma.ddSurveyItem.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ dueDate: "asc" }, { title: "asc" }],
    }),
  ]);

  return {
    surveyItems: rows.map(mapSurveyItem),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

export async function getDdSurveyItem(id: string) {
  const row = await prisma.ddSurveyItem.findFirst({ where: { id, ...notDeleted } });
  if (!row) return null;
  return mapSurveyItem(row);
}

export async function createDdSurveyItem(input: {
  dryDockProjectId: string;
  surveyType: string;
  title: string;
  description?: string | null;
  dueDate?: Date | null;
  status?: DdSurveyStatus;
  classReference?: string | null;
}) {
  const row = await prisma.ddSurveyItem.create({
    data: {
      dryDockProjectId: input.dryDockProjectId,
      surveyType: input.surveyType.trim(),
      title: input.title.trim(),
      description: input.description?.trim() || null,
      dueDate: input.dueDate ?? null,
      status: input.status ?? "pending",
      classReference: input.classReference?.trim() || null,
    },
  });
  return mapSurveyItem(row);
}

export async function updateDdSurveyItem(
  id: string,
  input: Partial<{
    dryDockProjectId: string;
    surveyType: string;
    title: string;
    description: string | null;
    dueDate: Date | null;
    status: DdSurveyStatus;
    classReference: string | null;
  }>,
) {
  const row = await prisma.ddSurveyItem.update({
    where: { id },
    data: {
      ...(input.dryDockProjectId != null ? { dryDockProjectId: input.dryDockProjectId } : {}),
      ...(input.surveyType != null ? { surveyType: input.surveyType.trim() } : {}),
      ...(input.title != null ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
      ...(input.status != null ? { status: input.status } : {}),
      ...(input.classReference !== undefined
        ? { classReference: input.classReference?.trim() || null }
        : {}),
    },
  });
  return mapSurveyItem(row);
}

export async function deleteDdSurveyItem(id: string) {
  await prisma.ddSurveyItem.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
