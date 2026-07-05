import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireOfficeApiPermission } from "@/lib/auth/officePageAccess";
import { getSessionPayload, getSessionUserId } from "@/lib/auth/session";
import { createDdInvoice, listDdInvoices, updateDdInvoice } from "@/lib/db/superintendent/invoices";
import { ddInvoiceCreateSchema, ddInvoiceUpdateSchema, parseBody } from "@/lib/superintendent/validation";
import { buildUserScope, dryDockProjectWhereForScope } from "@/lib/rbac/scopeRules";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/superintendent/helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireOfficeApiPermission("page.office.accounts");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const dryDockProjectId = searchParams.get("dryDockProjectId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const page = Number(searchParams.get("page") ?? "1");
  const limit = Number(searchParams.get("limit") ?? "30");

  const result = await listDdInvoices({
    page,
    limit,
    dryDockProjectId,
    status: status as Prisma.EnumDdInvoiceStatusFilter["equals"] | undefined,
  });

  const userId = await getSessionUserId();
  if (userId) {
    const scope = await buildUserScope(userId);
    if (!scope.unrestricted) {
      const ddWhere = await dryDockProjectWhereForScope(scope);
      const allowed = await prisma.dryDockProject.findMany({
        where: { ...notDeleted, ...ddWhere },
        select: { id: true },
      });
      const allowedIds = new Set(allowed.map((r) => r.id));
      result.invoices = result.invoices.filter((inv) => allowedIds.has(inv.dryDockProjectId));
      result.total = result.invoices.length;
      result.totalPages = Math.ceil(result.total / limit) || 1;
    }
  }

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const denied = await requireOfficeApiPermission("page.office.accounts");
  if (denied) return denied;

  const parsed = parseBody(ddInvoiceCreateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const project = await prisma.dryDockProject.findFirst({
    where: { id: parsed.data.dryDockProjectId, ...notDeleted },
  });
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

export async function PATCH(request: Request) {
  const denied = await requireOfficeApiPermission("page.office.accounts");
  if (denied) return denied;

  const body = await request.json();
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "Invoice id is required" }, { status: 400 });

  const parsed = parseBody(ddInvoiceUpdateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await prisma.ddInvoice.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const access = await assertDryDockProjectInScope(existing.dryDockProjectId);
  if (!access.ok) return access.response;

  const payload = await getSessionPayload();
  const patch: Parameters<typeof updateDdInvoice>[1] = {
    ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
    ...(parsed.data.amount !== undefined ? { amount: parsed.data.amount } : {}),
  };

  if (parsed.data.status === "verified" || parsed.data.status === "approved") {
    patch.verifiedBy = payload?.loginId ?? payload?.userId ?? "accounts";
    patch.verifiedAt = new Date();
  }

  const invoice = await updateDdInvoice(id, patch);
  return NextResponse.json({ invoice });
}
