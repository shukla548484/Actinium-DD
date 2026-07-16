import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { requireBudgetEditForContext } from "@/lib/drydock-budget-access";
import { serializePrismaError } from "@/lib/prisma-error-utils";
import { PURCHASE_BUDGET_FUND_TYPES } from "@/lib/purchase-budget-fund-type";

const updateSchema = z.object({
  amount: z.number().min(0).optional(),
  description: z.string().optional().nullable(),
  isRecurring: z.boolean().optional(),
  fundType: z.enum(PURCHASE_BUDGET_FUND_TYPES as [string, ...string[]]).optional(),
});

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const existing = await prisma.purchaseBudgetAccrualEntry.findUnique({
      where: { id: params.id },
      select: { dryDockProjectId: true },
    });
    if (!existing) return NextResponse.json({ error: "Accrual not found" }, { status: 404 });

    const editDenied = requireBudgetEditForContext(user, Boolean(existing.dryDockProjectId));
    if (editDenied) return editDenied;

    const validated = updateSchema.parse(await request.json());
    const entry = await prisma.purchaseBudgetAccrualEntry.update({
      where: { id: params.id },
      data: validated,
    });

    return NextResponse.json({ entry });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
    }
    const details = serializePrismaError(error);
    return NextResponse.json(
      { error: "Failed to update accrual", details: details.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const existing = await prisma.purchaseBudgetAccrualEntry.findUnique({
      where: { id: params.id },
      select: { dryDockProjectId: true },
    });
    if (!existing) return NextResponse.json({ error: "Accrual not found" }, { status: 404 });

    const editDenied = requireBudgetEditForContext(user, Boolean(existing.dryDockProjectId));
    if (editDenied) return editDenied;

    await prisma.purchaseBudgetAccrualEntry.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "Accrual deleted" });
  } catch (error: unknown) {
    const details = serializePrismaError(error);
    return NextResponse.json(
      { error: "Failed to delete accrual", details: details.message },
      { status: 500 }
    );
  }
}
