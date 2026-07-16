import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  BUDGET_SPEND_PERIOD_FIELD,
  computeBudgetExposureStatus,
  fetchCommittedByVesselAndBudgetCode,
  fetchSpendByVesselAndBudgetCode,
  getRequisitionDateRangeForBudget,
  remainingBudget,
  spendMapKey,
  utilizationPct,
  type BudgetMonitorStatus,
} from "@/lib/purchase-budget-spend";
import type { BudgetPeriodType } from "@/lib/purchase-budget-period";
import {
  allocatedFromSourceRows,
  selectBudgetSourceGroupsForPeriodView,
  toBudgetPeriodGrain,
} from "@/lib/purchase-budget-period-fallback";
import { findPurchaseBudgetsForVariance, findPurchaseBudgetYearlyByCode } from "@/lib/purchase-budget-schema-compat";

export {
  BUDGET_SPEND_PERIOD_FIELD,
  BUDGET_WARNING_UTILIZATION_PCT,
  PIPELINE_REQUISITION_STATUSES,
  budgetExposure,
  computeBudgetExposureStatus,
  effectiveBudgetCode,
  fetchCommittedByVesselAndBudgetCode,
  fetchSpendByVesselAndBudgetCode,
  getRequisitionDateRangeForBudget,
  remainingBudget,
  spendMapKey,
  utilizationPct,
} from "@/lib/purchase-budget-spend";
export type { BudgetMonitorStatus } from "@/lib/purchase-budget-spend";

export type BudgetVarianceFleetSummary = {
  allocated: number;
  committed: number;
  spent: number;
  exposure: number;
  variance: number;
  remaining: number;
  utilizationPct: number;
  warningCount: number;
  exceededCount: number;
};

export type BudgetVarianceByVessel = {
  vesselId: string;
  vesselName: string;
  allocated: number;
  committed: number;
  spent: number;
  exposure: number;
  variance: number;
  remaining: number;
  utilizationPct: number;
};

export type BudgetVarianceOverrunLine = {
  code: string;
  name: string;
  parentName: string | null;
  vesselId?: string;
  vesselName?: string;
  allocated: number;
  committed: number;
  spent: number;
  exposure: number;
  utilizationPct: number;
  status: BudgetMonitorStatus;
};

export type BudgetVarianceByL1 = {
  parentCode: string;
  parentName: string;
  allocated: number;
  committed: number;
  spent: number;
  exposure: number;
  variance: number;
  remaining: number;
  utilizationPct: number;
  warningCount: number;
  exceededCount: number;
};

/** L1 section rollup for one vessel (for dashboard vessel cards). */
export type BudgetVarianceVesselL1Slice = {
  vesselId: string;
  vesselName: string;
  parentCode: string;
  parentName: string;
  allocated: number;
  committed: number;
  spent: number;
  exposure: number;
  variance: number;
  utilizationPct: number;
};

export type PurchaseBudgetVarianceResult = {
  year: number;
  month?: number;
  fleetSummary: BudgetVarianceFleetSummary;
  byVessel: BudgetVarianceByVessel[];
  topOverrunL2: BudgetVarianceOverrunLine[];
  byL1: BudgetVarianceByL1[];
  byVesselL1: BudgetVarianceVesselL1Slice[];
};

export type BudgetVariancePeriod = "yearly" | "monthly" | "quarterly";

/** Section = L1/L2 purchase budget categories; machinery = noon machinery type; store = STR sub-category proxy. */
export type BudgetVarianceDimension = "section" | "machinery" | "store";

export type BudgetVariancePeriodPoint = {
  periodKey: string;
  periodLabel: string;
  allocated: number;
  committed: number;
  spent: number;
  exposure: number;
  variance: number;
  remaining: number;
  utilizationPct: number;
};

export type BudgetVarianceConsumer = {
  key: string;
  label: string;
  kind: "vessel" | "category" | "dimension";
  vesselId?: string;
  vesselName?: string;
  budgetCode?: string;
  allocated: number;
  committed: number;
  spent: number;
  exposure: number;
  variance: number;
  remaining: number;
  utilizationPct: number;
};

export type PurchaseBudgetVarianceEnhancedResult = PurchaseBudgetVarianceResult & {
  period: BudgetVariancePeriod;
  dimension: BudgetVarianceDimension;
  actualsSource: BudgetVarianceActualsSource;
  periodBreakdown: BudgetVariancePeriodPoint[];
  topConsumers: BudgetVarianceConsumer[];
  underUtilized: BudgetVarianceConsumer[];
};

export type BudgetVarianceActualsSource = "po" | "invoice";

/**
 * Store dimension: physical store location when requisition.store_location_id is set;
 * otherwise STR sub-category code as store-class proxy.
 */
export const STORE_DIMENSION_STR_PROXY_NOTE =
  "Store view uses physical store location when set on STR requisitions; otherwise rolls up by sub-category code (store-class proxy).";

/** How PO totals are split across machinery groups (see drilldown SQL). */
export const PO_MACHINERY_ATTRIBUTION_NOTE =
  "PO total is attributed to the requisition budget code; for machinery drilldown, spend is split evenly across requisition item lines that have a machinery instance, then rolled up by machinery type (noon group key). POs with no machinery-tagged lines count as Unassigned.";

export const PO_SUBCATEGORY_ATTRIBUTION_NOTE =
  "Full PO amount is attributed to the requisition sub-category and L2 budget code on the requisition header.";

export type BudgetVarianceDrilldownDimension = "machinery" | "subcategory" | "store";

export type BudgetVarianceDrilldownRow = {
  groupKey: string;
  groupLabel: string;
  budgetCode: string | null;
  budgetName: string | null;
  spent: number;
  committed?: number;
  poCount: number;
  requisitionCount: number;
  /** Physical store location row. */
  storeLocationId?: string;
  /** STR store-class proxy rows (sub-category default L2 for STR requisitions). */
  isStrStoreProxy?: boolean;
  /** Fleet sum of PurchaseBudget.yearlyAmount for this L2 code when declarations exist. */
  allocated?: number;
};

export type BudgetVarianceDrilldownResult = {
  year: number;
  month?: number;
  dimension: BudgetVarianceDrilldownDimension;
  actualsSource: BudgetVarianceActualsSource;
  attributionNote: string;
  rows: BudgetVarianceDrilldownRow[];
  /** Present when dimension=subcategory: STR-type rollup by sub-category (store class proxy). */
  strStoreProxyRows?: BudgetVarianceDrilldownRow[];
};

export function getFleetVarianceDateRange(year: number, month?: number): { startDate: Date; endDate: Date } {
  if (month != null && month >= 1 && month <= 12) {
    return getRequisitionDateRangeForBudget(year, month);
  }
  return getRequisitionDateRangeForBudget(year, null);
}

export function getVariancePeriodDateRange(
  year: number,
  period: BudgetVariancePeriod,
  options?: { month?: number; quarter?: number }
): { startDate: Date; endDate: Date } {
  if (period === "monthly") {
    const m = options?.month ?? new Date().getMonth() + 1;
    return getRequisitionDateRangeForBudget(year, m);
  }
  if (period === "quarterly") {
    const q = options?.quarter ?? Math.ceil((new Date().getMonth() + 1) / 3);
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    return {
      startDate: new Date(year, startMonth - 1, 1),
      endDate: new Date(year, endMonth, 0, 23, 59, 59, 999),
    };
  }
  return getRequisitionDateRangeForBudget(year, null);
}

// getRequisitionDateRangeForBudget lives in purchase-budget-spend (re-exported above).

/** Backward-compatible status using exposure = spent only (committed=0). */
export function computeBudgetMonitorStatus(
  spent: number,
  allocated: number
): { status: BudgetMonitorStatus; percentageUsed: number } {
  const { status, percentageUsed } = computeBudgetExposureStatus(spent, 0, allocated);
  return { status, percentageUsed };
}

export function sumPurchaseOrderSpend(
  purchaseOrders: Array<{ totalAmount: unknown }>
): number {
  return purchaseOrders.reduce((sum, po) => sum + (Number(po.totalAmount) || 0), 0);
}

type BudgetRow = {
  vesselId: string;
  vesselName: string;
  budgetCode: string;
  budgetName: string;
  level: number;
  parentCode: string | null;
  parentName: string | null;
  allocated: number;
};

type BudgetCodeMeta = {
  name: string;
  level: number;
  parentCode: string | null;
  parentName: string | null;
};

type VarianceLine = BudgetRow & {
  spent: number;
  committed: number;
  exposure: number;
  status: BudgetMonitorStatus;
  utilizationPct: number;
};

/** Names and L1 parent for L2 codes (master catalog). */
export async function loadBudgetMetaByCode(codes: string[]): Promise<Map<string, BudgetCodeMeta>> {
  const map = new Map<string, BudgetCodeMeta>();
  const unique = [...new Set(codes.filter(Boolean))];
  if (unique.length === 0) return map;

  const masters = await prisma.purchaseBudgetCategoryMaster.findMany({
    where: { code: { in: unique } },
    include: { parent: { select: { code: true, name: true } } },
  });
  for (const m of masters) {
    map.set(m.code, {
      name: m.name,
      level: m.level,
      parentCode: m.parent?.code ?? null,
      parentName: m.parent?.name ?? null,
    });
  }
  return map;
}

function parseSpendMapKey(key: string): { vesselId: string; budgetCode: string } | null {
  const sep = key.indexOf("::");
  if (sep < 0) return null;
  const vesselId = key.slice(0, sep);
  const budgetCode = key.slice(sep + 2).trim();
  if (!vesselId || !budgetCode) return null;
  return { vesselId, budgetCode };
}

function collectSpendMapBudgetCodes(
  spendMap: Map<string, number>,
  committedMap: Map<string, number>
): string[] {
  const codes = new Set<string>();
  for (const key of [...spendMap.keys(), ...committedMap.keys()]) {
    const parsed = parseSpendMapKey(key);
    if (parsed) codes.add(parsed.budgetCode);
  }
  return [...codes];
}

/** Include PO/pipeline spend for codes with no vessel PurchaseBudget declaration (allocated = 0). */
function appendSpendOnlyVarianceLines(params: {
  lines: VarianceLine[];
  spendMap: Map<string, number>;
  committedMap: Map<string, number>;
  vesselIds: string[];
  vesselNameById: Map<string, string>;
  metaByCode: Map<string, BudgetCodeMeta>;
}): void {
  const { lines, spendMap, committedMap, vesselIds, vesselNameById, metaByCode } = params;
  const vesselIdSet = new Set(vesselIds);
  const covered = new Set(lines.map((l) => spendMapKey(l.vesselId, l.budgetCode)));
  const extraKeys = new Set<string>();
  for (const key of spendMap.keys()) {
    if (!covered.has(key)) extraKeys.add(key);
  }
  for (const key of committedMap.keys()) {
    if (!covered.has(key)) extraKeys.add(key);
  }

  for (const key of extraKeys) {
    const parsed = parseSpendMapKey(key);
    if (!parsed || !vesselIdSet.has(parsed.vesselId)) continue;

    const spent = spendMap.get(key) ?? 0;
    const committed = committedMap.get(key) ?? 0;
    if (spent <= 0 && committed <= 0) continue;

    const meta = metaByCode.get(parsed.budgetCode);
    const { status, percentageUsed, exposure } = computeBudgetExposureStatus(
      spent,
      committed,
      0
    );
    lines.push({
      vesselId: parsed.vesselId,
      vesselName: vesselNameById.get(parsed.vesselId) ?? parsed.vesselId,
      budgetCode: parsed.budgetCode,
      budgetName: meta?.name ?? parsed.budgetCode,
      level: meta?.level ?? 2,
      parentCode: meta?.parentCode ?? null,
      parentName: meta?.parentName ?? null,
      allocated: 0,
      spent,
      committed,
      exposure,
      status: status === "ON_TRACK" && exposure > 0 ? "WARNING" : status,
      utilizationPct: percentageUsed,
    });
  }
}

function emptyVarianceResult(
  year: number,
  month?: number,
  period?: BudgetVariancePeriod
): PurchaseBudgetVarianceResult {
  const fleetSummary: BudgetVarianceFleetSummary = {
    allocated: 0,
    committed: 0,
    spent: 0,
    exposure: 0,
    variance: 0,
    remaining: 0,
    utilizationPct: 0,
    warningCount: 0,
    exceededCount: 0,
  };
  return {
    year,
    month,
    period,
    fleetSummary,
    byVessel: [],
    topOverrunL2: [],
    byL1: [],
    byVesselL1: [],
  };
}

export async function computePurchaseBudgetVariance(params: {
  vesselIds: string[];
  year: number;
  month?: number;
  period?: BudgetVariancePeriod;
  periodMonth?: number;
  periodQuarter?: 1 | 2 | 3 | 4;
  vesselNameById?: Map<string, string>;
  actualsSource?: BudgetVarianceActualsSource;
}): Promise<PurchaseBudgetVarianceResult> {
  const {
    vesselIds,
    year,
    month,
    period,
    periodMonth,
    periodQuarter,
    vesselNameById,
    actualsSource = "po",
  } = params;
  if (vesselIds.length === 0) {
    return emptyVarianceResult(year, month, period);
  }

  const budgetWhere: Prisma.PurchaseBudgetWhereInput = {
    vesselId: { in: vesselIds },
    budgetYear: year,
  };
  if (month != null && month >= 1 && month <= 12) {
    budgetWhere.budgetMonth = month;
  }

  const budgets = await findPurchaseBudgetsForVariance(budgetWhere);

  const { startDate, endDate } =
    period != null
      ? getVariancePeriodDateRange(year, period, {
          month: periodMonth ?? month,
          quarter: periodQuarter,
        })
      : getFleetVarianceDateRange(year, month);

  const periodType: BudgetPeriodType | undefined = period;
  const periodGrain = periodType ? toBudgetPeriodGrain(periodType) : null;

  const [spendMap, committedMap] = await Promise.all([
    fetchSpendByVesselAndBudgetCode({ vesselIds, startDate, endDate, actualsSource }),
    fetchCommittedByVesselAndBudgetCode({ vesselIds, startDate, endDate, actualsSource }),
  ]);

  const lines: VarianceLine[] = [];

  if (periodGrain) {
    const groups = selectBudgetSourceGroupsForPeriodView(budgets, periodGrain, {
      month: periodMonth ?? month,
      quarter: periodQuarter,
    });
    for (const group of groups) {
      const sample = group.rows[0];
      if (!sample) continue;
      const allocated = allocatedFromSourceRows(group.rows, periodGrain, group.source);
      const budgetCode = sample.budgetType.code;
      const key = spendMapKey(sample.vesselId, budgetCode);
      const spent = spendMap.get(key) ?? 0;
      const committed = committedMap.get(key) ?? 0;
      const { status, percentageUsed, exposure } = computeBudgetExposureStatus(
        spent,
        committed,
        allocated
      );
      lines.push({
        vesselId: sample.vesselId,
        vesselName:
          vesselNameById?.get(sample.vesselId) ?? sample.vessel?.name ?? sample.vesselId,
        budgetCode,
        budgetName: sample.budgetType.name,
        level: sample.budgetType.level,
        parentCode: sample.budgetType.parent?.code ?? null,
        parentName: sample.budgetType.parent?.name ?? null,
        allocated,
        spent,
        committed,
        exposure,
        status,
        utilizationPct: percentageUsed,
      });
    }
  } else {
    for (const budget of budgets) {
      const allocated = Number(budget.yearlyAmount) || 0;
      const budgetCode = budget.budgetType.code;
      const key = spendMapKey(budget.vesselId, budgetCode);
      const spent = spendMap.get(key) ?? 0;
      const committed = committedMap.get(key) ?? 0;
      const { status, percentageUsed, exposure } = computeBudgetExposureStatus(
        spent,
        committed,
        allocated
      );
      lines.push({
        vesselId: budget.vesselId,
        vesselName:
          vesselNameById?.get(budget.vesselId) ?? budget.vessel?.name ?? budget.vesselId,
        budgetCode,
        budgetName: budget.budgetType.name,
        level: budget.budgetType.level,
        parentCode: budget.budgetType.parent?.code ?? null,
        parentName: budget.budgetType.parent?.name ?? null,
        allocated,
        spent,
        committed,
        exposure,
        status,
        utilizationPct: percentageUsed,
      });
    }
  }

  const vesselNameByIdResolved = new Map(vesselNameById ?? []);
  for (const budget of budgets) {
    vesselNameByIdResolved.set(
      budget.vesselId,
      vesselNameByIdResolved.get(budget.vesselId) ??
        budget.vessel?.name ??
        budget.vesselId
    );
  }

  const spendCodes = collectSpendMapBudgetCodes(spendMap, committedMap);
  const metaByCode = await loadBudgetMetaByCode([
    ...lines.map((l) => l.budgetCode),
    ...spendCodes,
  ]);

  const unresolvedVesselIds = vesselIds.filter((id) => !vesselNameByIdResolved.has(id));
  if (unresolvedVesselIds.length > 0) {
    const vessels = await prisma.vessel.findMany({
      where: { id: { in: unresolvedVesselIds } },
      select: { id: true, name: true },
    });
    for (const v of vessels) {
      vesselNameByIdResolved.set(v.id, v.name);
    }
  }

  appendSpendOnlyVarianceLines({
    lines,
    spendMap,
    committedMap,
    vesselIds,
    vesselNameById: vesselNameByIdResolved,
    metaByCode,
  });

  let warningCount = 0;
  let exceededCount = 0;
  let totalAllocated = 0;
  let totalSpent = 0;
  let totalCommitted = 0;

  const vesselAgg = new Map<
    string,
    { vesselName: string; allocated: number; spent: number; committed: number }
  >();

  const l1Agg = new Map<
    string,
    {
      parentName: string;
      allocated: number;
      spent: number;
      committed: number;
      warningCount: number;
      exceededCount: number;
    }
  >();

  const l2Overruns: BudgetVarianceOverrunLine[] = [];
  const vesselL1Agg = new Map<
    string,
    {
      vesselName: string;
      parentCode: string;
      parentName: string;
      allocated: number;
      spent: number;
      committed: number;
    }
  >();

  for (const line of lines) {
    totalAllocated += line.allocated;
    totalSpent += line.spent;
    totalCommitted += line.committed;
    if (line.status === "WARNING") warningCount += 1;
    if (line.status === "EXCEEDED") exceededCount += 1;

    const v = vesselAgg.get(line.vesselId) ?? {
      vesselName: line.vesselName,
      allocated: 0,
      spent: 0,
      committed: 0,
    };
    v.allocated += line.allocated;
    v.spent += line.spent;
    v.committed += line.committed;
    vesselAgg.set(line.vesselId, v);

    if (line.level === 2) {
      l2Overruns.push({
        code: line.budgetCode,
        name: line.budgetName,
        parentName: line.parentName,
        vesselId: line.vesselId,
        vesselName: line.vesselName,
        allocated: line.allocated,
        committed: line.committed,
        spent: line.spent,
        exposure: line.exposure,
        utilizationPct: line.utilizationPct,
        status: line.status,
      });
    }

    const parentKey = line.parentCode ?? line.budgetCode;
    const l1 = l1Agg.get(parentKey) ?? {
      parentName: line.parentName ?? line.budgetName,
      allocated: 0,
      spent: 0,
      committed: 0,
      warningCount: 0,
      exceededCount: 0,
    };
    l1.allocated += line.allocated;
    l1.spent += line.spent;
    l1.committed += line.committed;
    if (line.status === "WARNING") l1.warningCount += 1;
    if (line.status === "EXCEEDED") l1.exceededCount += 1;
    l1Agg.set(parentKey, l1);

    const vesselL1Key = `${line.vesselId}\0${parentKey}`;
    const vl1 = vesselL1Agg.get(vesselL1Key) ?? {
      vesselName: line.vesselName,
      parentCode: parentKey,
      parentName: line.parentName ?? line.budgetName,
      allocated: 0,
      spent: 0,
      committed: 0,
    };
    vl1.allocated += line.allocated;
    vl1.spent += line.spent;
    vl1.committed += line.committed;
    vesselL1Agg.set(vesselL1Key, vl1);
  }

  const totalExposure = totalSpent + totalCommitted;

  const byVessel: BudgetVarianceByVessel[] = [...vesselAgg.entries()]
    .map(([vesselId, v]) => {
      const exposure = v.spent + v.committed;
      return {
        vesselId,
        vesselName: v.vesselName,
        allocated: v.allocated,
        committed: v.committed,
        spent: v.spent,
        exposure,
        variance: v.allocated - exposure,
        remaining: remainingBudget(v.allocated, v.spent, v.committed),
        utilizationPct: utilizationPct(exposure, v.allocated),
      };
    })
    .sort((a, b) => b.utilizationPct - a.utilizationPct);

  const topOverrunL2 = l2Overruns
    .filter((r) => r.status !== "ON_TRACK")
    .sort((a, b) => b.utilizationPct - a.utilizationPct)
    .slice(0, 5);

  const byL1: BudgetVarianceByL1[] = [...l1Agg.entries()]
    .map(([parentCode, v]) => {
      const exposure = v.spent + v.committed;
      return {
        parentCode,
        parentName: v.parentName,
        allocated: v.allocated,
        committed: v.committed,
        spent: v.spent,
        exposure,
        variance: v.allocated - exposure,
        remaining: remainingBudget(v.allocated, v.spent, v.committed),
        utilizationPct: utilizationPct(exposure, v.allocated),
        warningCount: v.warningCount,
        exceededCount: v.exceededCount,
      };
    })
    .sort((a, b) => b.utilizationPct - a.utilizationPct);

  const byVesselL1: BudgetVarianceVesselL1Slice[] = [...vesselL1Agg.entries()]
    .map(([key, v]) => {
      const vesselId = key.split("\0")[0] ?? "";
      const exposure = v.spent + v.committed;
      return {
        vesselId,
        vesselName: v.vesselName,
        parentCode: v.parentCode,
        parentName: v.parentName,
        allocated: v.allocated,
        committed: v.committed,
        spent: v.spent,
        exposure,
        variance: v.allocated - exposure,
        utilizationPct: utilizationPct(exposure, v.allocated),
      };
    })
    .filter((s) => s.allocated > 0 || s.exposure > 0)
    .sort(
      (a, b) =>
        a.vesselName.localeCompare(b.vesselName) ||
        a.parentCode.localeCompare(b.parentCode, undefined, { numeric: true })
    );

  return {
    year,
    month,
    period,
    fleetSummary: {
      allocated: totalAllocated,
      committed: totalCommitted,
      spent: totalSpent,
      exposure: totalExposure,
      variance: totalAllocated - totalExposure,
      remaining: remainingBudget(totalAllocated, totalSpent, totalCommitted),
      utilizationPct: utilizationPct(totalExposure, totalAllocated),
      warningCount,
      exceededCount,
    },
    byVessel,
    topOverrunL2,
    byL1,
    byVesselL1,
  };
}

const MACHINERY_TYPE_LABELS: Record<string, string> = {
  MAIN_ENGINE: "Main engine",
  GENERATOR: "Generator",
  BOILER: "Boiler",
  IGG: "IGG",
  UNASSIGNED: "Unassigned machinery",
};

function machineryGroupLabel(key: string): string {
  const upper = key.toUpperCase();
  return MACHINERY_TYPE_LABELS[upper] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type DrilldownAggRow = {
  group_key: string;
  budget_code: string | null;
  spent: unknown;
  po_count: unknown;
  requisition_count: unknown;
};

async function loadBudgetNames(codes: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(codes.filter(Boolean))];
  if (unique.length === 0) return map;

  const masters = await prisma.purchaseBudgetCategoryMaster.findMany({
    where: { code: { in: unique }, level: 2 },
    select: { code: true, name: true },
  });
  for (const m of masters) {
    map.set(m.code, m.name);
  }
  return map;
}

async function loadAllocatedByBudgetCode(params: {
  vesselIds: string[];
  year: number;
  month?: number;
}): Promise<Map<string, number>> {
  const { vesselIds, year, month } = params;
  const map = new Map<string, number>();
  if (vesselIds.length === 0) return map;

  const where: Prisma.PurchaseBudgetWhereInput = {
    vesselId: { in: vesselIds },
    budgetYear: year,
  };
  if (month != null && month >= 1 && month <= 12) {
    where.budgetMonth = month;
  }

  const budgets = await findPurchaseBudgetYearlyByCode(where);

  for (const budget of budgets) {
    const code = budget.budgetType.code;
    const amt = Number(budget.yearlyAmount) || 0;
    map.set(code, (map.get(code) ?? 0) + amt);
  }
  return map;
}

function buildDrilldownRows(
  raw: DrilldownAggRow[],
  dimension: BudgetVarianceDrilldownDimension,
  budgetNames: Map<string, string>,
  strProxy = false,
  allocatedByCode?: Map<string, number>,
  storeLabels?: Map<string, string>
): BudgetVarianceDrilldownRow[] {
  return raw
    .map((row) => {
      const groupKey = row.group_key || "UNASSIGNED";
      const budgetCode = row.budget_code?.trim() || null;
      let groupLabel: string;
      let storeLocationId: string | undefined;
      let isStrStoreProxy = strProxy;

      if (dimension === "machinery") {
        groupLabel = machineryGroupLabel(groupKey);
      } else if (dimension === "store") {
        if (groupKey.startsWith("loc:")) {
          storeLocationId = groupKey.slice(4);
          groupLabel = storeLabels?.get(groupKey) ?? "Store location";
          isStrStoreProxy = false;
        } else {
          const sub = groupKey.startsWith("subcat:") ? groupKey.slice(7) : groupKey;
          groupLabel = `${sub} (sub-category proxy)`;
          isStrStoreProxy = true;
        }
      } else {
        const baseLabel = groupKey;
        groupLabel =
          strProxy && dimension === "subcategory"
            ? `${baseLabel} (STR store proxy)`
            : baseLabel;
      }

      const allocated =
        budgetCode && allocatedByCode?.has(budgetCode)
          ? allocatedByCode.get(budgetCode)
          : undefined;
      return {
        groupKey,
        groupLabel,
        budgetCode,
        budgetName: budgetCode ? budgetNames.get(budgetCode) ?? null : null,
        spent: Number(row.spent) || 0,
        poCount: Number(row.po_count) || 0,
        requisitionCount: Number(row.requisition_count) || 0,
        ...(allocated != null ? { allocated } : {}),
        ...(storeLocationId ? { storeLocationId } : {}),
        ...(isStrStoreProxy ? { isStrStoreProxy: true } : {}),
      };
    })
    .sort((a, b) => b.spent - a.spent);
}

/**
 * Machinery drilldown: line-count split of PO total across items with machinery_instance_id,
 * rolled up by machinery.machinery_type (noon group key). Invoice actuals use full invoice per requisition
 * with the same line split when items exist.
 */
async function fetchMachineryDrilldownSpend(params: {
  vesselIds: string[];
  startDate: Date;
  endDate: Date;
  actualsSource: BudgetVarianceActualsSource;
}): Promise<DrilldownAggRow[]> {
  const { vesselIds, startDate, endDate, actualsSource } = params;
  if (vesselIds.length === 0) return [];

  if (actualsSource === "invoice") {
    return prisma.$queryRaw<DrilldownAggRow[]>`
      WITH req_invoices AS (
        SELECT r.id AS requisition_id, COALESCE(SUM(i.invoice_amount), 0) AS amount
        FROM invoices i
        INNER JOIN requisitions r ON i.requisition_id = r.id
        WHERE i.status NOT IN ('CANCELLED', 'RETURNED')
          AND r.vessel_id IN (${Prisma.join(vesselIds)})
          AND r.budget_code IS NOT NULL
          AND r.date_of_creation >= ${startDate}
          AND r.date_of_creation <= ${endDate}
        GROUP BY r.id
      ),
      item_groups AS (
        SELECT
          ri.requisition_id,
          ri.id AS item_id,
          COALESCE(NULLIF(TRIM(m.machinery_type), ''), 'UNASSIGNED') AS group_key,
          r.budget_code
        FROM requisition_items ri
        INNER JOIN requisitions r ON ri.requisition_id = r.id
        LEFT JOIN machinery_instances mi ON ri.machinery_instance_id = mi.id
        LEFT JOIN machinery m ON mi.machinery_id = m.id
        WHERE r.vessel_id IN (${Prisma.join(vesselIds)})
          AND r.budget_code IS NOT NULL
          AND r.date_of_creation >= ${startDate}
          AND r.date_of_creation <= ${endDate}
          AND ri.machinery_instance_id IS NOT NULL
      ),
      mach_line_counts AS (
        SELECT requisition_id, COUNT(*)::int AS line_count
        FROM item_groups
        GROUP BY requisition_id
      ),
      attributed AS (
        SELECT
          ig.group_key,
          ig.budget_code,
          ri.requisition_id,
          CASE
            WHEN mc.line_count > 0 THEN ri.amount / mc.line_count
            ELSE ri.amount
          END AS attributed_amount
        FROM req_invoices ri
        INNER JOIN item_groups ig ON ig.requisition_id = ri.requisition_id
        INNER JOIN mach_line_counts mc ON mc.requisition_id = ri.requisition_id
        UNION ALL
        SELECT
          'UNASSIGNED' AS group_key,
          r.budget_code,
          ri.requisition_id,
          ri.amount AS attributed_amount
        FROM req_invoices ri
        INNER JOIN requisitions r ON r.id = ri.requisition_id
        WHERE NOT EXISTS (
          SELECT 1 FROM requisition_items x
          WHERE x.requisition_id = ri.requisition_id AND x.machinery_instance_id IS NOT NULL
        )
      )
      SELECT
        group_key,
        budget_code,
        COALESCE(SUM(attributed_amount), 0) AS spent,
        COUNT(DISTINCT requisition_id)::int AS requisition_count,
        COUNT(DISTINCT requisition_id)::int AS po_count
      FROM attributed
      GROUP BY group_key, budget_code
      ORDER BY spent DESC
    `;
  }

  return prisma.$queryRaw<DrilldownAggRow[]>`
    WITH po_base AS (
      SELECT po.id AS po_id, po.requisition_id, po.total_amount AS amount
      FROM purchase_orders po
      INNER JOIN requisitions r ON po.requisition_id = r.id
      WHERE po.status <> 'CANCELLED'
        AND r.vessel_id IN (${Prisma.join(vesselIds)})
        AND r.budget_code IS NOT NULL
        AND r.date_of_creation >= ${startDate}
        AND r.date_of_creation <= ${endDate}
    ),
    item_groups AS (
      SELECT
        ri.requisition_id,
        ri.id AS item_id,
        COALESCE(NULLIF(TRIM(m.machinery_type), ''), 'UNASSIGNED') AS group_key,
        r.budget_code
      FROM requisition_items ri
      INNER JOIN requisitions r ON ri.requisition_id = r.id
      LEFT JOIN machinery_instances mi ON ri.machinery_instance_id = mi.id
      LEFT JOIN machinery m ON mi.machinery_id = m.id
      WHERE r.vessel_id IN (${Prisma.join(vesselIds)})
        AND r.budget_code IS NOT NULL
        AND r.date_of_creation >= ${startDate}
        AND r.date_of_creation <= ${endDate}
        AND ri.machinery_instance_id IS NOT NULL
    ),
    mach_line_counts AS (
      SELECT requisition_id, COUNT(*)::int AS line_count
      FROM item_groups
      GROUP BY requisition_id
    ),
    attributed AS (
      SELECT
        ig.group_key,
        ig.budget_code,
        pb.po_id,
        pb.requisition_id,
        CASE
          WHEN mc.line_count > 0 THEN pb.amount / mc.line_count
          ELSE pb.amount
        END AS attributed_amount
      FROM po_base pb
      INNER JOIN item_groups ig ON ig.requisition_id = pb.requisition_id
      INNER JOIN mach_line_counts mc ON mc.requisition_id = pb.requisition_id
      UNION ALL
      SELECT
        'UNASSIGNED' AS group_key,
        r.budget_code,
        pb.po_id,
        pb.requisition_id,
        pb.amount AS attributed_amount
      FROM po_base pb
      INNER JOIN requisitions r ON r.id = pb.requisition_id
      WHERE NOT EXISTS (
        SELECT 1 FROM requisition_items x
        WHERE x.requisition_id = pb.requisition_id AND x.machinery_instance_id IS NOT NULL
      )
    )
    SELECT
      group_key,
      budget_code,
      COALESCE(SUM(attributed_amount), 0) AS spent,
      COUNT(DISTINCT po_id)::int AS po_count,
      COUNT(DISTINCT requisition_id)::int AS requisition_count
    FROM attributed
    GROUP BY group_key, budget_code
    ORDER BY spent DESC
  `;
}

/** Store drilldown: physical store location when set, else STR sub-category proxy. */
async function fetchStoreDrilldownSpend(params: {
  vesselIds: string[];
  startDate: Date;
  endDate: Date;
  actualsSource: BudgetVarianceActualsSource;
}): Promise<DrilldownAggRow[]> {
  const { vesselIds, startDate, endDate, actualsSource } = params;
  if (vesselIds.length === 0) return [];

  if (actualsSource === "invoice") {
    return prisma.$queryRaw<DrilldownAggRow[]>`
      SELECT
        CASE
          WHEN r.store_location_id IS NOT NULL THEN ('loc:' || r.store_location_id::text)
          ELSE ('subcat:' || COALESCE(NULLIF(TRIM(r.sub_category_code), ''), 'UNSPECIFIED'))
        END AS group_key,
        COALESCE(NULLIF(TRIM(po.budget_code), ''), NULLIF(TRIM(r.budget_code), '')) AS budget_code,
        COALESCE(SUM(i.invoice_amount), 0) AS spent,
        COUNT(DISTINCT r.id)::int AS requisition_count,
        COUNT(DISTINCT i.id)::int AS po_count
      FROM invoices i
      INNER JOIN requisitions r ON i.requisition_id = r.id
      LEFT JOIN purchase_orders po ON po.id = i.purchase_order_id
      WHERE i.status NOT IN ('CANCELLED', 'RETURNED')
        AND r.vessel_id IN (${Prisma.join(vesselIds)})
        AND r.requisition_type = 'STR'
        AND COALESCE(NULLIF(TRIM(po.budget_code), ''), NULLIF(TRIM(r.budget_code), '')) IS NOT NULL
        AND r.date_of_creation >= ${startDate}
        AND r.date_of_creation <= ${endDate}
      GROUP BY 1, 2
      ORDER BY spent DESC
    `;
  }

  return prisma.$queryRaw<DrilldownAggRow[]>`
    SELECT
      CASE
        WHEN r.store_location_id IS NOT NULL THEN ('loc:' || r.store_location_id::text)
        ELSE ('subcat:' || COALESCE(NULLIF(TRIM(r.sub_category_code), ''), 'UNSPECIFIED'))
      END AS group_key,
      COALESCE(NULLIF(TRIM(po.budget_code), ''), NULLIF(TRIM(r.budget_code), '')) AS budget_code,
      COALESCE(SUM(po.total_amount), 0) AS spent,
      COUNT(DISTINCT po.id)::int AS po_count,
      COUNT(DISTINCT r.id)::int AS requisition_count
    FROM purchase_orders po
    INNER JOIN requisitions r ON po.requisition_id = r.id
    WHERE po.status <> 'CANCELLED'
      AND r.vessel_id IN (${Prisma.join(vesselIds)})
      AND r.requisition_type = 'STR'
      AND COALESCE(NULLIF(TRIM(po.budget_code), ''), NULLIF(TRIM(r.budget_code), '')) IS NOT NULL
      AND r.date_of_creation >= ${startDate}
      AND r.date_of_creation <= ${endDate}
    GROUP BY 1, 2
    ORDER BY spent DESC
  `;
}

async function loadStoreLocationLabels(
  groupKeys: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = groupKeys
    .filter((k) => k.startsWith("loc:"))
    .map((k) => k.slice(4))
    .filter(Boolean);
  if (ids.length === 0) return map;

  const locations = await prisma.storeLocation.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, code: true },
  });
  for (const loc of locations) {
    map.set(`loc:${loc.id}`, loc.name || loc.code);
  }
  return map;
}

/** Sub-category drilldown: full PO (or invoice) per requisition grouped by sub_category_code + budget_code. */
async function fetchSubcategoryDrilldownSpend(params: {
  vesselIds: string[];
  startDate: Date;
  endDate: Date;
  actualsSource: BudgetVarianceActualsSource;
  requisitionType?: string;
}): Promise<DrilldownAggRow[]> {
  const { vesselIds, startDate, endDate, actualsSource, requisitionType } = params;
  if (vesselIds.length === 0) return [];

  const typeFilter =
    requisitionType != null
      ? Prisma.sql`AND r.requisition_type = ${requisitionType}`
      : Prisma.sql`AND r.sub_category_code IS NOT NULL`;

  if (actualsSource === "invoice") {
    return prisma.$queryRaw<DrilldownAggRow[]>`
      SELECT
        COALESCE(NULLIF(TRIM(r.sub_category_code), ''), 'UNSPECIFIED') AS group_key,
        r.budget_code,
        COALESCE(SUM(i.invoice_amount), 0) AS spent,
        COUNT(DISTINCT r.id)::int AS requisition_count,
        COUNT(DISTINCT i.id)::int AS po_count
      FROM invoices i
      INNER JOIN requisitions r ON i.requisition_id = r.id
      WHERE i.status NOT IN ('CANCELLED', 'RETURNED')
        AND r.vessel_id IN (${Prisma.join(vesselIds)})
        AND r.budget_code IS NOT NULL
        AND r.date_of_creation >= ${startDate}
        AND r.date_of_creation <= ${endDate}
        ${typeFilter}
      GROUP BY group_key, r.budget_code
      ORDER BY spent DESC
    `;
  }

  return prisma.$queryRaw<DrilldownAggRow[]>`
    SELECT
      COALESCE(NULLIF(TRIM(r.sub_category_code), ''), 'UNSPECIFIED') AS group_key,
      r.budget_code,
      COALESCE(SUM(po.total_amount), 0) AS spent,
      COUNT(DISTINCT po.id)::int AS po_count,
      COUNT(DISTINCT r.id)::int AS requisition_count
    FROM purchase_orders po
    INNER JOIN requisitions r ON po.requisition_id = r.id
    WHERE po.status <> 'CANCELLED'
      AND r.vessel_id IN (${Prisma.join(vesselIds)})
      AND r.budget_code IS NOT NULL
      AND r.date_of_creation >= ${startDate}
      AND r.date_of_creation <= ${endDate}
      ${typeFilter}
    GROUP BY group_key, r.budget_code
    ORDER BY spent DESC
  `;
}

export async function computePurchaseBudgetVarianceDrilldown(params: {
  vesselIds: string[];
  year: number;
  month?: number;
  dimension: BudgetVarianceDrilldownDimension;
  actualsSource?: BudgetVarianceActualsSource;
  topN?: number;
}): Promise<BudgetVarianceDrilldownResult> {
  const {
    vesselIds,
    year,
    month,
    dimension,
    actualsSource = "po",
    topN = 10,
  } = params;

  const { startDate, endDate } = getFleetVarianceDateRange(year, month);
  const attributionNote =
    dimension === "machinery"
      ? PO_MACHINERY_ATTRIBUTION_NOTE
      : dimension === "store"
        ? STORE_DIMENSION_STR_PROXY_NOTE
        : PO_SUBCATEGORY_ATTRIBUTION_NOTE;

  if (vesselIds.length === 0) {
    return {
      year,
      month,
      dimension,
      actualsSource,
      attributionNote,
      rows: [],
      ...(dimension === "subcategory" ? { strStoreProxyRows: [] } : {}),
    };
  }

  const raw =
    dimension === "machinery"
      ? await fetchMachineryDrilldownSpend({ vesselIds, startDate, endDate, actualsSource })
      : dimension === "store"
        ? await fetchStoreDrilldownSpend({ vesselIds, startDate, endDate, actualsSource })
        : await fetchSubcategoryDrilldownSpend({ vesselIds, startDate, endDate, actualsSource });

  const budgetCodes = raw.map((r) => r.budget_code).filter((c): c is string => Boolean(c));
  const [budgetNames, allocatedByCode, storeLabels] = await Promise.all([
    loadBudgetNames(budgetCodes),
    loadAllocatedByBudgetCode({ vesselIds, year, month }),
    dimension === "store" ? loadStoreLocationLabels(raw.map((r) => r.group_key)) : Promise.resolve(new Map()),
  ]);

  const rows = buildDrilldownRows(
    raw,
    dimension,
    budgetNames,
    false,
    allocatedByCode,
    storeLabels
  ).slice(0, topN);

  let strStoreProxyRows: BudgetVarianceDrilldownRow[] | undefined;
  if (dimension === "subcategory") {
    const strRaw = await fetchSubcategoryDrilldownSpend({
      vesselIds,
      startDate,
      endDate,
      actualsSource,
      requisitionType: "STR",
    });
    const strCodes = strRaw.map((r) => r.budget_code).filter((c): c is string => Boolean(c));
    const strNames = await loadBudgetNames([...budgetCodes, ...strCodes]);
    strStoreProxyRows = buildDrilldownRows(
      strRaw,
      dimension,
      strNames,
      true,
      allocatedByCode
    ).slice(0, topN);
  }

  return {
    year,
    month,
    dimension,
    actualsSource,
    attributionNote,
    rows,
    ...(strStoreProxyRows != null ? { strStoreProxyRows } : {}),
  };
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function periodPoint(
  periodKey: string,
  periodLabel: string,
  allocated: number,
  spent: number,
  committed = 0
): BudgetVariancePeriodPoint {
  const exposure = spent + committed;
  return {
    periodKey,
    periodLabel,
    allocated,
    committed,
    spent,
    exposure,
    variance: allocated - exposure,
    remaining: remainingBudget(allocated, spent, committed),
    utilizationPct: utilizationPct(exposure, allocated),
  };
}

type SpendByMonthRow = { period_month: number; spent: unknown };

async function fetchSpendByCalendarMonth(params: {
  vesselIds: string[];
  year: number;
  actualsSource: BudgetVarianceActualsSource;
}): Promise<Map<number, number>> {
  const { vesselIds, year, actualsSource } = params;
  const map = new Map<number, number>();
  if (vesselIds.length === 0) return map;

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

  const rows =
    actualsSource === "invoice"
      ? await prisma.$queryRaw<SpendByMonthRow[]>`
          SELECT EXTRACT(MONTH FROM r.date_of_creation)::int AS period_month,
                 COALESCE(SUM(i.invoice_amount), 0) AS spent
          FROM invoices i
          INNER JOIN requisitions r ON i.requisition_id = r.id
          WHERE i.status NOT IN ('CANCELLED', 'RETURNED')
            AND r.vessel_id IN (${Prisma.join(vesselIds)})
            AND r.budget_code IS NOT NULL
            AND r.date_of_creation >= ${yearStart}
            AND r.date_of_creation <= ${yearEnd}
          GROUP BY period_month
        `
      : await prisma.$queryRaw<SpendByMonthRow[]>`
          SELECT EXTRACT(MONTH FROM r.date_of_creation)::int AS period_month,
                 COALESCE(SUM(po.total_amount), 0) AS spent
          FROM purchase_orders po
          INNER JOIN requisitions r ON po.requisition_id = r.id
          WHERE po.status <> 'CANCELLED'
            AND r.vessel_id IN (${Prisma.join(vesselIds)})
            AND r.budget_code IS NOT NULL
            AND r.date_of_creation >= ${yearStart}
            AND r.date_of_creation <= ${yearEnd}
          GROUP BY period_month
        `;

  for (const row of rows) {
    const m = Number(row.period_month);
    if (m >= 1 && m <= 12) {
      map.set(m, Number(row.spent) || 0);
    }
  }
  return map;
}

async function fetchAllocatedByBudgetMonth(params: {
  vesselIds: string[];
  year: number;
}): Promise<{ byMonth: Map<number, number>; annualUnscoped: number }> {
  const { vesselIds, year } = params;
  const byMonth = new Map<number, number>();
  let annualUnscoped = 0;
  if (vesselIds.length === 0) return { byMonth, annualUnscoped };

  const budgets = await findPurchaseBudgetYearlyByCode({
    vesselId: { in: vesselIds },
    budgetYear: year,
  });

  for (const budget of budgets) {
    const amt = Number(budget.yearlyAmount) || 0;
    const m = budget.budgetMonth;
    if (m != null && m >= 1 && m <= 12) {
      byMonth.set(m, (byMonth.get(m) ?? 0) + amt);
    } else {
      annualUnscoped += amt;
    }
  }
  return { byMonth, annualUnscoped };
}

async function hasBudgetDataForYear(vesselIds: string[], year: number): Promise<boolean> {
  if (vesselIds.length === 0) return false;
  const count = await prisma.purchaseBudget.count({
    where: { vesselId: { in: vesselIds }, budgetYear: year },
    take: 1,
  });
  return count > 0;
}

export async function computeBudgetVariancePeriodBreakdown(params: {
  vesselIds: string[];
  year: number;
  period: BudgetVariancePeriod;
  actualsSource?: BudgetVarianceActualsSource;
}): Promise<BudgetVariancePeriodPoint[]> {
  const { vesselIds, year, period, actualsSource = "po" } = params;
  if (vesselIds.length === 0) return [];

  const [spendByMonth, allocatedSplit] = await Promise.all([
    fetchSpendByCalendarMonth({ vesselIds, year, actualsSource }),
    fetchAllocatedByBudgetMonth({ vesselIds, year }),
  ]);

  if (period === "monthly") {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const allocated = allocatedSplit.byMonth.get(m) ?? 0;
      const spent = spendByMonth.get(m) ?? 0;
      return periodPoint(`${year}-${String(m).padStart(2, "0")}`, MONTH_SHORT[i], allocated, spent);
    });
  }

  if (period === "quarterly") {
    const quarters: Array<{ key: string; label: string; months: number[] }> = [
      { key: `${year}-Q1`, label: "Q1", months: [1, 2, 3] },
      { key: `${year}-Q2`, label: "Q2", months: [4, 5, 6] },
      { key: `${year}-Q3`, label: "Q3", months: [7, 8, 9] },
      { key: `${year}-Q4`, label: "Q4", months: [10, 11, 12] },
    ];
    return quarters.map((q) => {
      const allocated = q.months.reduce((s, m) => s + (allocatedSplit.byMonth.get(m) ?? 0), 0);
      const spent = q.months.reduce((s, m) => s + (spendByMonth.get(m) ?? 0), 0);
      return periodPoint(q.key, q.label, allocated, spent);
    });
  }

  const yearlyAllocated =
    [...allocatedSplit.byMonth.values()].reduce((s, v) => s + v, 0) + allocatedSplit.annualUnscoped;
  const yearlySpent = [...spendByMonth.values()].reduce((s, v) => s + v, 0);
  const points: BudgetVariancePeriodPoint[] = [
    periodPoint(String(year), String(year), yearlyAllocated, yearlySpent),
  ];

  const priorYear = year - 1;
  if (await hasBudgetDataForYear(vesselIds, priorYear)) {
    const prior = await computeBudgetVariancePeriodBreakdown({
      vesselIds,
      year: priorYear,
      period: "yearly",
      actualsSource,
    });
    const priorPoint = prior[0];
    if (priorPoint) {
      points.unshift({
        ...priorPoint,
        periodKey: String(priorYear),
        periodLabel: String(priorYear),
      });
    }
  }

  return points;
}

function toConsumers(
  rows: Array<{
    key: string;
    label: string;
    kind: BudgetVarianceConsumer["kind"];
    allocated: number;
    spent: number;
    committed?: number;
    vesselId?: string;
    vesselName?: string;
    budgetCode?: string;
  }>,
  topN: number
): { topConsumers: BudgetVarianceConsumer[]; underUtilized: BudgetVarianceConsumer[] } {
  const enriched: BudgetVarianceConsumer[] = rows.map((r) => {
    const committed = r.committed ?? 0;
    const exposure = r.spent + committed;
    return {
      key: r.key,
      label: r.label,
      kind: r.kind,
      vesselId: r.vesselId,
      vesselName: r.vesselName,
      budgetCode: r.budgetCode,
      allocated: r.allocated,
      committed,
      spent: r.spent,
      exposure,
      variance: r.allocated - exposure,
      remaining: remainingBudget(r.allocated, r.spent, committed),
      utilizationPct: utilizationPct(exposure, r.allocated),
    };
  });

  const topConsumers = [...enriched]
    .filter((r) => r.spent > 0 || r.allocated > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, topN);

  const underUtilized = [...enriched]
    .filter((r) => r.allocated > 0)
    .sort((a, b) => a.utilizationPct - b.utilizationPct || b.variance - a.variance)
    .slice(0, topN);

  return { topConsumers, underUtilized };
}

export async function computeBudgetVarianceConsumers(params: {
  vesselIds: string[];
  year: number;
  month?: number;
  dimension: BudgetVarianceDimension;
  actualsSource?: BudgetVarianceActualsSource;
  base?: PurchaseBudgetVarianceResult;
  topN?: number;
}): Promise<{ topConsumers: BudgetVarianceConsumer[]; underUtilized: BudgetVarianceConsumer[] }> {
  const { vesselIds, year, month, dimension, actualsSource = "po", topN = 5 } = params;
  const base =
    params.base ??
    (await computePurchaseBudgetVariance({
      vesselIds,
      year,
      month,
      actualsSource,
    }));

  if (dimension === "section") {
    const categoryRows = base.byL1.map((l1) => ({
      key: l1.parentCode,
      label: l1.parentName,
      kind: "category" as const,
      budgetCode: l1.parentCode,
      allocated: l1.allocated,
      spent: l1.spent,
      committed: l1.committed,
    }));
    const vesselRows = base.byVessel.map((v) => ({
      key: v.vesselId,
      label: v.vesselName,
      kind: "vessel" as const,
      vesselId: v.vesselId,
      vesselName: v.vesselName,
      allocated: v.allocated,
      spent: v.spent,
      committed: v.committed,
    }));
    return toConsumers([...vesselRows, ...categoryRows], topN);
  }

  if (dimension === "machinery") {
    const drill = await computePurchaseBudgetVarianceDrilldown({
      vesselIds,
      year,
      month,
      dimension: "machinery",
      actualsSource,
      topN: 50,
    });
    const byGroup = new Map<string, { label: string; spent: number; allocated: number }>();
    for (const row of drill.rows) {
      const cur = byGroup.get(row.groupKey) ?? {
        label: row.groupLabel,
        spent: 0,
        allocated: 0,
      };
      cur.spent += row.spent;
      if (row.allocated != null) cur.allocated += row.allocated;
      byGroup.set(row.groupKey, cur);
    }
    const rows = [...byGroup.entries()].map(([key, v]) => ({
      key,
      label: v.label,
      kind: "dimension" as const,
      allocated: v.allocated,
      spent: v.spent,
    }));
    return toConsumers(rows, topN);
  }

  const drill = await computePurchaseBudgetVarianceDrilldown({
      vesselIds,
      year,
      month,
      dimension: "store",
      actualsSource,
      topN: 50,
    });
  const strRows = drill.rows;
  const byGroup = new Map<string, { label: string; spent: number; allocated: number }>();
  for (const row of strRows) {
    const cur = byGroup.get(row.groupKey) ?? {
      label: row.groupLabel,
      spent: 0,
      allocated: 0,
    };
    cur.spent += row.spent;
    if (row.allocated != null) cur.allocated += row.allocated;
    byGroup.set(row.groupKey, cur);
  }
  const rows = [...byGroup.entries()].map(([key, v]) => ({
    key,
    label: v.label,
    kind: "dimension" as const,
    allocated: v.allocated,
    spent: v.spent,
  }));
  return toConsumers(rows, topN);
}

export async function computePurchaseBudgetVarianceEnhanced(params: {
  vesselIds: string[];
  year: number;
  month?: number;
  period: BudgetVariancePeriod;
  periodQuarter?: 1 | 2 | 3 | 4;
  dimension: BudgetVarianceDimension;
  vesselNameById?: Map<string, string>;
  actualsSource?: BudgetVarianceActualsSource;
  topN?: number;
}): Promise<PurchaseBudgetVarianceEnhancedResult> {
  const {
    vesselIds,
    year,
    month,
    period,
    periodQuarter,
    dimension,
    vesselNameById,
    actualsSource = "po",
    topN = 5,
  } = params;

  const base = await computePurchaseBudgetVariance({
    vesselIds,
    year,
    month,
    period,
    periodMonth: month,
    periodQuarter,
    vesselNameById,
    actualsSource,
  });

  const [periodBreakdown, consumers] = await Promise.all([
    computeBudgetVariancePeriodBreakdown({ vesselIds, year, period, actualsSource }),
    computeBudgetVarianceConsumers({
      vesselIds,
      year,
      month,
      dimension,
      actualsSource,
      base,
      topN,
    }),
  ]);

  return {
    ...base,
    period,
    dimension,
    actualsSource,
    periodBreakdown,
    topConsumers: consumers.topConsumers,
    underUtilized: consumers.underUtilized,
  };
}
