import prisma from "@/lib/prisma";
import {
  fetchCommittedByVesselAndBudgetCode,
  fetchSpendByVesselAndBudgetCode,
  getRequisitionDateRangeForBudget,
  type BudgetVarianceActualsSource,
} from "@/lib/purchase-budget-variance";
import { parsePurchaseBudgetScope, PURCHASE_BUDGET_SCOPE } from "@/lib/purchase-budget-scope";
import type { PurchaseBudgetScope } from "@/lib/purchase-budget-scope";
import { findPurchaseBudgetsCompat } from "@/lib/purchase-budget-schema-compat";
import {
  computePurchaseBudgetMonthlyMonitor,
  parseCsvIds,
  type BudgetMonthlyMonitorPayload,
} from "@/lib/purchase-budget-monthly-monitor";
import {
  formatBudgetYearMonthRangeLabel,
  isBudgetRecordInYearMonthRange,
  type BudgetYearMonth,
  yearMonthRangeToDateBounds,
} from "@/lib/purchase-budget-year-range";
import {
  buildBudgetVsActualL1Rows,
  buildMissingBudgetCodeRow,
  buildMonitorStats,
  buildUnbudgetedSpendRow,
  type BudgetMonitorStats,
  type BudgetVsActualL1Row,
} from "@/lib/purchase-budget-monitor-vs-actual";
import {
  applyAccrualActualsToStats,
  buildBudgetStats,
  sumUnbudgetedExposure,
  type BuiltBudgetStat,
} from "@/lib/purchase-budget-monitor-build";
import {
  fetchAccrualExposure,
  projectRecurringAccrualsByMonth,
} from "@/lib/purchase-budget-accrual";
import { buildCashFlowForecast, type CashFlowForecastPayload } from "@/lib/purchase-budget-cash-flow-forecast";
import { computePmsBudgetForecast } from "@/lib/purchase-budget-monitor-pms-forecast";
import { loadBudgetVersionLinesAsCompat } from "@/lib/purchase-budget-version";
import {
  parsePurchaseBudgetFundType,
  type PurchaseBudgetFundType,
} from "@/lib/purchase-budget-fund-type";
import { sumMissingBudgetCodeExposure } from "@/lib/purchase-budget-monitor-missing-code";
import {
  computeBudgetMonitorYtd,
  countCalendarDaysInclusive,
  ytdMonthKeysInRange,
  type BudgetMonitorYtdMetrics,
} from "@/lib/purchase-budget-monitor-ytd";
import { FLAT_V4_SUBMITTED_STATUSES } from "@/lib/noon-report-flat-v4-status";
import {
  parseBudgetPostingBasis,
  type BudgetPostingBasis,
} from "@/lib/purchase-budget-posting-basis";

export type PurchaseBudgetMonitorQuery = {
  vesselId?: string | null;
  year?: string | null;
  yearEnd?: string | null;
  month?: string | null;
  monthFrom?: string | null;
  monthTo?: string | null;
  dryDockProjectId?: string | null;
  budgetScope?: PurchaseBudgetScope | string | null;
  requisitionType?: string | null;
  machineryInstanceIds?: string[];
  machineryInstanceId?: string | null;
  l1BudgetTypeIds?: string[];
  actualsSource?: BudgetVarianceActualsSource;
  postingBasis?: BudgetPostingBasis;
  fundType?: PurchaseBudgetFundType | string | null;
  budgetVersionId?: string | null;
};

export type PurchaseBudgetMonitorPayload = {
  budgets: BuiltBudgetStat[];
  stats: BudgetMonitorStats;
  budgetVsActualL1: BudgetVsActualL1Row[];
  monthlyBreakdown: BudgetMonthlyMonitorPayload | null;
  ytdMetrics: BudgetMonitorYtdMetrics | null;
  actualsSource: BudgetVarianceActualsSource;
  postingBasis: BudgetPostingBasis;
  fundType: PurchaseBudgetFundType | null;
  budgetVersionId: string | null;
  accrualActual: number;
  pmsForecastTotal: number;
  cashFlowForecast: CashFlowForecastPayload | null;
  periodLabel: string;
  rangeFrom: BudgetYearMonth;
  rangeTo: BudgetYearMonth;
};

function appendAlertRow(
  stats: BudgetMonitorStats,
  rows: BudgetVsActualL1Row[],
  alertRow: BudgetVsActualL1Row | null
): BudgetVsActualL1Row[] {
  if (!alertRow) return rows;
  const exposureBudget = stats.exposureBudget + alertRow.exposure;
  const remainingBudget = stats.allocatedBudget - exposureBudget;
  Object.assign(stats, {
    spentBudget: stats.spentBudget + alertRow.actual,
    committedBudget: stats.committedBudget + alertRow.committed,
    exposureBudget,
    remainingBudget,
    utilizationPercentage:
      stats.allocatedBudget > 0 ? (exposureBudget / stats.allocatedBudget) * 100 : 0,
  });
  return [...rows, alertRow];
}

export async function loadPurchaseBudgetMonitorPayload(
  query: PurchaseBudgetMonitorQuery
): Promise<PurchaseBudgetMonitorPayload> {
  const dryDockProjectId = query.dryDockProjectId ?? null;
  const budgetScope = parsePurchaseBudgetScope(query.budgetScope);
  const vesselId = query.vesselId ?? null;
  const year = query.year ?? null;
  const yearEnd = query.yearEnd ?? null;
  const month = query.month ?? null;
  const monthFrom = query.monthFrom ?? null;
  const monthTo = query.monthTo ?? null;
  const requisitionType = query.requisitionType ?? null;
  const machineryInstanceIds = query.machineryInstanceIds ?? [];
  const machineryInstanceId = query.machineryInstanceId ?? null;
  const l1BudgetTypeIds = query.l1BudgetTypeIds ?? [];
  const actualsSource: BudgetVarianceActualsSource =
    query.actualsSource === "invoice" ? "invoice" : "po";
  const postingBasis = parseBudgetPostingBasis(query.postingBasis ?? null);
  const fundType = parsePurchaseBudgetFundType(
    typeof query.fundType === "string" ? query.fundType : null
  );
  const budgetVersionId = query.budgetVersionId?.trim() || null;

  const machineryFilterIds =
    machineryInstanceIds.length > 0
      ? machineryInstanceIds
      : machineryInstanceId && machineryInstanceId !== "all"
        ? [machineryInstanceId]
        : [];

  const where: {
    vesselId?: string;
    budgetYear?: number;
    budgetYearEnd?: number;
    budgetMonth?: number;
    dryDockProjectId?: string | null;
  } = {};

  if (vesselId && vesselId !== "all") where.vesselId = vesselId;
  if (year) where.budgetYear = parseInt(year, 10);
  if (yearEnd) where.budgetYearEnd = parseInt(yearEnd, 10);
  if (month) where.budgetMonth = parseInt(month, 10);
  if (dryDockProjectId) {
    where.dryDockProjectId = dryDockProjectId;
  } else if (budgetScope === PURCHASE_BUDGET_SCOPE.NORMAL) {
    where.dryDockProjectId = null;
  } else if (budgetScope === PURCHASE_BUDGET_SCOPE.DRY_DOCK) {
    where.dryDockProjectId = null;
  }

  let budgets: Awaited<ReturnType<typeof findPurchaseBudgetsCompat>> = [];

  if (budgetVersionId) {
    const versionBudgets = await loadBudgetVersionLinesAsCompat(budgetVersionId);
    if (versionBudgets) budgets = versionBudgets as typeof budgets;
  } else {
    budgets = await findPurchaseBudgetsCompat({
      where: where as Record<string, unknown>,
      budgetScope,
    });
  }

  if (fundType) {
    budgets = budgets.filter((b) => {
      const rowFund = (b.budgetType as { fundType?: PurchaseBudgetFundType }).fundType;
      return rowFund === fundType;
    });
  }

  const budgetYearParsed = year ? parseInt(year, 10) : budgets[0]?.budgetYear ?? new Date().getFullYear();
  const budgetYearEndParsed = yearEnd
    ? parseInt(yearEnd, 10)
    : budgets[0]?.budgetYearEnd ?? budgetYearParsed;

  const rangeFrom: BudgetYearMonth = {
    year: budgetYearParsed,
    month: monthFrom ? parseInt(monthFrom, 10) : 1,
  };
  const rangeTo: BudgetYearMonth = {
    year: budgetYearEndParsed,
    month: monthTo ? parseInt(monthTo, 10) : 12,
  };
  const periodLabel = formatBudgetYearMonthRangeLabel(rangeFrom, rangeTo);

  if (year && monthFrom && monthTo) {
    budgets = budgets.filter((b) => isBudgetRecordInYearMonthRange(b, rangeFrom, rangeTo));
  }

  if (l1BudgetTypeIds.length > 0) {
    const l1Set = new Set(l1BudgetTypeIds);
    budgets = budgets.filter((b) => {
      const parentId = b.budgetType.parent?.id;
      return parentId != null && l1Set.has(parentId);
    });
  }

  const hasRowFilters =
    (requisitionType && requisitionType !== "all") || machineryFilterIds.length > 0;

  const budgetMonth = month ? parseInt(month, 10) : budgets[0]?.budgetMonth ?? undefined;
  const { startDate, endDate } =
    year && monthFrom && monthTo
      ? yearMonthRangeToDateBounds(rangeFrom, rangeTo)
      : getRequisitionDateRangeForBudget(
          budgetYearParsed,
          budgetMonth ?? null,
          budgetYearEndParsed
        );

  const budgetStats = await buildBudgetStats({
    budgets,
    startDate,
    endDate,
    actualsSource,
    postingBasis,
    hasRowFilters,
    requisitionType,
    machineryFilterIds,
  });

  let accrualActual = 0;
  let accrualByMonth = new Map<string, number>();
  let recurringByMonth = new Map<string, number>();
  let pmsForecastTotal = 0;
  let pmsByMonth = new Map<string, number>();

  if (vesselId && vesselId !== "all") {
    const accrual = await fetchAccrualExposure({
      vesselId,
      rangeFrom,
      rangeTo,
      budgetScope,
      dryDockProjectId,
      fundType,
    });
    accrualActual = accrual.totalActual;
    accrualByMonth = accrual.byMonth;
    applyAccrualActualsToStats(budgetStats, accrual.byBudgetCode);

    const recurringRows = await prisma.purchaseBudgetAccrualEntry.findMany({
      where: {
        vesselId,
        isRecurring: true,
        accrualYear: { gte: rangeFrom.year, lte: rangeTo.year },
      },
      select: { accrualYear: true, accrualMonth: true, amount: true },
    });
    recurringByMonth = projectRecurringAccrualsByMonth({
      rangeFrom,
      rangeTo,
      recurringEntries: recurringRows.map((r) => ({
        accrualYear: r.accrualYear,
        accrualMonth: r.accrualMonth,
        amount: Number(r.amount) || 0,
      })),
    });

    const pms = await computePmsBudgetForecast({ vesselId, rangeFrom, rangeTo });
    pmsForecastTotal = pms.totalForecast;
    pmsByMonth = pms.byMonth;
  }

  const currency = budgetStats.find((b) => b.currency)?.currency ?? "USD";
  const stats = buildMonitorStats(budgetStats, currency);
  if (accrualActual > 0) {
    stats.spentBudget += accrualActual;
    stats.exposureBudget += accrualActual;
    stats.remainingBudget = stats.allocatedBudget - stats.exposureBudget;
    stats.utilizationPercentage =
      stats.allocatedBudget > 0 ? (stats.exposureBudget / stats.allocatedBudget) * 100 : 0;
  }
  let budgetVsActualL1 = buildBudgetVsActualL1Rows(budgetStats);

  let monthlyBreakdown: BudgetMonthlyMonitorPayload | null = null;

  if (vesselId && vesselId !== "all") {
    const definedBudgets = budgets
      .filter((b) => b.budgetType.parent?.id)
      .map((b) => ({
        l2Code: b.budgetType.code,
        l1Id: b.budgetType.parent!.id,
        yearlyAmount: Number(b.yearlyAmount),
        currency: b.currency,
      }));

    monthlyBreakdown = await computePurchaseBudgetMonthlyMonitor({
      vesselId,
      rangeFrom,
      rangeTo,
      budgetScope,
      filters: {
        requisitionType,
        machineryInstanceIds: machineryFilterIds,
        l1BudgetTypeIds,
      },
        actualsSource,
        postingBasis,
        definedBudgets,
      });

    const definedL2Codes = new Set(budgets.map((b) => b.budgetType.code));
    const vesselIds = [vesselId];
    const [spendMap, committedMap, missingCode] = await Promise.all([
      fetchSpendByVesselAndBudgetCode({
        vesselIds,
        startDate,
        endDate,
        actualsSource,
        postingBasis,
      }),
      fetchCommittedByVesselAndBudgetCode({ vesselIds, startDate, endDate, actualsSource }),
      sumMissingBudgetCodeExposure({
        vesselId,
        startDate,
        endDate,
        actualsSource,
        postingBasis,
        budgetScope,
        requisitionType,
        machineryFilterIds,
      }),
    ]);

    const unbudgeted = sumUnbudgetedExposure({
      vesselId,
      definedL2Codes,
      spendMap,
      committedMap,
    });

    budgetVsActualL1 = appendAlertRow(
      stats,
      budgetVsActualL1,
      buildUnbudgetedSpendRow({ amount: unbudgeted.actual, committed: unbudgeted.committed })
    );
    budgetVsActualL1 = appendAlertRow(
      stats,
      budgetVsActualL1,
      buildMissingBudgetCodeRow({
        amount: missingCode.actual,
        committed: missingCode.committed,
      })
    );
  }

  let ytdMetrics: BudgetMonitorYtdMetrics | null = null;
  if (vesselId && vesselId !== "all") {
    const ytdKeys = ytdMonthKeysInRange(rangeFrom, rangeTo);
    const { startDate: ytdStart } = yearMonthRangeToDateBounds(rangeFrom, rangeTo);
    const lastKey = ytdKeys[ytdKeys.length - 1];
    const [yStr, mStr] = (lastKey ?? `${rangeFrom.year}-${rangeFrom.month}`).split("-");
    const ytdEndDate = new Date(
      Math.min(
        Date.now(),
        new Date(parseInt(yStr, 10), parseInt(mStr, 10), 0, 23, 59, 59, 999).getTime()
      )
    );

    const noonReportDays = await prisma.noonReportFlatV4.count({
      where: {
        vesselId,
        reportDate: { gte: ytdStart, lte: ytdEndDate },
        status: { in: [...FLAT_V4_SUBMITTED_STATUSES] },
      },
    });

    const calendarDays = countCalendarDaysInclusive(ytdStart, ytdEndDate);
    const operatingDays = noonReportDays > 0 ? noonReportDays : calendarDays;
    const operatingDaysSource = noonReportDays > 0 ? "noon_reports" : "calendar";

    ytdMetrics = computeBudgetMonitorYtd({
      stats,
      monthlyBreakdown,
      rangeFrom,
      rangeTo,
      operatingDays,
      operatingDaysSource,
    });
  }

  if (monthlyBreakdown && accrualByMonth.size > 0) {
    monthlyBreakdown = {
      ...monthlyBreakdown,
      accrualByMonth: Object.fromEntries(accrualByMonth.entries()),
    };
  }

  const cashFlowForecast = buildCashFlowForecast({
    monthlyBreakdown,
    accrualByMonth,
    recurringByMonth,
    pmsByMonth,
  });

  return {
    budgets: budgetStats,
    stats,
    budgetVsActualL1,
    monthlyBreakdown,
    ytdMetrics,
    actualsSource,
    postingBasis,
    fundType,
    budgetVersionId,
    accrualActual,
    pmsForecastTotal,
    cashFlowForecast,
    periodLabel,
    rangeFrom,
    rangeTo,
  };
}

export function parseMonitorQueryFromSearchParams(
  searchParams: URLSearchParams
): PurchaseBudgetMonitorQuery {
  const machineryInstanceIds = parseCsvIds(searchParams.get("machineryInstanceIds"));
  const machineryInstanceId = searchParams.get("machineryInstanceId");
  return {
    vesselId: searchParams.get("vesselId"),
    year: searchParams.get("year"),
    yearEnd: searchParams.get("yearEnd"),
    month: searchParams.get("month"),
    monthFrom: searchParams.get("monthFrom"),
    monthTo: searchParams.get("monthTo"),
    dryDockProjectId: searchParams.get("dryDockProjectId"),
    budgetScope: searchParams.get("budgetScope"),
    requisitionType: searchParams.get("requisitionType"),
    machineryInstanceIds,
    machineryInstanceId,
    l1BudgetTypeIds: parseCsvIds(searchParams.get("l1BudgetTypeIds")),
    actualsSource: searchParams.get("actualsSource") === "invoice" ? "invoice" : "po",
    postingBasis: parseBudgetPostingBasis(searchParams.get("postingBasis")),
    fundType: searchParams.get("fundType"),
    budgetVersionId: searchParams.get("budgetVersionId"),
  };
}
