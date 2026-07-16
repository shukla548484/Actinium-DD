/** Year span for a vessel purchase budget definition (e.g. 2026–2027). */

export type BudgetYearMonth = { year: number; month: number };

export const BUDGET_MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(2000, i).toLocaleString("default", { month: "long" }),
}));

export function compareBudgetYearMonth(a: BudgetYearMonth, b: BudgetYearMonth): number {
  const yearDelta = a.year - b.year;
  return yearDelta !== 0 ? yearDelta : a.month - b.month;
}

export function normalizeBudgetYearEnd(startYear: number, endYear: number): number {
  return endYear < startYear ? startYear : endYear;
}

export function normalizeBudgetYearMonthEnd(
  start: BudgetYearMonth,
  end: BudgetYearMonth
): BudgetYearMonth {
  return compareBudgetYearMonth(end, start) < 0 ? { ...start } : end;
}

export function formatBudgetYearRangeLabel(startYear: number, endYear?: number | null): string {
  const end = endYear ?? startYear;
  return end === startYear ? String(startYear) : `${startYear}–${end}`;
}

export function formatBudgetYearMonthLabel(
  ym: BudgetYearMonth,
  style: "short" | "long" = "short"
): string {
  const month =
    style === "short"
      ? new Date(2000, ym.month - 1).toLocaleString("default", { month: "short" })
      : new Date(2000, ym.month - 1).toLocaleString("default", { month: "long" });
  return `${month} ${ym.year}`;
}

export function formatBudgetYearMonthRangeLabel(from: BudgetYearMonth, to: BudgetYearMonth): string {
  const normalizedTo = normalizeBudgetYearMonthEnd(from, to);
  if (from.year === normalizedTo.year && from.month === normalizedTo.month) {
    return formatBudgetYearMonthLabel(from);
  }
  return `${formatBudgetYearMonthLabel(from)} – ${formatBudgetYearMonthLabel(normalizedTo)}`;
}

export function isSingleBudgetYearMonth(from: BudgetYearMonth, to: BudgetYearMonth): boolean {
  const normalizedTo = normalizeBudgetYearMonthEnd(from, to);
  return from.year === normalizedTo.year && from.month === normalizedTo.month;
}

export function yearMonthRangeToDateBounds(
  from: BudgetYearMonth,
  to: BudgetYearMonth
): { startDate: Date; endDate: Date } {
  const normalizedTo = normalizeBudgetYearMonthEnd(from, to);
  return {
    startDate: new Date(from.year, from.month - 1, 1),
    endDate: new Date(normalizedTo.year, normalizedTo.month, 0, 23, 59, 59, 999),
  };
}

export function defaultBudgetYearMonthRange(
  anchorYear = new Date().getFullYear()
): { from: BudgetYearMonth; to: BudgetYearMonth } {
  return { from: { year: anchorYear, month: 1 }, to: { year: anchorYear, month: 12 } };
}

export function countMonthsInBudgetRange(from: BudgetYearMonth, to: BudgetYearMonth): number {
  const normalized = normalizeBudgetYearMonthEnd(from, to);
  return Math.max(1, (normalized.year - from.year) * 12 + (normalized.month - from.month) + 1);
}

export function countYearsInBudgetRange(from: BudgetYearMonth, to: BudgetYearMonth): number {
  const normalized = normalizeBudgetYearMonthEnd(from, to);
  return Math.max(1, normalized.year - from.year + 1);
}

export function isFullCalendarYearRange(from: BudgetYearMonth, to: BudgetYearMonth): boolean {
  const normalized = normalizeBudgetYearMonthEnd(from, to);
  return from.month === 1 && normalized.month === 12 && from.year === normalized.year;
}

export type BudgetRangeMonthColumn = {
  key: string;
  year: number;
  month: number;
  label: string;
};

function monthColumnKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Ordered month columns for tables/charts across a year–month range. */
export function budgetRangeMonthColumns(
  from: BudgetYearMonth,
  to: BudgetYearMonth
): BudgetRangeMonthColumn[] {
  const normalized = normalizeBudgetYearMonthEnd(from, to);
  const columns: BudgetRangeMonthColumn[] = [];
  let year = from.year;
  let month = from.month;
  while (year < normalized.year || (year === normalized.year && month <= normalized.month)) {
    columns.push({
      key: monthColumnKey(year, month),
      year,
      month,
      label: formatBudgetYearMonthLabel({ year, month }, "short"),
    });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return columns;
}

/** Months (1–12) that fall within an inclusive year–month range. */
export function monthsWithinBudgetRange(from: BudgetYearMonth, to: BudgetYearMonth): number[] {
  const normalized = normalizeBudgetYearMonthEnd(from, to);
  const months: number[] = [];
  let year = from.year;
  let month = from.month;
  while (year < normalized.year || (year === normalized.year && month <= normalized.month)) {
    months.push(month);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

export function clampMonthToBudgetRange(
  month: number,
  from: BudgetYearMonth,
  to: BudgetYearMonth
): number {
  const allowed = monthsWithinBudgetRange(from, to);
  if (allowed.includes(month)) return month;
  return allowed[0] ?? from.month;
}

export function isBudgetRecordInYearMonthRange(
  record: {
    budgetYear: number;
    budgetYearEnd?: number | null;
    budgetMonth?: number | null;
  },
  from: BudgetYearMonth,
  to: BudgetYearMonth
): boolean {
  const normalizedTo = normalizeBudgetYearMonthEnd(from, to);

  if (record.budgetMonth != null && record.budgetMonth >= 1 && record.budgetMonth <= 12) {
    const ym: BudgetYearMonth = { year: record.budgetYear, month: record.budgetMonth };
    return (
      compareBudgetYearMonth(ym, from) >= 0 && compareBudgetYearMonth(ym, normalizedTo) <= 0
    );
  }

  const recStart: BudgetYearMonth = { year: record.budgetYear, month: 1 };
  const recEnd: BudgetYearMonth = {
    year: record.budgetYearEnd ?? record.budgetYear,
    month: 12,
  };
  return (
    compareBudgetYearMonth(recEnd, from) >= 0 && compareBudgetYearMonth(recStart, normalizedTo) <= 0
  );
}

/** Calendar years available in filter dropdowns (current ± 2, plus one ahead). */
export function buildBudgetYearOptions(anchorYear = new Date().getFullYear()): number[] {
  return Array.from({ length: 6 }, (_, i) => anchorYear - 2 + i);
}

export function suggestedYearEndForPeriodType(
  startYear: number,
  periodType: string
): number {
  if (periodType === "five_yearly") return startYear + 4;
  return startYear;
}
