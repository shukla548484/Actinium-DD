import type { DdPoStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted, parsePageLimit } from "@/lib/db/superintendent/pagination";
import type { DdPurchaseOrderDto, ListQuery } from "@/lib/superintendent/types";

function mapPo(row: Prisma.DdPurchaseOrderGetPayload<object>): DdPurchaseOrderDto {
  return {
    id: row.id,
    dryDockProjectId: row.dryDockProjectId,
    poNumber: row.poNumber,
    supplier: row.supplier,
    description: row.description,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    orderedDate: row.orderedDate?.toISOString() ?? null,
    expectedDelivery: row.expectedDelivery?.toISOString() ?? null,
    deliveredDate: row.deliveredDate?.toISOString() ?? null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listDdPurchaseOrders(query: ListQuery = {}) {
  const { page, limit, skip } = parsePageLimit(query);
  const where: Prisma.DdPurchaseOrderWhereInput = { ...notDeleted };
  if (query.dryDockProjectId) where.dryDockProjectId = query.dryDockProjectId;
  if (query.status && query.status !== "all") {
    where.status = query.status as DdPoStatus;
  }
  if (query.search) {
    where.OR = [
      { poNumber: { contains: query.search, mode: "insensitive" } },
      { supplier: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.ddPurchaseOrder.count({ where }),
    prisma.ddPurchaseOrder.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ orderedDate: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return {
    purchaseOrders: rows.map(mapPo),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

export async function createDdPurchaseOrder(input: {
  dryDockProjectId: string;
  poNumber?: string | null;
  supplier?: string | null;
  description?: string | null;
  amount?: number;
  currency?: string;
  status?: DdPoStatus;
  orderedDate?: Date | null;
  expectedDelivery?: Date | null;
  deliveredDate?: Date | null;
  notes?: string | null;
}) {
  const row = await prisma.ddPurchaseOrder.create({
    data: {
      dryDockProjectId: input.dryDockProjectId,
      poNumber: input.poNumber?.trim() || null,
      supplier: input.supplier?.trim() || null,
      description: input.description?.trim() || null,
      amount: input.amount ?? 0,
      currency: input.currency ?? "USD",
      status: input.status ?? "draft",
      orderedDate: input.orderedDate ?? null,
      expectedDelivery: input.expectedDelivery ?? null,
      deliveredDate: input.deliveredDate ?? null,
      notes: input.notes?.trim() || null,
    },
  });
  return mapPo(row);
}

export async function updateDdPurchaseOrder(
  id: string,
  input: Partial<{
    poNumber: string | null;
    supplier: string | null;
    description: string | null;
    amount: number;
    currency: string;
    status: DdPoStatus;
    orderedDate: Date | null;
    expectedDelivery: Date | null;
    deliveredDate: Date | null;
    notes: string | null;
  }>,
) {
  const row = await prisma.ddPurchaseOrder.update({
    where: { id },
    data: {
      ...(input.poNumber !== undefined ? { poNumber: input.poNumber?.trim() || null } : {}),
      ...(input.supplier !== undefined ? { supplier: input.supplier?.trim() || null } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.amount != null ? { amount: input.amount } : {}),
      ...(input.currency != null ? { currency: input.currency } : {}),
      ...(input.status != null ? { status: input.status } : {}),
      ...(input.orderedDate !== undefined ? { orderedDate: input.orderedDate } : {}),
      ...(input.expectedDelivery !== undefined ? { expectedDelivery: input.expectedDelivery } : {}),
      ...(input.deliveredDate !== undefined ? { deliveredDate: input.deliveredDate } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    },
  });
  return mapPo(row);
}

export async function deleteDdPurchaseOrder(id: string) {
  await prisma.ddPurchaseOrder.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
