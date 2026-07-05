import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { getSessionPayload } from "@/lib/auth/session";
import { notDeleted } from "@/lib/superintendent/helpers";
import { assertChildDryDockProjectInScope } from "@/lib/superintendent/childRouteScope";
import { ddInvoiceUpdateSchema, parseBody } from "@/lib/superintendent/validation";
import { deleteDdInvoice, updateDdInvoice } from "@/lib/db/superintendent/invoices";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const invoice = await prisma.ddInvoice.findFirst({ where: { id, ...notDeleted } });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const access = await assertChildDryDockProjectInScope(invoice.dryDockProjectId);
  if (!access.ok) return access.response;

  return NextResponse.json({ invoice });
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseBody(ddInvoiceUpdateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await prisma.ddInvoice.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const access = await assertChildDryDockProjectInScope(existing.dryDockProjectId);
  if (!access.ok) return access.response;

  const payload = await getSessionPayload();
  const patch: Parameters<typeof updateDdInvoice>[1] = {
    ...(parsed.data.invoiceNumber !== undefined ? { invoiceNumber: parsed.data.invoiceNumber } : {}),
    ...(parsed.data.supplier !== undefined ? { supplier: parsed.data.supplier } : {}),
    ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
    ...(parsed.data.amount !== undefined ? { amount: parsed.data.amount } : {}),
    ...(parsed.data.currency !== undefined ? { currency: parsed.data.currency } : {}),
    ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    ...(parsed.data.invoiceDate !== undefined
      ? { invoiceDate: parsed.data.invoiceDate ? new Date(parsed.data.invoiceDate) : null }
      : {}),
    ...(parsed.data.dueDate !== undefined
      ? { dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null }
      : {}),
    ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
  };

  if (parsed.data.status === "verified") {
    patch.verifiedBy = payload?.loginId ?? payload?.userId ?? "system";
    patch.verifiedAt = new Date();
  }

  const invoice = await updateDdInvoice(id, patch);
  return NextResponse.json({ invoice });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const existing = await prisma.ddInvoice.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const access = await assertChildDryDockProjectInScope(existing.dryDockProjectId);
  if (!access.ok) return access.response;

  await deleteDdInvoice(id);
  return NextResponse.json({ ok: true });
}
