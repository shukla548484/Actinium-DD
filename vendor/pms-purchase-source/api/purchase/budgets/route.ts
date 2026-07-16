import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import {
  requirePurchaseBudgetEdit,
  requirePurchaseBudgetView,
} from "@/lib/purchase-budget-access";
import {
  deriveBudgetAmountsFromMonthly,
  periodAmountToMonthly,
  resolveBudgetMonthQuarter,
  type BudgetPeriodSpan,
  type BudgetPeriodType,
} from "@/lib/purchase-budget-period";
import {
  buildPurchaseBudgetPeriodCode,
  resolveBudgetPeriodCodeForRecord,
} from "@/lib/purchase-budget-period-code";
import { isBudgetRecordInYearMonthRange } from "@/lib/purchase-budget-year-range";
import { isMissingBudgetPeriodCodeColumnError } from "@/lib/purchase-budget-schema-compat";
import { z } from "zod";
import { parsePurchaseBudgetScope, PURCHASE_BUDGET_SCOPE } from "@/lib/purchase-budget-scope";
import { requireBudgetEditForContext, requireBudgetViewForContext } from "@/lib/drydock-budget-access";
import {
  findPurchaseBudgetsCompat,
  isMissingBudgetYearEndColumnError,
} from "@/lib/purchase-budget-schema-compat";
import { snapshotPurchaseBudgetVersion } from "@/lib/purchase-budget-version";

// Validation schema for budget creation/update
const budgetPeriodTypeEnum = z.enum([
  "monthly",
  "quarterly",
  "yearly",
  "five_yearly",
  "dry_docking",
]);

const budgetSchema = z.object({
  vesselId: z.string().uuid(),
  budgetTypeId: z.string().uuid(),
  budgetYear: z.number().int().min(2000).max(2100),
  budgetYearEnd: z.number().int().min(2000).max(2100).optional().nullable(),
  budgetMonth: z.number().int().min(1).max(12).nullable().optional(),
  budgetQuarter: z.number().int().min(1).max(4).nullable().optional(),
  periodType: budgetPeriodTypeEnum.optional(),
  /** Amount in the selected period (monthly / quarterly / yearly); converted to monthlyAmount when periodType is set. */
  amount: z.number().min(0).optional(),
  monthlyAmount: z.number().min(0).optional(),
  currency: z.string().default("USD"),
  notes: z.string().optional().nullable(),
  dryDockProjectId: z.string().uuid().optional().nullable(),
  budgetPeriodCode: z.string().max(64).optional(),
  budgetPeriodType: budgetPeriodTypeEnum.optional(),
  monthsInRange: z.number().int().min(1).max(120).optional(),
});

// GET /api/purchase/budgets - Get all budgets
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const dryDockProjectId = searchParams.get("dryDockProjectId");
    const budgetScope = parsePurchaseBudgetScope(searchParams.get("budgetScope"));
    const dryDockContext =
      Boolean(dryDockProjectId) || budgetScope === PURCHASE_BUDGET_SCOPE.DRY_DOCK;

    const viewDenied = requireBudgetViewForContext(user, dryDockContext);
    if (viewDenied) return viewDenied;

    const vesselId = searchParams.get("vesselId");
    const year = searchParams.get("year");
    const yearEnd = searchParams.get("yearEnd");
    const month = searchParams.get("month");
    const monthFrom = searchParams.get("monthFrom");
    const monthTo = searchParams.get("monthTo");
    const quarter = searchParams.get("quarter");
    const periodType = searchParams.get("periodType") as BudgetPeriodType | null;
    const budgetTypeId = searchParams.get("budgetTypeId");
    const budgetPeriodCode = searchParams.get("budgetPeriodCode")?.trim() || null;

    const where: Record<string, unknown> = {};
    if (vesselId) where.vesselId = vesselId;
    if (dryDockProjectId) {
      where.dryDockProjectId = dryDockProjectId;
    } else if (budgetScope === PURCHASE_BUDGET_SCOPE.NORMAL) {
      where.dryDockProjectId = null;
    } else if (budgetScope === PURCHASE_BUDGET_SCOPE.DRY_DOCK) {
      where.dryDockProjectId = null;
    }
    if (year) where.budgetYear = parseInt(year);
    if (yearEnd) {
      where.budgetYearEnd = parseInt(yearEnd);
    }
    if (budgetTypeId) where.budgetTypeId = budgetTypeId;

    if (periodType === "monthly" && month) {
      where.budgetMonth = parseInt(month);
      where.budgetQuarter = null;
    } else if (periodType === "quarterly" && quarter) {
      where.budgetMonth = null;
      where.budgetQuarter = parseInt(quarter);
    } else if (
      periodType === "yearly" ||
      periodType === "five_yearly" ||
      periodType === "dry_docking"
    ) {
      where.budgetMonth = null;
      where.budgetQuarter = null;
    } else if (month) {
      where.budgetMonth = parseInt(month);
    } else if (quarter) {
      where.budgetQuarter = parseInt(quarter);
    }

    let budgets = await findPurchaseBudgetsCompat({ where, budgetScope });

    if (year && monthFrom && monthTo) {
      const from = {
        year: parseInt(year, 10),
        month: parseInt(monthFrom, 10),
      };
      const to = {
        year: parseInt(yearEnd ?? year, 10),
        month: parseInt(monthTo, 10),
      };
      budgets = budgets.filter((b) => isBudgetRecordInYearMonthRange(b, from, to));
    }

    if (budgetPeriodCode) {
      budgets = budgets.filter(
        (b) => resolveBudgetPeriodCodeForRecord(b) === budgetPeriodCode
      );
    }

    return NextResponse.json({ budgets });
  } catch (error: unknown) {
    console.error("Error fetching budgets:", error);
    const message = error instanceof Error ? error.message : "Unknown";
    return NextResponse.json(
      { error: "Failed to fetch budgets", details: message },
      { status: 500 }
    );
  }
}

// POST /api/purchase/budgets - Create a new budget
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const validated = budgetSchema.parse(body);

    const dryDockContext = Boolean(validated.dryDockProjectId);
    const editDenied = requireBudgetEditForContext(user, dryDockContext);
    if (editDenied) return editDenied;

    const periodType = validated.periodType;
    let budgetMonth = validated.budgetMonth ?? null;
    let budgetQuarter = validated.budgetQuarter ?? null;

    if (periodType) {
      const resolved = resolveBudgetMonthQuarter(
        periodType,
        validated.budgetMonth ?? undefined,
        validated.budgetQuarter ?? undefined
      );
      budgetMonth = resolved.budgetMonth;
      budgetQuarter = resolved.budgetQuarter;
    }

    let monthlyAmount = validated.monthlyAmount;
    if (monthlyAmount === undefined) {
      const amount = validated.amount;
      if (amount === undefined) {
        return NextResponse.json(
          { error: "Provide monthlyAmount or amount with periodType" },
          { status: 400 }
        );
      }
      if (!periodType) {
        return NextResponse.json(
          { error: "periodType is required when using amount" },
          { status: 400 }
        );
      }
      const span: BudgetPeriodSpan | undefined = validated.monthsInRange
        ? {
            monthsInRange: validated.monthsInRange,
            yearsInRange: Math.max(
              1,
              Math.ceil(validated.monthsInRange / 12)
            ),
          }
        : undefined;
      monthlyAmount = periodAmountToMonthly(amount, periodType, span);
    }

    const budgetType = await prisma.purchaseBudgetType.findUnique({
      where: { id: validated.budgetTypeId },
      select: { id: true, level: true, isActive: true, budgetScope: true },
    });
    if (!budgetType || budgetType.level !== 2) {
      return NextResponse.json(
        { error: "Budget must use a Level 2 budget code (e.g. 1100, 2100)" },
        { status: 400 }
      );
    }
    if (!budgetType.isActive) {
      return NextResponse.json(
        { error: "Selected budget code is inactive" },
        { status: 400 }
      );
    }

    if (validated.dryDockProjectId) {
      if (budgetType.budgetScope !== PURCHASE_BUDGET_SCOPE.DRY_DOCK) {
        return NextResponse.json(
          { error: "Project budgets require a dry dock (DD-*) budget category" },
          { status: 400 }
        );
      }
      const project = await prisma.dryDockProject.findFirst({
        where: { id: validated.dryDockProjectId, vesselId: validated.vesselId },
        select: { id: true },
      });
      if (!project) {
        return NextResponse.json(
          { error: "Dry dock project not found for this vessel" },
          { status: 400 }
        );
      }
    }

    const { yearlyAmount, dailyAmount } = deriveBudgetAmountsFromMonthly(monthlyAmount);

    const budgetYearEnd =
      validated.budgetYearEnd != null && validated.budgetYearEnd >= validated.budgetYear
        ? validated.budgetYearEnd
        : validated.budgetYear;

    const existingWhere = {
      vesselId: validated.vesselId,
      dryDockProjectId: validated.dryDockProjectId ?? null,
      budgetTypeId: validated.budgetTypeId,
      budgetYear: validated.budgetYear,
      budgetYearEnd,
      budgetMonth,
      budgetQuarter,
    };

    let existing = await prisma.purchaseBudget.findFirst({ where: existingWhere }).catch(
      async (err) => {
        if (!isMissingBudgetYearEndColumnError(err)) throw err;
        const { budgetYearEnd: _e, ...legacyWhere } = existingWhere;
        return prisma.purchaseBudget.findFirst({ where: legacyWhere });
      }
    );

    if (existing) {
      return NextResponse.json(
        { error: "Budget already exists for this vessel, section, year, and month" },
        { status: 400 }
      );
    }

    const resolvedPeriodType: BudgetPeriodType | undefined =
      validated.periodType ?? validated.budgetPeriodType;
    const budgetPeriodType = resolvedPeriodType ?? null;
    const budgetPeriodCode =
      validated.budgetPeriodCode?.trim() ||
      (resolvedPeriodType
        ? buildPurchaseBudgetPeriodCode({
            budgetYear: validated.budgetYear,
            budgetYearEnd,
            budgetMonth,
            budgetQuarter,
            periodType: resolvedPeriodType,
          })
        : null);

    const createData = {
      vesselId: validated.vesselId,
      dryDockProjectId: validated.dryDockProjectId ?? null,
      budgetTypeId: validated.budgetTypeId,
      budgetYear: validated.budgetYear,
      budgetYearEnd,
      budgetMonth,
      budgetQuarter,
      budgetPeriodType,
      budgetPeriodCode,
      monthlyAmount,
      yearlyAmount,
      dailyAmount,
      currency: validated.currency,
      notes: validated.notes,
      createdById: user.id,
    };

    if (budgetPeriodCode) {
      const existingCount = await prisma.purchaseBudget.count({
        where: {
          vesselId: validated.vesselId,
          budgetPeriodCode,
          dryDockProjectId: validated.dryDockProjectId ?? null,
        },
      });
      if (existingCount > 0) {
        await snapshotPurchaseBudgetVersion({
          vesselId: validated.vesselId,
          budgetPeriodCode,
          budgetYear: validated.budgetYear,
          budgetYearEnd,
          budgetScope: parsePurchaseBudgetScope(budgetType.budgetScope),
          dryDockProjectId: validated.dryDockProjectId ?? null,
          declaredById: user.id,
        });
      }
    }

    let budget;
    try {
      budget = await prisma.purchaseBudget.create({
        data: createData,
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
            },
          },
        },
      });
    } catch (createErr) {
      if (
        !isMissingBudgetYearEndColumnError(createErr) &&
        !isMissingBudgetPeriodCodeColumnError(createErr)
      ) {
        throw createErr;
      }
      const {
        budgetYearEnd: _ye,
        budgetPeriodType: _pt,
        budgetPeriodCode: _pc,
        ...legacyData
      } = createData;
      budget = await prisma.purchaseBudget.create({
        data: legacyData,
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
            },
          },
        },
      });
    }

    return NextResponse.json({ budget }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating budget:", error);
    return NextResponse.json(
      { error: "Failed to create budget", details: error.message },
      { status: 500 }
    );
  }
}
