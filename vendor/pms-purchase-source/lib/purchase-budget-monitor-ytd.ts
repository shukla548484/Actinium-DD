import type { BudgetMonthlyMonitorPayload } from "@/lib/purchase-budget-monthly-monitor";
import type { BudgetMonitorStats } from "@/lib/purchase-budget-monitor-vs-actual";
import {
  budgetRangeMonthColumns,
  compareBudgetYearMonth,
  countMonthsInBudgetRange,
  type BudgetYearMonth,
} from "@/lib/purchase-budget-year-range";
import { roundBudgetAmount } from "@/lib/purchase-budget-amount-format";

export type BudgetMonitorYtdMetrics = {
  ytdBudget: number;
  ytdActual: number;
  ytdVariance: number;
  ytdVariancePct: number;
  forecastYearEnd: number;
  projectedVariance: number;
  elapsedMonths: number;
  totalMonths: number;
  operatingDays: number;
  operatingDaysSource: "noon_reports" | "calendar";
  budgetPerDay: number;
  actualPerDay: number;
  exposurePerDay: number;
};

function yearMonthFromDate(d: Date): BudgetYearMonth {
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** Months from range start through asOf (clamped to range end). */
export function ytdMonthKeysInRange(
  rangeFrom: BudgetYearMonth,
  rangeTo: BudgetYearMonth,
  asOf: Date = new Date()
): string[] {
  const asOfYm = yearMonthFromDate(asOf);
  const normalizedTo = compareBudgetYearMonth(asOfYm, rangeTo) <= 0 ? asOfYm : rangeTo;
  const columns = budgetRangeMonthColumns(rangeFrom, normalizedTo);
  return columns.map((c) => c.key);
}

export function countCalendarDaysInclusive(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(1, Math.floor((endUtc - startUtc) / msPerDay) + 1);
}

export function computeBudgetMonitorYtd(params: {
  stats: BudgetMonitorStats;
  monthlyBreakdown: BudgetMonthlyMonitorPayload | null;
  rangeFrom: BudgetYearMonth;
  rangeTo: BudgetYearMonth;
  operatingDays: number;
  operatingDaysSource: "noon_reports" | "calendar";
  asOf?: Date;
}): BudgetMonitorYtdMetrics {
  const asOf = params.asOf ?? new Date();
  const totalMonths = countMonthsInBudgetRange(params.rangeFrom, params.rangeTo);
  const ytdKeys = new Set(ytdMonthKeysInRange(params.rangeFrom, params.rangeTo, asOf));
  const elapsedMonths = Math.max(1, ytdKeys.size);

  let ytdBudget = 0;
  let ytdActual = 0;

  if (params.monthlyBreakdown?.columnTotals) {
    for (const [key, cell] of Object.entries(params.monthlyBreakdown.columnTotals)) {
      if (!ytdKeys.has(key)) continue;
      ytdBudget += cell.budget;
      ytdActual += cell.actual;
    }
  } else {
    const fraction = elapsedMonths / totalMonths;
    ytdBudget = params.stats.allocatedBudget * fraction;
    ytdActual = params.stats.spentBudget * fraction;
  }

  ytdBudget = roundBudgetAmount(ytdBudget);
  ytdActual = roundBudgetAmount(ytdActual);
  const ytdVariance = roundBudgetAmount(ytdBudget - ytdActual);
  const ytdVariancePct =
    ytdBudget > 0 ? roundBudgetAmount((ytdVariance / ytdBudget) * 100) : 0;

  const forecastYearEnd =
    elapsedMonths > 0
      ? roundBudgetAmount((ytdActual / elapsedMonths) * totalMonths)
      : 0;
  const projectedVariance = roundBudgetAmount(params.stats.allocatedBudget - forecastYearEnd);

  const daysDivisor = Math.max(1, params.operatingDays);

  return {
    ytdBudget,
    ytdActual,
    ytdVariance,
    ytdVariancePct,
    forecastYearEnd,
    projectedVariance,
    elapsedMonths,
    totalMonths,
    operatingDays: daysDivisor,
    operatingDaysSource: params.operatingDaysSource,
    budgetPerDay: roundBudgetAmount(params.stats.allocatedBudget / daysDivisor),
    actualPerDay: roundBudgetAmount(ytdActual / daysDivisor),
    exposurePerDay: roundBudgetAmount(params.stats.exposureBudget / daysDivisor),
  };
}
