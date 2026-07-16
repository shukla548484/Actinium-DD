import prisma from "@/lib/prisma";
import type { PurchaseBudgetFundType } from "@/lib/purchase-budget-fund-type";
import { PURCHASE_BUDGET_SCOPE, type PurchaseBudgetScope } from "@/lib/purchase-budget-scope";
import type { BudgetYearMonth } from "@/lib/purchase-budget-year-range";
import { roundBudgetAmount } from "@/lib/purchase-budget-amount-format";

export type AccrualMonthBucket = {
  year: number;
  month: number;
  amount: number;
};

export type AccrualExposureSummary = {
  totalActual: number;
  byBudgetCode: Map<string, number>;
  byMonth: Map<string, number>;
  recurringMonthly: number;
};

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthsInRange(rangeFrom: BudgetYearMonth, rangeTo: BudgetYearMonth): AccrualMonthBucket[] {
  const out: AccrualMonthBucket[] = [];
  let y = rangeFrom.year;
  let m = rangeFrom.month;
  const endY = rangeTo.year;
  const endM = rangeTo.month;
  while (y < endY || (y === endY && m <= endM)) {
    out.push({ year: y, month: m, amount: 0 });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export async function fetchAccrualExposure(params: {
  vesselId: string;
  rangeFrom: BudgetYearMonth;
  rangeTo: BudgetYearMonth;
  budgetScope: PurchaseBudgetScope;
  dryDockProjectId?: string | null;
  fundType?: PurchaseBudgetFundType | null;
}): Promise<AccrualExposureSummary> {
  const { vesselId, rangeFrom, rangeTo, budgetScope, dryDockProjectId, fundType } = params;

  const where: {
    vesselId: string;
    accrualYear: { gte: number; lte: number };
    dryDockProjectId?: string | null;
    fundType?: PurchaseBudgetFundType;
  } = {
    vesselId,
    accrualYear: { gte: rangeFrom.year, lte: rangeTo.year },
  };

  if (budgetScope === PURCHASE_BUDGET_SCOPE.DRY_DOCK) {
    where.dryDockProjectId = dryDockProjectId ?? null;
  } else {
    where.dryDockProjectId = null;
  }
  if (fundType) where.fundType = fundType;

  const rows = await prisma.purchaseBudgetAccrualEntry.findMany({
    where,
    select: {
      accrualYear: true,
      accrualMonth: true,
      amount: true,
      budgetCode: true,
      budgetType: { select: { code: true } },
      isRecurring: true,
    },
  });

  const byBudgetCode = new Map<string, number>();
  const byMonth = new Map<string, number>();
  let totalActual = 0;
  let recurringMonthly = 0;

  const rangeMonths = new Set(
    monthsInRange(rangeFrom, rangeTo).map((b) => monthKey(b.year, b.month))
  );

  for (const row of rows) {
    const key = monthKey(row.accrualYear, row.accrualMonth);
    if (!rangeMonths.has(key)) continue;
    if (
      row.accrualYear < rangeFrom.year ||
      (row.accrualYear === rangeFrom.year && row.accrualMonth < rangeFrom.month)
    ) {
      continue;
    }
    if (
      row.accrualYear > rangeTo.year ||
      (row.accrualYear === rangeTo.year && row.accrualMonth > rangeTo.month)
    ) {
      continue;
    }

    const amt = Number(row.amount) || 0;
    totalActual += amt;
    byMonth.set(key, (byMonth.get(key) ?? 0) + amt);

    const code = row.budgetCode?.trim() || row.budgetType?.code?.trim() || "";
    if (code) {
      byBudgetCode.set(code, (byBudgetCode.get(code) ?? 0) + amt);
    }
    if (row.isRecurring) {
      recurringMonthly += amt;
    }
  }

  return {
    totalActual: roundBudgetAmount(totalActual),
    byBudgetCode,
    byMonth,
    recurringMonthly: roundBudgetAmount(recurringMonthly),
  };
}

/** Project recurring accruals forward across remaining months in the period. */
export function projectRecurringAccrualsByMonth(params: {
  rangeFrom: BudgetYearMonth;
  rangeTo: BudgetYearMonth;
  recurringEntries: Array<{ accrualYear: number; accrualMonth: number; amount: number }>;
}): Map<string, number> {
  const { rangeFrom, rangeTo, recurringEntries } = params;
  const out = new Map<string, number>();
  const templates = recurringEntries.filter((e) => (Number(e.amount) || 0) > 0);
  if (!templates.length) return out;

  const avg =
    templates.reduce((s, e) => s + (Number(e.amount) || 0), 0) / templates.length;

  for (const bucket of monthsInRange(rangeFrom, rangeTo)) {
    const key = monthKey(bucket.year, bucket.month);
    out.set(key, roundBudgetAmount(avg));
  }
  return out;
}
