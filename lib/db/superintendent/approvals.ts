import type { DdApprovalStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted, parsePageLimit } from "@/lib/db/superintendent/pagination";
import type { DdApprovalRequestDto, ListQuery } from "@/lib/superintendent/types";

function mapApprovalRequest(row: Prisma.DdApprovalRequestGetPayload<object>): DdApprovalRequestDto {
  return {
    id: row.id,
    dryDockProjectId: row.dryDockProjectId,
    approvalType: row.approvalType,
    title: row.title,
    description: row.description,
    amount: row.amount,
    status: row.status,
    requestedBy: row.requestedBy,
    approvedBy: row.approvedBy,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildWhere(query: ListQuery): Prisma.DdApprovalRequestWhereInput {
  const where: Prisma.DdApprovalRequestWhereInput = { ...notDeleted };
  if (query.dryDockProjectId) where.dryDockProjectId = query.dryDockProjectId;
  if (query.category) where.approvalType = query.category;
  if (query.status && query.status !== "all") {
    where.status = query.status as DdApprovalStatus;
  }
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { approvalType: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listDdApprovalRequests(query: ListQuery = {}) {
  const { page, limit, skip } = parsePageLimit(query);
  const where = buildWhere(query);

  const [total, rows] = await Promise.all([
    prisma.ddApprovalRequest.count({ where }),
    prisma.ddApprovalRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  return {
    approvals: rows.map(mapApprovalRequest),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

export async function getDdApprovalRequest(id: string) {
  const row = await prisma.ddApprovalRequest.findFirst({ where: { id, ...notDeleted } });
  if (!row) return null;
  return mapApprovalRequest(row);
}

export async function createDdApprovalRequest(input: {
  dryDockProjectId: string;
  approvalType: string;
  title: string;
  description?: string | null;
  amount?: number | null;
  status?: DdApprovalStatus;
  requestedBy?: string | null;
  approvedBy?: string | null;
  decidedAt?: Date | null;
}) {
  const row = await prisma.ddApprovalRequest.create({
    data: {
      dryDockProjectId: input.dryDockProjectId,
      approvalType: input.approvalType.trim(),
      title: input.title.trim(),
      description: input.description?.trim() || null,
      amount: input.amount ?? null,
      status: input.status ?? "pending",
      requestedBy: input.requestedBy?.trim() || null,
      approvedBy: input.approvedBy?.trim() || null,
      decidedAt: input.decidedAt ?? null,
    },
  });
  return mapApprovalRequest(row);
}

export async function updateDdApprovalRequest(
  id: string,
  input: Partial<{
    dryDockProjectId: string;
    approvalType: string;
    title: string;
    description: string | null;
    amount: number | null;
    status: DdApprovalStatus;
    requestedBy: string | null;
    approvedBy: string | null;
    decidedAt: Date | null;
  }>,
) {
  const row = await prisma.ddApprovalRequest.update({
    where: { id },
    data: {
      ...(input.dryDockProjectId != null ? { dryDockProjectId: input.dryDockProjectId } : {}),
      ...(input.approvalType != null ? { approvalType: input.approvalType.trim() } : {}),
      ...(input.title != null ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.status != null ? { status: input.status } : {}),
      ...(input.requestedBy !== undefined ? { requestedBy: input.requestedBy?.trim() || null } : {}),
      ...(input.approvedBy !== undefined ? { approvedBy: input.approvedBy?.trim() || null } : {}),
      ...(input.decidedAt !== undefined ? { decidedAt: input.decidedAt } : {}),
    },
  });
  return mapApprovalRequest(row);
}

export async function deleteDdApprovalRequest(id: string) {
  await prisma.ddApprovalRequest.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
