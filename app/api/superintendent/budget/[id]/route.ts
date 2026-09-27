import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { notDeleted } from "@/lib/superintendent/helpers";
import { assertChildDryDockProjectInScope } from "@/lib/superintendent/childRouteScope";
import { resolveBudgetLineCurrencyAmounts } from "@/lib/superintendent/budgetLineCurrency";
import { ddBudgetLineUpdateSchema, parseBody } from "@/lib/superintendent/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const budgetLine = await prisma.ddBudgetLine.findFirst({ where: { id, ...notDeleted } });
  if (!budgetLine) return NextResponse.json({ error: "Budget line not found" }, { status: 404 });
  const access = await assertChildDryDockProjectInScope(budgetLine.dryDockProjectId);
  if (!access.ok) return access.response;
  return NextResponse.json({ budgetLine });
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseBody(ddBudgetLineUpdateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await prisma.ddBudgetLine.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return NextResponse.json({ error: "Budget line not found" }, { status: 404 });

  const access = await assertChildDryDockProjectInScope(existing.dryDockProjectId);
  if (!access.ok) return access.response;

  const {
    currency,
    exchangeRateLocalPerUsd,
    budgetAmount,
    quotedAmount,
    approvedAmount,
    actualAmount,
    ...rest
  } = parsed.data;

  const amountsTouched =
    currency !== undefined ||
    exchangeRateLocalPerUsd !== undefined ||
    budgetAmount !== undefined ||
    quotedAmount !== undefined ||
    approvedAmount !== undefined ||
    actualAmount !== undefined;

  const amounts = amountsTouched
    ? await resolveBudgetLineCurrencyAmounts({
        dryDockProjectId: existing.dryDockProjectId,
        currency: currency ?? existing.currency,
        exchangeRateLocalPerUsd:
          exchangeRateLocalPerUsd !== undefined
            ? exchangeRateLocalPerUsd
            : existing.exchangeRateLocalPerUsd,
        budgetAmount: budgetAmount ?? existing.budgetAmount,
        quotedAmount: quotedAmount !== undefined ? quotedAmount : existing.quotedAmount,
        approvedAmount: approvedAmount !== undefined ? approvedAmount : existing.approvedAmount,
        actualAmount: actualAmount !== undefined ? actualAmount : existing.actualAmount,
      })
    : null;

  const budgetLine = await prisma.ddBudgetLine.update({
    where: { id },
    data: {
      ...rest,
      ...(amounts ?? {}),
    },
  });
  return NextResponse.json({ budgetLine });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const existing = await prisma.ddBudgetLine.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return NextResponse.json({ error: "Budget line not found" }, { status: 404 });

  const access = await assertChildDryDockProjectInScope(existing.dryDockProjectId);
  if (!access.ok) return access.response;

  await prisma.ddBudgetLine.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
