import { roundBudgetAmount } from "@/lib/purchase-budget-amount-format";
import {
  countMonthsInBudgetRange,
  countYearsInBudgetRange,
  type BudgetYearMonth,
} from "@/lib/purchase-budget-year-range";

export type BudgetPeriodType =
  | "monthly"
  | "quarterly"
  | "yearly"
  | "five_yearly"
  | "dry_docking";

export type BudgetPeriodSpan = {
  monthsInRange: number;
  yearsInRange: number;
};

export function resolveBudgetPeriodSpan(
  from: BudgetYearMonth,
  to: BudgetYearMonth
): BudgetPeriodSpan {
  return {
    monthsInRange: countMonthsInBudgetRange(from, to),
    yearsInRange: countYearsInBudgetRange(from, to),
  };
}

export const BUDGET_PERIOD_TYPE_OPTIONS: { value: BudgetPeriodType; label: string }[] = [
  { value: "yearly", label: "Yearly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "five_yearly", label: "5 yearly" },
  { value: "dry_docking", label: "Dry docking" },
];

export interface DerivedBudgetAmounts {
  monthlyAmount: number;
  quarterlyAmount: number;
  yearlyAmount: number;
  dailyAmount: number;
  /** Present when the active period type is five_yearly. */
  fiveYearlyAmount?: number;
}

/** Convert user-entered amount (in selected period) to stored monthly amount. */
export function periodAmountToMonthly(
  amount: number,
  periodType: BudgetPeriodType,
  span?: BudgetPeriodSpan
): number {
  if (periodType === "monthly") return amount;
  if (periodType === "quarterly") return amount / 3;
  if (periodType === "five_yearly") {
    const months = span ? span.yearsInRange * 12 : 60;
    return amount / Math.max(1, months);
  }
  if (periodType === "dry_docking") {
    return amount / Math.max(1, span?.monthsInRange ?? 12);
  }
  return amount / Math.max(1, span?.monthsInRange ?? 12);
}

/** Convert stored monthly amount to display amount for the selected period. */
export function monthlyToPeriodAmount(
  monthlyAmount: number,
  periodType: BudgetPeriodType,
  span?: BudgetPeriodSpan
): number {
  if (periodType === "monthly") return monthlyAmount;
  if (periodType === "quarterly") return monthlyAmount * 3;
  if (periodType === "five_yearly") {
    const months = span ? span.yearsInRange * 12 : 60;
    return monthlyAmount * Math.max(1, months);
  }
  if (periodType === "dry_docking") {
    return monthlyAmount * Math.max(1, span?.monthsInRange ?? 12);
  }
  return monthlyAmount * Math.max(1, span?.monthsInRange ?? 12);
}

/** Derive monthly, quarterly, yearly, and daily from a stored monthly amount. */
export function deriveBudgetAmountsFromMonthly(
  monthlyAmount: number
): DerivedBudgetAmounts {
  const monthly = Number.isFinite(monthlyAmount) ? monthlyAmount : 0;
  const yearlyAmount = monthly * 12;
  return {
    monthlyAmount: monthly,
    quarterlyAmount: yearlyAmount / 4,
    yearlyAmount,
    dailyAmount: yearlyAmount / 365,
    fiveYearlyAmount: yearlyAmount * 5,
  };
}

/** Derive all period amounts from user input in the selected period type. */
export function deriveBudgetAmountsFromPeriod(
  amount: number,
  periodType: BudgetPeriodType,
  span?: BudgetPeriodSpan
): DerivedBudgetAmounts {
  return deriveBudgetAmountsFromMonthly(periodAmountToMonthly(amount, periodType, span));
}

/**
 * Derive Monthly / Quarterly / Yearly display columns from the amount entered for the
 * active period type. The active period keeps the entered value; other columns are
 * proportional conversions (e.g. yearly 100,000 → monthly 100,000/12, not ×12).
 */
export function deriveBudgetDisplayAmounts(
  periodAmount: number,
  periodType: BudgetPeriodType,
  span?: BudgetPeriodSpan
): DerivedBudgetAmounts {
  const amount = Number.isFinite(periodAmount) ? periodAmount : 0;
  const monthsInRange = Math.max(1, span?.monthsInRange ?? 12);

  switch (periodType) {
    case "monthly": {
      const yearly = roundBudgetAmount(amount * 12);
      return {
        monthlyAmount: roundBudgetAmount(amount),
        quarterlyAmount: roundBudgetAmount(yearly / 4),
        yearlyAmount: yearly,
        dailyAmount: roundBudgetAmount(yearly / 365),
        fiveYearlyAmount: roundBudgetAmount(yearly * 5),
      };
    }
    case "quarterly": {
      const yearly = roundBudgetAmount(amount * 4);
      return {
        monthlyAmount: roundBudgetAmount(amount / 3),
        quarterlyAmount: roundBudgetAmount(amount),
        yearlyAmount: yearly,
        dailyAmount: roundBudgetAmount(yearly / 365),
        fiveYearlyAmount: roundBudgetAmount(yearly * 5),
      };
    }
    case "five_yearly": {
      const months = span ? span.yearsInRange * 12 : 60;
      const monthly = roundBudgetAmount(amount / Math.max(1, months));
      const yearly = roundBudgetAmount(monthly * 12);
      return {
        monthlyAmount: monthly,
        quarterlyAmount: roundBudgetAmount(yearly / 4),
        yearlyAmount: yearly,
        dailyAmount: roundBudgetAmount(yearly / 365),
        fiveYearlyAmount: roundBudgetAmount(amount),
      };
    }
    case "dry_docking":
    case "yearly":
    default:
      return {
        monthlyAmount: roundBudgetAmount(amount / monthsInRange),
        quarterlyAmount: roundBudgetAmount(amount / 4),
        yearlyAmount: roundBudgetAmount(amount),
        dailyAmount: roundBudgetAmount(amount / 365),
        fiveYearlyAmount: roundBudgetAmount(amount * 5),
      };
  }
}

export function periodTypeLabel(periodType: BudgetPeriodType): string {
  const found = BUDGET_PERIOD_TYPE_OPTIONS.find((o) => o.value === periodType);
  return found?.label ?? periodType;
}

export function periodAmountColumnLabel(periodType: BudgetPeriodType): string {
  switch (periodType) {
    case "monthly":
      return "Monthly budget";
    case "quarterly":
      return "Quarterly budget";
    case "five_yearly":
      return "5-year budget";
    case "dry_docking":
      return "Dry docking budget";
    case "yearly":
    default:
      return "Yearly budget";
  }
}

/** Column header for define-matrix amount input (allocated budget for selected period). */
export function allocatedBudgetColumnLabel(periodType: BudgetPeriodType): string {
  return `Allocated budget (${periodTypeLabel(periodType)})`;
}

export function matchesBudgetPeriod(
  budgetMonth: number | null | undefined,
  budgetQuarter: number | null | undefined,
  periodType: BudgetPeriodType,
  month?: number,
  quarter?: number
): boolean {
  if (periodType === "monthly") {
    return budgetMonth === month && (budgetQuarter == null || budgetQuarter === undefined);
  }
  if (periodType === "quarterly") {
    return (budgetMonth == null || budgetMonth === undefined) && budgetQuarter === quarter;
  }
  return (budgetMonth == null || budgetMonth === undefined) && (budgetQuarter == null || budgetQuarter === undefined);
}

export function resolveBudgetMonthQuarter(
  periodType: BudgetPeriodType,
  month?: number,
  quarter?: number
): { budgetMonth: number | null; budgetQuarter: number | null } {
  if (periodType === "monthly") {
    return { budgetMonth: month ?? null, budgetQuarter: null };
  }
  if (periodType === "quarterly") {
    return { budgetMonth: null, budgetQuarter: quarter ?? null };
  }
  return { budgetMonth: null, budgetQuarter: null };
}

/** Allocated amount for charts/tables for the active period type. */
export function allocatedAmountForPeriodType(
  monthlyAmount: number,
  periodType: BudgetPeriodType
): number {
  const derived = deriveBudgetAmountsFromMonthly(monthlyAmount);
  if (periodType === "monthly") return derived.monthlyAmount;
  if (periodType === "quarterly") return derived.quarterlyAmount;
  if (periodType === "five_yearly") return derived.fiveYearlyAmount ?? derived.yearlyAmount * 5;
  if (periodType === "dry_docking") return derived.yearlyAmount;
  return derived.yearlyAmount;
}
