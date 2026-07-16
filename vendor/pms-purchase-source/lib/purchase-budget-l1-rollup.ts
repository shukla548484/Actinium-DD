/** Roll up purchase budget line amounts by Level 1 parent category */

import {
  allocatedAmountForPeriodType,
  type BudgetPeriodType,
} from "@/lib/purchase-budget-period";

export interface BudgetEntryForL1Rollup {
  yearlyAmount: number;
  monthlyAmount: number;
  spentAmount?: number;
  committedAmount?: number;
  remainingAmount?: number;
  exposureAmount?: number;
  budgetType?: {
    code: string;
    name: string;
    parent?: { code: string; name: string } | null;
  } | null;
}

export interface L1BudgetRollupSlice {
  code: string;
  name: string;
  /** Display label: "1000 Crew Expenses" */
  label: string;
  value: number;
}

export interface L2BudgetRollupSlice {
  code: string;
  name: string;
  /** Display label: "1100 Crew Wages" */
  label: string;
  value: number;
}

export interface L1WithL2BudgetRollup {
  code: string;
  name: string;
  label: string;
  total: number;
  l2Slices: L2BudgetRollupSlice[];
}

export interface L1BudgetStatusRollup {
  code: string;
  name: string;
  label: string;
  allocated: number;
  consumed: number;
  remaining: number;
}

export interface BudgetStatusTotals {
  allocated: number;
  consumed: number;
  remaining: number;
}

/** Allocated amount for the active budget period (monthly / quarterly / yearly column). */
export function getBudgetAllocatedAmount(
  entry: BudgetEntryForL1Rollup,
  periodType: BudgetPeriodType
): number {
  return allocatedAmountForPeriodType(Number(entry.monthlyAmount) || 0, periodType);
}

/** @deprecated Use getBudgetAllocatedAmount with periodType */
export function getBudgetAllottedAmount(
  entry: BudgetEntryForL1Rollup,
  useYearlyAmount: boolean
): number {
  return getBudgetAllocatedAmount(entry, useYearlyAmount ? "yearly" : "monthly");
}

export function getBudgetConsumedAmount(entry: BudgetEntryForL1Rollup): number {
  const exposure = Number(entry.exposureAmount);
  if (Number.isFinite(exposure) && exposure > 0) return exposure;
  const spent = Number(entry.spentAmount) || 0;
  const committed = Number(entry.committedAmount) || 0;
  return spent + committed;
}

export function getBudgetRemainingAmount(
  entry: BudgetEntryForL1Rollup,
  allocated: number
): number {
  const remaining = Number(entry.remainingAmount);
  if (Number.isFinite(remaining)) return Math.max(0, remaining);
  return Math.max(0, allocated - getBudgetConsumedAmount(entry));
}

export function rollupBudgetAmountsByL1(
  entries: BudgetEntryForL1Rollup[],
  options: { periodType: BudgetPeriodType } | { useYearlyAmount: boolean }
): L1BudgetRollupSlice[] {
  const periodType =
    "periodType" in options
      ? options.periodType
      : options.useYearlyAmount
        ? "yearly"
        : "monthly";
  const map = new Map<string, L1BudgetRollupSlice>();

  for (const entry of entries) {
    const parent = entry.budgetType?.parent;
    const code = parent?.code ?? "—";
    const name = parent?.name ?? "Uncategorized";
    const key = parent ? `${code}\0${name}` : `__orphan__\0${entry.budgetType?.id ?? "x"}`;
    const amount = getBudgetAllocatedAmount(entry, periodType);

    const existing = map.get(key);
    if (existing) {
      existing.value += amount;
    } else {
      map.set(key, {
        code,
        name,
        label: code === "—" ? name : `${code} ${name}`,
        value: amount,
      });
    }
  }

  return [...map.values()]
    .filter((s) => s.value > 0)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

/** L2 allocated amounts within each L1 group. */
export function rollupBudgetAmountsByL2PerL1(
  entries: BudgetEntryForL1Rollup[],
  options: { periodType: BudgetPeriodType } | { useYearlyAmount: boolean }
): L1WithL2BudgetRollup[] {
  const periodType =
    "periodType" in options
      ? options.periodType
      : options.useYearlyAmount
        ? "yearly"
        : "monthly";
  const byL1 = new Map<
    string,
    { code: string; name: string; l2: Map<string, L2BudgetRollupSlice> }
  >();

  for (const entry of entries) {
    const parent = entry.budgetType?.parent;
    const l1Code = parent?.code ?? "—";
    const l1Name = parent?.name ?? "Uncategorized";
    const l1Key = parent
      ? `${l1Code}\0${l1Name}`
      : `__orphan__\0${entry.budgetType?.id ?? "x"}`;

    const bt = entry.budgetType;
    const l2Code = bt?.code ?? "—";
    const l2Name = bt?.name ?? "—";
    const l2Key = `${l2Code}\0${l2Name}`;
    const amount = getBudgetAllocatedAmount(entry, periodType);

    if (!byL1.has(l1Key)) {
      byL1.set(l1Key, { code: l1Code, name: l1Name, l2: new Map() });
    }
    const group = byL1.get(l1Key)!;
    const existing = group.l2.get(l2Key);
    if (existing) {
      existing.value += amount;
    } else {
      group.l2.set(l2Key, {
        code: l2Code,
        name: l2Name,
        label: l2Code === "—" ? l2Name : `${l2Code} ${l2Name}`,
        value: amount,
      });
    }
  }

  return [...byL1.values()]
    .map((g) => {
      const l2Slices = [...g.l2.values()]
        .filter((s) => s.value > 0)
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
      const total = l2Slices.reduce((sum, s) => sum + s.value, 0);
      return {
        code: g.code,
        name: g.name,
        label: g.code === "—" ? g.name : `${g.code} ${g.name}`,
        total,
        l2Slices,
      };
    })
    .filter((g) => g.l2Slices.length > 0)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

function upsertL1Status(
  map: Map<string, L1BudgetStatusRollup>,
  entry: BudgetEntryForL1Rollup,
  periodType: BudgetPeriodType
) {
  const parent = entry.budgetType?.parent;
  const code = parent?.code ?? "—";
  const name = parent?.name ?? "Uncategorized";
  const key = parent ? `${code}\0${name}` : `__orphan__\0${entry.budgetType?.id ?? "x"}`;
  const allocated = getBudgetAllocatedAmount(entry, periodType);
  const consumed = getBudgetConsumedAmount(entry);
  const remaining = getBudgetRemainingAmount(entry, allocated);

  const existing = map.get(key);
  if (existing) {
    existing.allocated += allocated;
    existing.consumed += consumed;
    existing.remaining += remaining;
  } else {
    map.set(key, {
      code,
      name,
      label: code === "—" ? name : `${code} ${name}`,
      allocated,
      consumed,
      remaining,
    });
  }
}

export function rollupBudgetStatusByL1(
  entries: BudgetEntryForL1Rollup[],
  periodType: BudgetPeriodType
): L1BudgetStatusRollup[] {
  const map = new Map<string, L1BudgetStatusRollup>();
  for (const entry of entries) {
    upsertL1Status(map, entry, periodType);
  }
  return [...map.values()]
    .filter((g) => g.allocated > 0 || g.consumed > 0)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

export function rollupAllL1BudgetStatusTotals(
  entries: BudgetEntryForL1Rollup[],
  periodType: BudgetPeriodType
): BudgetStatusTotals {
  const groups = rollupBudgetStatusByL1(entries, periodType);
  return groups.reduce(
    (acc, g) => ({
      allocated: acc.allocated + g.allocated,
      consumed: acc.consumed + g.consumed,
      remaining: acc.remaining + g.remaining,
    }),
    { allocated: 0, consumed: 0, remaining: 0 }
  );
}
