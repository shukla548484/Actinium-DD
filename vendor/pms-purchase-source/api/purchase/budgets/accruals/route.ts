import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { parsePurchaseBudgetScope, PURCHASE_BUDGET_SCOPE } from "@/lib/purchase-budget-scope";
import { requireBudgetEditForContext, requireBudgetViewForContext } from "@/lib/drydock-budget-access";
import { serializePrismaError } from "@/lib/prisma-error-utils";
import { PURCHASE_BUDGET_FUND_TYPES } from "@/lib/purchase-budget-fund-type";

const accrualSchema = z.object({
  vesselId: z.string().uuid(),
  budgetTypeId: z.string().uuid().optional().nullable(),
  budgetCode: z.string().max(100).optional().nullable(),
  dryDockProjectId: z.string().uuid().optional().nullable(),
  fundType: z.enum(PURCHASE_BUDGET_FUND_TYPES as [string, ...string[]]).optional(),
  sourceType: z.enum([
    "CREW_PAYROLL",
    "INSURANCE",
    "MANAGEMENT_FEE",
    "RECURRING_OPEX",
    "OTHER",
  ]),
  accrualYear: z.number().int().min(2000).max(2100),
  accrualMonth: z.number().int().min(1).max(12),
  amount: z.number().min(0),
  currency: z.string().default("USD"),
  description: z.string().optional().nullable(),
  isRecurring: z.boolean().optional(),
});

// GET /api/purchase/budgets/accruals
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const vesselId = searchParams.get("vesselId");
    if (!vesselId) {
      return NextResponse.json({ error: "vesselId is required" }, { status: 400 });
    }

    const dryDockProjectId = searchParams.get("dryDockProjectId");
    const budgetScope = parsePurchaseBudgetScope(searchParams.get("budgetScope"));
    const viewDenied = requireBudgetViewForContext(
      user,
      Boolean(dryDockProjectId) || budgetScope === PURCHASE_BUDGET_SCOPE.DRY_DOCK
    );
    if (viewDenied) return viewDenied;

    const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
    const yearEnd = parseInt(searchParams.get("yearEnd") ?? String(year), 10);

    const entries = await prisma.purchaseBudgetAccrualEntry.findMany({
      where: {
        vesselId,
        accrualYear: { gte: year, lte: yearEnd },
        ...(budgetScope === PURCHASE_BUDGET_SCOPE.DRY_DOCK
          ? { dryDockProjectId: dryDockProjectId ?? null }
          : { dryDockProjectId: null }),
      },
      orderBy: [{ accrualYear: "desc" }, { accrualMonth: "desc" }],
      include: {
        budgetType: { select: { id: true, code: true, name: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });

    return NextResponse.json({ entries });
  } catch (error: unknown) {
    const details = serializePrismaError(error);
    console.error("Error fetching budget accruals:", details);
    return NextResponse.json(
      { error: "Failed to fetch accruals", details: details.message },
      { status: 500 }
    );
  }
}

// POST /api/purchase/budgets/accruals
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const validated = accrualSchema.parse(body);

    const editDenied = requireBudgetEditForContext(user, Boolean(validated.dryDockProjectId));
    if (editDenied) return editDenied;

    const entry = await prisma.purchaseBudgetAccrualEntry.create({
      data: {
        vesselId: validated.vesselId,
        budgetTypeId: validated.budgetTypeId ?? null,
        budgetCode: validated.budgetCode ?? null,
        dryDockProjectId: validated.dryDockProjectId ?? null,
        fundType: validated.fundType ?? "OPEX",
        sourceType: validated.sourceType,
        accrualYear: validated.accrualYear,
        accrualMonth: validated.accrualMonth,
        amount: validated.amount,
        currency: validated.currency,
        description: validated.description,
        isRecurring: validated.isRecurring ?? false,
        createdById: user.id,
      },
      include: {
        budgetType: { select: { id: true, code: true, name: true } },
      },
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
    }
    const details = serializePrismaError(error);
    console.error("Error creating budget accrual:", details);
    return NextResponse.json(
      { error: "Failed to create accrual", details: details.message },
      { status: 500 }
    );
  }
}
