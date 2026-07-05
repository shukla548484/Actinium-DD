import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { notDeleted, parsePagination } from "@/lib/superintendent/helpers";
import {
  buildChildEntityWhere,
  guardChildListAccess,
} from "@/lib/superintendent/childRouteScope";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { ddInvoiceCreateSchema, parseBody } from "@/lib/superintendent/validation";
import { createDdInvoice } from "@/lib/db/superintendent/invoices";
import { findDryDockProject } from "@/lib/superintendent/helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function mapInvoice(row: {
  id: string;
  dryDockProjectId: string;
  purchaseOrderId: string | null;
  invoiceNumber: string | null;
  supplier: string | null;
  description: string | null;
  amount: number;
  currency: string;
  status: string;
  invoiceDate: Date | null;
  dueDate: Date | null;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
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

export async function GET(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const dryDockProjectId = searchParams.get("dryDockProjectId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  const guard = await guardChildListAccess(dryDockProjectId, page, limit);
  if (!guard.ok) return NextResponse.json(guard.response);

  const where: Prisma.DdInvoiceWhereInput = {
    ...notDeleted,
    ...buildChildEntityWhere(dryDockProjectId, guard.projectFilter),
  };
  if (status) where.status = status as Prisma.EnumDdInvoiceStatusFilter["equals"];

  const [total, rows] = await Promise.all([
    prisma.ddInvoice.count({ where }),
    prisma.ddInvoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return NextResponse.json({
    invoices: rows.map(mapInvoice),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  });
}

export async function POST(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const parsed = parseBody(ddInvoiceCreateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const project = await findDryDockProject(parsed.data.dryDockProjectId);
  if (!project) return NextResponse.json({ error: "Dry dock project not found" }, { status: 404 });

  const access = await assertDryDockProjectInScope(parsed.data.dryDockProjectId);
  if (!access.ok) return access.response;

  const invoice = await createDdInvoice({
    ...parsed.data,
    invoiceDate: parsed.data.invoiceDate ? new Date(parsed.data.invoiceDate) : null,
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
  });

  return NextResponse.json({ invoice }, { status: 201 });
}
