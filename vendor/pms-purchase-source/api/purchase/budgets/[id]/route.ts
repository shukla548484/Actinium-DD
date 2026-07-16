import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { requireBudgetEditForContext, requireBudgetViewForContext } from "@/lib/drydock-budget-access";
import {
  deriveBudgetAmountsFromMonthly,
  periodAmountToMonthly,
  type BudgetPeriodSpan,
} from "@/lib/purchase-budget-period";
import { z } from "zod";
import { snapshotPurchaseBudgetVersion } from "@/lib/purchase-budget-version";
import { parsePurchaseBudgetScope } from "@/lib/purchase-budget-scope";

const updateBudgetSchema = z.object({
  monthlyAmount: z.number().min(0).optional(),
  periodType: z.enum(["monthly", "quarterly", "yearly", "five_yearly", "dry_docking"]).optional(),
  amount: z.number().min(0).optional(),
  currency: z.string().optional(),
  notes: z.string().optional().nullable(),
  monthsInRange: z.number().int().min(1).max(120).optional(),
  budgetPeriodCode: z.string().max(64).optional(),
  budgetYearEnd: z.number().int().min(2000).max(2100).optional().nullable(),
});

// GET /api/purchase/budgets/[id] - Get a specific budget
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const budget = await prisma.purchaseBudget.findUnique({
      where: { id: params.id },
      select: { dryDockProjectId: true },
    });
    if (!budget) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }
    const viewDenied = requireBudgetViewForContext(user, Boolean(budget.dryDockProjectId));
    if (viewDenied) return viewDenied;

    const budgetFull = await prisma.purchaseBudget.findUnique({
      where: { id: params.id },
      include: {
        vessel: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        budgetType: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            level: true,
            parent: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!budgetFull) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }

    return NextResponse.json({ budget: budgetFull });
  } catch (error: any) {
    console.error("Error fetching budget:", error);
    return NextResponse.json(
      { error: "Failed to fetch budget", details: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/purchase/budgets/[id] - Update a budget
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const existing = await prisma.purchaseBudget.findUnique({
      where: { id: params.id },
      include: {
        budgetType: { select: { budgetScope: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }
    const editDenied = requireBudgetEditForContext(user, Boolean(existing.dryDockProjectId));
    if (editDenied) return editDenied;

    const body = await request.json();
    const validated = updateBudgetSchema.parse(body);

    if (existing.budgetPeriodCode) {
      await snapshotPurchaseBudgetVersion({
        vesselId: existing.vesselId,
        budgetPeriodCode: existing.budgetPeriodCode,
        budgetYear: existing.budgetYear,
        budgetYearEnd: existing.budgetYearEnd ?? existing.budgetYear,
        budgetScope: parsePurchaseBudgetScope(existing.budgetType.budgetScope),
        dryDockProjectId: existing.dryDockProjectId,
        declaredById: user.id,
      });
    }

    let monthlyAmount = validated.monthlyAmount;
    if (monthlyAmount === undefined && validated.amount !== undefined && validated.periodType) {
      const span: BudgetPeriodSpan | undefined = validated.monthsInRange
        ? {
            monthsInRange: validated.monthsInRange,
            yearsInRange: Math.max(1, Math.ceil(validated.monthsInRange / 12)),
          }
        : undefined;
      monthlyAmount = periodAmountToMonthly(validated.amount, validated.periodType, span);
    }

    let yearlyAmount = existing.yearlyAmount;
    let dailyAmount = existing.dailyAmount;
    if (monthlyAmount !== undefined) {
      ({ yearlyAmount, dailyAmount } = deriveBudgetAmountsFromMonthly(monthlyAmount));
    }

    const budget = await prisma.purchaseBudget.update({
      where: { id: params.id },
      data: {
        ...(monthlyAmount !== undefined && {
          monthlyAmount,
          yearlyAmount,
          dailyAmount,
        }),
        ...(validated.currency !== undefined && { currency: validated.currency }),
        ...(validated.notes !== undefined && { notes: validated.notes }),
      },
      include: {
        vessel: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        budgetType: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            level: true,
            parent: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ budget });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error updating budget:", error);
    return NextResponse.json(
      { error: "Failed to update budget", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/purchase/budgets/[id] - Delete a budget
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const budget = await prisma.purchaseBudget.findUnique({
      where: { id: params.id },
      select: { id: true, dryDockProjectId: true },
    });

    if (!budget) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }

    const editDenied = requireBudgetEditForContext(user, Boolean(budget.dryDockProjectId));
    if (editDenied) return editDenied;

    await prisma.purchaseBudget.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: "Budget deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting budget:", error);
    return NextResponse.json(
      { error: "Failed to delete budget", details: error.message },
      { status: 500 }
    );
  }
}
