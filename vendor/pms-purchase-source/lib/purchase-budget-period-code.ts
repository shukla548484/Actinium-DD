import { periodTypeLabel, type BudgetPeriodType } from "@/lib/purchase-budget-period";
import {
  PURCHASE_BUDGET_SCOPE,
  type PurchaseBudgetScope,
} from "@/lib/purchase-budget-scope";
import { isFullCalendarYearRange } from "@/lib/purchase-budget-year-range";

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTH_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function shortYear(year: number): string {
  const s = String(year);
  return s.length >= 2 ? s.slice(-2) : s;
}

function yearSpanSegment(startYear: number, endYear?: number | null): string {
  const end = endYear ?? startYear;
  return end === startYear ? String(startYear) : `${startYear}-${end}`;
}

function periodSuffix(periodType: BudgetPeriodType): string {
  switch (periodType) {
    case "monthly":
      return "M";
    case "quarterly":
      return "Q";
    case "five_yearly":
      return "5Y";
    case "dry_docking":
      return "DD";
    case "yearly":
    default:
      return "Y";
  }
}

function monthSegment(year: number, month: number, style: "short" | "full" = "full"): string {
  const label = style === "short" ? MONTH_SHORT[month - 1] : MONTH_FULL[month - 1];
  return `${shortYear(year)}${label}`;
}

function quarterMonthRange(quarter: 1 | 2 | 3 | 4): { startMonth: number; endMonth: number } {
  const startMonth = (quarter - 1) * 3 + 1;
  return { startMonth, endMonth: startMonth + 2 };
}

export type BudgetPeriodCodeInput = {
  budgetYear: number;
  budgetYearEnd?: number | null;
  budgetMonth?: number | null;
  budgetQuarter?: number | null;
  periodType: BudgetPeriodType;
  /** Inclusive month range from the budget filter (1–12). */
  rangeFromMonth?: number | null;
  rangeToMonth?: number | null;
};

export type BudgetDeclarationNumberInput = BudgetPeriodCodeInput & {
  budgetScope?: PurchaseBudgetScope;
  /** Dry dock project number when budgets are project-scoped. */
  dryDockProjectNumber?: string | null;
};

/** Build a stable declaration id, e.g. 2026-2027-Y, 26March-M, 26Jan-26Mar-Q. */
export function buildPurchaseBudgetPeriodCode(input: BudgetPeriodCodeInput): string {
  const {
    budgetYear,
    budgetYearEnd,
    budgetMonth,
    budgetQuarter,
    periodType,
    rangeFromMonth,
    rangeToMonth,
  } = input;
  const endYear = budgetYearEnd ?? budgetYear;
  const suffix = periodSuffix(periodType);
  const fromMonth = rangeFromMonth ?? 1;
  const toMonth = rangeToMonth ?? 12;

  if (periodType === "monthly" && budgetMonth != null && budgetMonth >= 1 && budgetMonth <= 12) {
    return `${monthSegment(budgetYear, budgetMonth, "full")}-${suffix}`;
  }

  if (periodType === "quarterly" && budgetQuarter != null && budgetQuarter >= 1 && budgetQuarter <= 4) {
    const { startMonth, endMonth } = quarterMonthRange(budgetQuarter as 1 | 2 | 3 | 4);
    return `${monthSegment(budgetYear, startMonth, "short")}-${monthSegment(budgetYear, endMonth, "short")}-${suffix}`;
  }

  const usesMonthRange =
    periodType === "yearly" ||
    periodType === "five_yearly" ||
    periodType === "dry_docking";

  if (
    usesMonthRange &&
    fromMonth >= 1 &&
    fromMonth <= 12 &&
    toMonth >= 1 &&
    toMonth <= 12 &&
    !isFullCalendarYearRange(
      { year: budgetYear, month: fromMonth },
      { year: endYear, month: toMonth }
    )
  ) {
    return `${monthSegment(budgetYear, fromMonth, "short")}-${monthSegment(endYear, toMonth, "short")}-${suffix}`;
  }

  return `${yearSpanSegment(budgetYear, endYear)}-${suffix}`;
}

/** Unique budget declaration number for a vessel + period selection. */
export function buildPurchaseBudgetDeclarationNumber(
  vesselCode: string | null | undefined,
  input: BudgetDeclarationNumberInput
): string {
  const periodCode = buildPurchaseBudgetPeriodCode(input);
  const segments: string[] = [];
  const vessel = String(vesselCode ?? "").trim();
  if (vessel) segments.push(vessel);
  if (input.budgetScope === PURCHASE_BUDGET_SCOPE.DRY_DOCK) {
    segments.push("DD");
    const projectNumber = String(input.dryDockProjectNumber ?? "").trim();
    if (projectNumber) segments.push(projectNumber);
  }
  segments.push(periodCode);
  return segments.join("-");
}

export function formatPurchaseBudgetPeriodCodeLabel(
  code: string,
  periodType?: BudgetPeriodType
): string {
  if (periodType) return `${code} (${periodTypeLabel(periodType)})`;
  return code;
}

export function inferBudgetPeriodTypeFromRecord(row: {
  budgetMonth?: number | null;
  budgetQuarter?: number | null;
  budgetYear: number;
  budgetYearEnd?: number | null;
  budgetPeriodType?: string | null;
}): BudgetPeriodType {
  if (row.budgetPeriodType) {
    const t = row.budgetPeriodType as BudgetPeriodType;
    if (
      t === "monthly" ||
      t === "quarterly" ||
      t === "yearly" ||
      t === "five_yearly" ||
      t === "dry_docking"
    ) {
      return t;
    }
  }
  if (row.budgetMonth != null && row.budgetMonth >= 1 && row.budgetMonth <= 12) return "monthly";
  if (row.budgetQuarter != null && row.budgetQuarter >= 1 && row.budgetQuarter <= 4) {
    return "quarterly";
  }
  const end = row.budgetYearEnd ?? row.budgetYear;
  if (end >= row.budgetYear + 4) return "five_yearly";
  return "yearly";
}

export function resolveBudgetPeriodCodeForRecord(row: {
  budgetYear: number;
  budgetYearEnd?: number | null;
  budgetMonth?: number | null;
  budgetQuarter?: number | null;
  budgetPeriodType?: string | null;
  budgetPeriodCode?: string | null;
}): string {
  if (row.budgetPeriodCode?.trim()) return row.budgetPeriodCode.trim();
  return buildPurchaseBudgetPeriodCode({
    budgetYear: row.budgetYear,
    budgetYearEnd: row.budgetYearEnd,
    budgetMonth: row.budgetMonth,
    budgetQuarter: row.budgetQuarter,
    periodType: inferBudgetPeriodTypeFromRecord(row),
  });
}

export type ParsedBudgetPeriodMonthRange = {
  from: { year: number; month: number };
  to: { year: number; month: number };
};

/** Parse a custom month span embedded in a period code (e.g. 26Mar-26Aug-Y). */
export function parseBudgetPeriodCodeMonthRange(code: string): ParsedBudgetPeriodMonthRange | null {
  const trimmed = String(code ?? "").trim();
  const match = trimmed.match(
    /^(\d{2})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-/
  );
  if (!match) return null;

  const fromMonth = MONTH_SHORT.indexOf(match[2] as (typeof MONTH_SHORT)[number]) + 1;
  const toMonth = MONTH_SHORT.indexOf(match[4] as (typeof MONTH_SHORT)[number]) + 1;
  if (fromMonth < 1 || toMonth < 1) return null;

  const century = Math.floor(new Date().getFullYear() / 100) * 100;
  const fromYear = century + parseInt(match[1], 10);
  const toYear = century + parseInt(match[3], 10);

  return {
    from: { year: fromYear, month: fromMonth },
    to: { year: toYear, month: toMonth },
  };
}

export type BudgetDeclarationOption = {
  code: string;
  label: string;
  periodType: BudgetPeriodType;
  budgetYear: number;
  budgetYearEnd: number;
  budgetMonth: number | null;
  budgetQuarter: number | null;
  /** Latest declaration timestamp for this code (ISO). */
  lastDeclaredAt: string | null;
  lineCount: number;
};

export function declarationToPeriodCodeInput(
  decl: Pick<
    BudgetDeclarationOption,
    "budgetYear" | "budgetYearEnd" | "budgetMonth" | "budgetQuarter" | "periodType"
  >
): BudgetPeriodCodeInput {
  return {
    budgetYear: decl.budgetYear,
    budgetYearEnd: decl.budgetYearEnd,
    budgetMonth: decl.budgetMonth,
    budgetQuarter: decl.budgetQuarter,
    periodType: decl.periodType,
  };
}

export function matchesDeclarationFilter(
  row: {
    budgetYear: number;
    budgetYearEnd?: number | null;
    budgetMonth?: number | null;
    budgetQuarter?: number | null;
    budgetPeriodType?: string | null;
    budgetPeriodCode?: string | null;
  },
  code: string,
  periodType?: BudgetPeriodType
): boolean {
  return (
    resolveBudgetPeriodCodeForRecord(row) === code &&
    (!periodType || inferBudgetPeriodTypeFromRecord(row) === periodType)
  );
}
