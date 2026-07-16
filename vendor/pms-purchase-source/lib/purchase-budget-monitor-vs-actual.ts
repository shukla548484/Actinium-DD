import {
  computeBudgetExposureStatus,
  type BudgetMonitorStatus,
} from "@/lib/purchase-budget-spend";
import type { BudgetRangeMonthColumn } from "@/lib/purchase-budget-year-range";
import { roundBudgetAmount } from "@/lib/purchase-budget-amount-format";

export type BudgetVsActualL1Row = {
  l1Id: string | null;
  code: string;
  name: string;
  label: string;
  /** Set on synthetic alert rows (unbudgeted / missing code). */
  alertKind?: "unbudgeted" | "missing_code";
  budget: number;
  actual: number;
  committed: number;
  exposure: number;
  variance: number;
  variancePct: number;
  remaining: number;
  status: BudgetMonitorStatus;
};

export type BudgetMonitorStats = {
  totalBudget: number;
  allocatedBudget: number;
  spentBudget: number;
  committedBudget: number;
  exposureBudget: number;
  remainingBudget: number;
  utilizationPercentage: number;
  currency: string;
};

type BudgetStatLike = {
  budgetType?: {
    id: string;
    code: string;
    name: string;
    parent?: { id: string; code: string; name: string } | null;
  } | null;
  allocatedAmount: number;
  spentAmount: number;
  committedAmount: number;
  exposureAmount?: number;
  remainingAmount: number;
  percentageUsed?: number;
  status?: BudgetMonitorStatus;
  currency?: string;
};

function l1KeyFromStat(stat: BudgetStatLike): string {
  const parent = stat.budgetType?.parent;
  if (parent) return `l1:${parent.id}`;
  return `orphan:${stat.budgetType?.id ?? "x"}`;
}

export function buildBudgetVsActualL1Rows(budgetStats: BudgetStatLike[]): BudgetVsActualL1Row[] {
  const map = new Map<string, BudgetVsActualL1Row>();

  for (const stat of budgetStats) {
    const parent = stat.budgetType?.parent;
    const key = l1KeyFromStat(stat);
    const code = parent?.code ?? "—";
    const name = parent?.name ?? "Uncategorized";
    const budget = Number(stat.allocatedAmount) || 0;
    const actual = Number(stat.spentAmount) || 0;
    const committed = Number(stat.committedAmount) || 0;
    const exposure =
      stat.exposureAmount != null && Number.isFinite(Number(stat.exposureAmount))
        ? Number(stat.exposureAmount)
        : actual + committed;
    const remaining = Number(stat.remainingAmount) || 0;

    const existing = map.get(key);
    if (existing) {
      existing.budget += budget;
      existing.actual += actual;
      existing.committed += committed;
      existing.exposure += exposure;
      existing.remaining += remaining;
    } else {
      map.set(key, {
        l1Id: parent?.id ?? null,
        code,
        name,
        label: code === "—" ? name : `${code} ${name}`,
        budget,
        actual,
        committed,
        exposure,
        variance: 0,
        variancePct: 0,
        remaining,
        status: "ON_TRACK",
      });
    }
  }

  const rows = [...map.values()].map((row) => {
    const rounded = {
      ...row,
      budget: roundBudgetAmount(row.budget),
      actual: roundBudgetAmount(row.actual),
      committed: roundBudgetAmount(row.committed),
      exposure: roundBudgetAmount(row.exposure),
      remaining: roundBudgetAmount(row.remaining),
    };
    const { status, exposure, remaining } = computeBudgetExposureStatus(
      rounded.actual,
      rounded.committed,
      rounded.budget
    );
    const variance = roundBudgetAmount(rounded.budget - exposure);
    const variancePct =
      rounded.budget > 0 ? roundBudgetAmount((variance / rounded.budget) * 100) : 0;
    return {
      ...rounded,
      exposure,
      remaining,
      status,
      variance,
      variancePct,
    };
  });

  return rows
    .filter((r) => r.budget > 0 || r.exposure > 0)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

export function buildMissingBudgetCodeRow(params: {
  amount: number;
  committed: number;
}): BudgetVsActualL1Row | null {
  const actual = roundBudgetAmount(params.amount);
  const committed = roundBudgetAmount(params.committed);
  const exposure = actual + committed;
  if (exposure <= 0) return null;

  const { status } = computeBudgetExposureStatus(actual, committed, 0);
  return {
    l1Id: null,
    code: "—",
    name: "Missing budget code",
    label: "Missing / blank budget code on requisitions",
    budget: 0,
    actual,
    committed,
    exposure,
    variance: roundBudgetAmount(-exposure),
    variancePct: -100,
    remaining: 0,
    status: status === "ON_TRACK" ? "EXCEEDED" : status,
    alertKind: "missing_code",
  };
}

export function buildUnbudgetedSpendRow(params: {
  amount: number;
  committed: number;
}): BudgetVsActualL1Row | null {
  const actual = roundBudgetAmount(params.amount);
  const committed = roundBudgetAmount(params.committed);
  const exposure = actual + committed;
  if (exposure <= 0) return null;

  const { status, percentageUsed } = computeBudgetExposureStatus(actual, committed, 0);
  return {
    l1Id: null,
    code: "—",
    name: "Unbudgeted spend",
    label: "Unbudgeted / undefined budget codes",
    budget: 0,
    actual,
    committed,
    exposure,
    variance: roundBudgetAmount(-exposure),
    variancePct: -100,
    remaining: 0,
    status: status === "ON_TRACK" ? "EXCEEDED" : status,
    alertKind: "unbudgeted",
  };
}

export function buildMonitorStats(
  budgetStats: BudgetStatLike[],
  currency = "USD"
): BudgetMonitorStats {
  const totalBudget = budgetStats.reduce((sum, b) => sum + (Number(b.allocatedAmount) || 0), 0);
  const spentBudget = budgetStats.reduce((sum, b) => sum + (Number(b.spentAmount) || 0), 0);
  const committedBudget = budgetStats.reduce((sum, b) => sum + (Number(b.committedAmount) || 0), 0);
  const exposureBudget = spentBudget + committedBudget;
  const remainingBudgetTotal = totalBudget - exposureBudget;
  const utilizationPercentage = totalBudget > 0 ? (exposureBudget / totalBudget) * 100 : 0;

  return {
    totalBudget: roundBudgetAmount(totalBudget),
    allocatedBudget: roundBudgetAmount(totalBudget),
    spentBudget: roundBudgetAmount(spentBudget),
    committedBudget: roundBudgetAmount(committedBudget),
    exposureBudget: roundBudgetAmount(exposureBudget),
    remainingBudget: roundBudgetAmount(remainingBudgetTotal),
    utilizationPercentage: roundBudgetAmount(utilizationPercentage),
    currency,
  };
}

/** Prorate a period budget total evenly across monitor month columns. */
export function prorateBudgetToMonthColumns(
  periodBudgetTotal: number,
  columns: BudgetRangeMonthColumn[]
): Record<string, number> {
  if (columns.length === 0 || periodBudgetTotal <= 0) {
    return Object.fromEntries(columns.map((c) => [c.key, 0]));
  }
  const perMonth = periodBudgetTotal / columns.length;
  return Object.fromEntries(columns.map((c) => [c.key, roundBudgetAmount(perMonth)]));
}

export type BudgetMonthlyCell = {
  budget: number;
  actual: number;
  committed: number;
  variance: number;
};

export function emptyMonthlyCell(): BudgetMonthlyCell {
  return { budget: 0, actual: 0, committed: 0, variance: 0 };
}

export function finalizeMonthlyCell(
  budget: number,
  actual: number,
  committed = 0
): BudgetMonthlyCell {
  const b = roundBudgetAmount(budget);
  const a = roundBudgetAmount(actual);
  const c = roundBudgetAmount(committed);
  return { budget: b, actual: a, committed: c, variance: roundBudgetAmount(b - a) };
}
