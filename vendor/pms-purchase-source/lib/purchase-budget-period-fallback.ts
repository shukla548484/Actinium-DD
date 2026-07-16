/**
 * Cross-period assigned-budget resolution for analytics / variance.
 *
 * Storage always normalizes to `monthlyAmount`, so converting a selected source grain
 * with {@link allocatedAmountForPeriodType} yields the comparison amount for the view.
 *
 * Rules (per vessel + budget code within a year):
 * 1. If the user created an explicit budget for the selected view grain → use that only.
 * 2. Else prefer yearly, then monthly, then quarterly as the source grain.
 * 3. When all of monthly, quarterly, and yearly exist → never mix; follow the selected view.
 */

import {
  allocatedAmountForPeriodType,
  type BudgetPeriodType,
} from "@/lib/purchase-budget-period";
import { inferBudgetPeriodTypeFromRecord } from "@/lib/purchase-budget-period-code";

export type BudgetPeriodGrain = "monthly" | "quarterly" | "yearly";

export type BudgetAmountRecord = {
  vesselId: string;
  budgetMonth?: number | null;
  budgetQuarter?: number | null;
  budgetYear: number;
  budgetYearEnd?: number | null;
  budgetPeriodType?: string | null;
  monthlyAmount: number | string | { toString(): string };
  yearlyAmount?: number | string | { toString(): string } | null;
  budgetType: { id?: string; code: string; name?: string };
};

export function toBudgetPeriodGrain(
  periodType: BudgetPeriodType | null | undefined
): BudgetPeriodGrain | null {
  if (periodType === "monthly" || periodType === "quarterly" || periodType === "yearly") {
    return periodType;
  }
  if (periodType === "five_yearly" || periodType === "dry_docking") {
    return "yearly";
  }
  return null;
}

export function budgetRecordGrain(row: {
  budgetMonth?: number | null;
  budgetQuarter?: number | null;
  budgetYear: number;
  budgetYearEnd?: number | null;
  budgetPeriodType?: string | null;
}): BudgetPeriodGrain {
  const inferred = inferBudgetPeriodTypeFromRecord(row);
  return toBudgetPeriodGrain(inferred) ?? "yearly";
}

function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Prefer explicit view grain; otherwise yearly → monthly → quarterly.
 * When all three grains exist, only the view grain is returned (strict).
 */
export function pickBudgetSourceGrain(
  available: ReadonlySet<BudgetPeriodGrain>,
  view: BudgetPeriodGrain
): BudgetPeriodGrain | null {
  if (available.size === 0) return null;
  if (available.has(view)) return view;

  const hasMonthly = available.has("monthly");
  const hasQuarterly = available.has("quarterly");
  const hasYearly = available.has("yearly");

  // Explicit budgets for every grain → only use the selected view (already handled above).
  if (hasMonthly && hasQuarterly && hasYearly) {
    return available.has(view) ? view : null;
  }

  if (hasYearly) return "yearly";
  if (hasMonthly) return "monthly";
  if (hasQuarterly) return "quarterly";
  return null;
}

export function budgetLineKey(
  vesselId: string,
  budgetCode: string
): string {
  return `${vesselId}::${budgetCode}`;
}

/**
 * Filter rows belonging to a source grain. For monthly/quarterly with a specific
 * month/quarter, prefer matching slots; if none match, use all rows of that grain.
 */
export function filterRowsForSourceGrain(
  rows: BudgetAmountRecord[],
  source: BudgetPeriodGrain,
  month?: number,
  quarter?: number
): BudgetAmountRecord[] {
  const grainRows = rows.filter((r) => budgetRecordGrain(r) === source);
  if (source === "monthly" && month != null && month >= 1 && month <= 12) {
    const match = grainRows.filter((r) => r.budgetMonth === month);
    return match.length > 0 ? match : grainRows;
  }
  if (source === "quarterly" && quarter != null && quarter >= 1 && quarter <= 4) {
    const match = grainRows.filter((r) => r.budgetQuarter === quarter);
    return match.length > 0 ? match : grainRows;
  }
  return grainRows;
}

/**
 * Sum allocated amount for the view from the chosen source grain rows.
 *
 * Same-grain: convert each row with {@link allocatedAmountForPeriodType}.
 * Cross-grain: build a source-period total, then scale to the view so multi-month
 * rows are not each multiplied by 12.
 */
export function allocatedFromSourceRows(
  rows: BudgetAmountRecord[],
  view: BudgetPeriodGrain,
  source: BudgetPeriodGrain
): number {
  if (rows.length === 0) return 0;

  if (source === view) {
    return rows.reduce((sum, row) => {
      const monthly = num(row.monthlyAmount);
      return sum + allocatedAmountForPeriodType(monthly, view);
    }, 0);
  }

  const sourceTotal = rows.reduce((sum, row) => {
    const monthly = num(row.monthlyAmount);
    return sum + allocatedAmountForPeriodType(monthly, source);
  }, 0);

  if (source === "monthly" && view === "yearly") {
    const distinctMonths = new Set(
      rows.map((r) => r.budgetMonth).filter((m): m is number => m != null && m >= 1 && m <= 12)
    );
    // Several months declared → sum is already annual; one month (rate) → ×12.
    return distinctMonths.size >= 2 ? sourceTotal : sourceTotal * 12;
  }
  if (source === "monthly" && view === "quarterly") {
    const distinctMonths = new Set(
      rows.map((r) => r.budgetMonth).filter((m): m is number => m != null && m >= 1 && m <= 12)
    );
    if (distinctMonths.size >= 2) {
      // Prefer months in a single quarter if requested rows are mixed; average rate ×3.
      return (sourceTotal / distinctMonths.size) * 3;
    }
    return sourceTotal * 3;
  }
  if (source === "quarterly" && view === "yearly") {
    const distinctQuarters = new Set(
      rows.map((r) => r.budgetQuarter).filter((q): q is number => q != null && q >= 1 && q <= 4)
    );
    return distinctQuarters.size >= 2 ? sourceTotal : sourceTotal * 4;
  }
  if (source === "quarterly" && view === "monthly") {
    return sourceTotal / 3;
  }
  if (source === "yearly" && view === "monthly") {
    return sourceTotal / 12;
  }
  if (source === "yearly" && view === "quarterly") {
    return sourceTotal / 4;
  }
  return sourceTotal;
}

/**
 * Resolve which budget rows to use for KPI lines for a given view.
 * Returns one entry per vessel+budgetCode with the chosen source grain.
 */
export function selectBudgetSourceGroupsForPeriodView<T extends BudgetAmountRecord>(
  budgets: T[],
  view: BudgetPeriodGrain,
  options?: { month?: number; quarter?: number }
): Array<{ key: string; source: BudgetPeriodGrain; rows: T[] }> {
  const byKey = new Map<string, T[]>();
  for (const b of budgets) {
    const key = budgetLineKey(b.vesselId, b.budgetType.code);
    const list = byKey.get(key) ?? [];
    list.push(b);
    byKey.set(key, list);
  }

  const selected: Array<{ key: string; source: BudgetPeriodGrain; rows: T[] }> = [];
  for (const [key, rows] of byKey.entries()) {
    const available = new Set(rows.map((r) => budgetRecordGrain(r)));
    const source = pickBudgetSourceGrain(available, view);
    if (!source) continue;
    const sourceRows = filterRowsForSourceGrain(
      rows,
      source,
      options?.month,
      options?.quarter
    ) as T[];
    if (sourceRows.length === 0) continue;
    selected.push({ key, source, rows: sourceRows });
  }
  return selected;
}

/**
 * Resolve which budget rows to use for KPI lines for a given view.
 * Returns a de-duplicated list of source rows (one grain per vessel+code).
 */
export function selectBudgetRowsForPeriodView<T extends BudgetAmountRecord>(
  budgets: T[],
  view: BudgetPeriodGrain,
  options?: { month?: number; quarter?: number }
): T[] {
  return selectBudgetSourceGroupsForPeriodView(budgets, view, options).flatMap((g) => g.rows);
}

/**
 * Build monthly assigned amounts for charts: prefer explicit month rows;
 * otherwise spread yearly/quarterly evenly across months in the year.
 */
export function buildAllocatedByMonthWithFallback(
  budgets: BudgetAmountRecord[]
): { byMonth: Map<number, number>; annualUnscoped: number; derivedFromFallback: boolean } {
  const byMonth = new Map<number, number>();
  let annualUnscoped = 0;
  let quarterlyTotal = 0;
  let hasMonthly = false;
  let hasYearly = false;
  let hasQuarterly = false;

  for (const budget of budgets) {
    const grain = budgetRecordGrain(budget);
    const monthly = num(budget.monthlyAmount);
    if (grain === "monthly") {
      hasMonthly = true;
      const m = budget.budgetMonth;
      if (m != null && m >= 1 && m <= 12) {
        byMonth.set(m, (byMonth.get(m) ?? 0) + monthly);
      }
    } else if (grain === "quarterly") {
      hasQuarterly = true;
      const q = budget.budgetQuarter;
      const quarterAmount = allocatedAmountForPeriodType(monthly, "quarterly");
      if (q != null && q >= 1 && q <= 4) {
        const months = [q * 3 - 2, q * 3 - 1, q * 3];
        const perMonth = quarterAmount / 3;
        for (const month of months) {
          byMonth.set(month, (byMonth.get(month) ?? 0) + perMonth);
        }
      } else {
        quarterlyTotal += quarterAmount;
      }
    } else {
      hasYearly = true;
      annualUnscoped += allocatedAmountForPeriodType(monthly, "yearly");
    }
  }

  let derivedFromFallback = false;

  if (hasMonthly) {
    return { byMonth, annualUnscoped: 0, derivedFromFallback: false };
  }

  if (hasYearly && annualUnscoped > 0) {
    derivedFromFallback = true;
    const perMonth = annualUnscoped / 12;
    for (let m = 1; m <= 12; m += 1) {
      byMonth.set(m, (byMonth.get(m) ?? 0) + perMonth);
    }
    return { byMonth, annualUnscoped: 0, derivedFromFallback };
  }

  if (hasQuarterly && quarterlyTotal > 0) {
    derivedFromFallback = true;
    const perMonth = quarterlyTotal / 12;
    for (let m = 1; m <= 12; m += 1) {
      byMonth.set(m, (byMonth.get(m) ?? 0) + perMonth);
    }
  }

  return {
    byMonth,
    annualUnscoped: hasMonthly || hasYearly ? 0 : annualUnscoped,
    derivedFromFallback,
  };
}

/**
 * KPI assigned total for a period view across all resolved source rows.
 */
export function resolveAssignedAmountForPeriodView(
  budgets: BudgetAmountRecord[],
  view: BudgetPeriodGrain,
  options?: { month?: number; quarter?: number }
): number {
  return selectBudgetSourceGroupsForPeriodView(budgets, view, options).reduce(
    (sum, g) => sum + allocatedFromSourceRows(g.rows, view, g.source),
    0
  );
}
