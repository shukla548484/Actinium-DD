import type { DdInvoiceStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/db/audit";
import { notDeleted, parsePageLimit } from "@/lib/db/superintendent/pagination";

export type DdInvoiceDto = {
  id: string;
  dryDockProjectId: string;
  purchaseOrderId: string | null;
  invoiceNumber: string | null;
  supplier: string | null;
  description: string | null;
  amount: number;
  currency: string;
  status: DdInvoiceStatus;
  invoiceDate: string | null;
  dueDate: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapInvoice(row: {
  id: string;
  dryDockProjectId: string;
  purchaseOrderId: string | null;
  invoiceNumber: string | null;
  supplier: string | null;
  description: string | null;
  amount: number;
  currency: string;
  status: DdInvoiceStatus;
  invoiceDate: Date | null;
  dueDate: Date | null;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): DdInvoiceDto {
  return {
    id: row.id,
    dryDockProjectId: row.dryDockProjectId,
    purchaseOrderId: row.purchaseOrderId,
    invoiceNumber: row.invoiceNumber,
    supplier: row.supplier,
    description: row.description,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    invoiceDate: row.invoiceDate?.toISOString() ?? null,
    dueDate: row.dueDate?.toISOString() ?? null,
    verifiedBy: row.verifiedBy,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listDdInvoices(query: {
  page?: number;
  limit?: number;
  dryDockProjectId?: string;
  status?: DdInvoiceStatus;
}) {
  const { page, limit, skip } = parsePageLimit(query);
  const where: Prisma.DdInvoiceWhereInput = {
    ...notDeleted,
    ...(query.dryDockProjectId ? { dryDockProjectId: query.dryDockProjectId } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.ddInvoice.count({ where }),
    prisma.ddInvoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return {
    invoices: rows.map(mapInvoice),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function createDdInvoice(input: {
  dryDockProjectId: string;
  purchaseOrderId?: string | null;
  invoiceNumber?: string | null;
  supplier?: string | null;
  description?: string | null;
  amount?: number;
  currency?: string;
  status?: DdInvoiceStatus;
  invoiceDate?: Date | null;
  dueDate?: Date | null;
  notes?: string | null;
}) {
  const row = await prisma.ddInvoice.create({
    data: {
      dryDockProjectId: input.dryDockProjectId,
      purchaseOrderId: input.purchaseOrderId ?? null,
      invoiceNumber: input.invoiceNumber ?? null,
      supplier: input.supplier ?? null,
      description: input.description ?? null,
      amount: input.amount ?? 0,
      currency: input.currency ?? "USD",
      status: input.status ?? "draft",
      invoiceDate: input.invoiceDate ?? null,
      dueDate: input.dueDate ?? null,
      notes: input.notes ?? null,
    },
  });

  await writeAuditLog({
    action: "create",
    entityType: "dd_invoice",
    entityId: row.id,
    summary: `Invoice ${row.invoiceNumber ?? row.id.slice(0, 8)} created`,
    metadata: { amount: row.amount, status: row.status },
  });

  return mapInvoice(row);
}

export async function updateDdInvoice(
  id: string,
  data: Partial<{
    invoiceNumber: string | null;
    supplier: string | null;
    description: string | null;
    amount: number;
    currency: string;
    status: DdInvoiceStatus;
    invoiceDate: Date | null;
    dueDate: Date | null;
    verifiedBy: string | null;
    verifiedAt: Date | null;
    notes: string | null;
  }>,
) {
  const row = await prisma.ddInvoice.update({
    where: { id },
    data: {
      ...(data.invoiceNumber !== undefined ? { invoiceNumber: data.invoiceNumber } : {}),
      ...(data.supplier !== undefined ? { supplier: data.supplier } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.currency !== undefined ? { currency: data.currency } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.invoiceDate !== undefined ? { invoiceDate: data.invoiceDate } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
      ...(data.verifiedBy !== undefined ? { verifiedBy: data.verifiedBy } : {}),
      ...(data.verifiedAt !== undefined ? { verifiedAt: data.verifiedAt } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    },
  });

  await writeAuditLog({
    action: "update",
    entityType: "dd_invoice",
    entityId: row.id,
    summary: `Invoice ${row.invoiceNumber ?? row.id.slice(0, 8)} → ${row.status}`,
    metadata: { status: row.status, amount: row.amount },
  });

  return mapInvoice(row);
}

export async function deleteDdInvoice(id: string) {
  await prisma.ddInvoice.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAuditLog({
    action: "delete",
    entityType: "dd_invoice",
    entityId: id,
    summary: "Invoice soft-deleted",
  });
}
