import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  budgetRangeMonthColumns,
  type BudgetRangeMonthColumn,
  type BudgetYearMonth,
  yearMonthRangeToDateBounds,
} from "@/lib/purchase-budget-year-range";
import { parsePurchaseBudgetScope, PURCHASE_BUDGET_SCOPE } from "@/lib/purchase-budget-scope";
import type { PurchaseBudgetScope } from "@/lib/purchase-budget-scope";
import type { BudgetVarianceActualsSource } from "@/lib/purchase-budget-spend";
import { PIPELINE_REQUISITION_STATUSES } from "@/lib/purchase-budget-spend";
import {
  invoiceSpendPeriodSql,
  poSpendPeriodSql,
  spendMonthExtractSql,
  type BudgetPostingBasis,
} from "@/lib/purchase-budget-posting-basis";
import {
  emptyMonthlyCell,
  finalizeMonthlyCell,
  prorateBudgetToMonthColumns,
  type BudgetMonthlyCell,
} from "@/lib/purchase-budget-monitor-vs-actual";
import { roundBudgetAmount } from "@/lib/purchase-budget-amount-format";

export type BudgetMonthlyMonitorFilters = {
  requisitionType?: string | null;
  machineryInstanceIds?: string[];
  l1BudgetTypeIds?: string[];
};

export type BudgetMonthlyMonitorRow = {
  l1Id: string;
  l1Code: string;
  l1Name: string;
  label: string;
  months: Record<string, BudgetMonthlyCell>;
  totals: BudgetMonthlyCell;
};

export type BudgetMonthlyMonitorPayload = {
  columns: BudgetRangeMonthColumn[];
  rows: BudgetMonthlyMonitorRow[];
  columnTotals: Record<string, BudgetMonthlyCell>;
  grandTotal: BudgetMonthlyCell;
  /** Prior-year actual totals keyed by current period column key (same month, year − 1). */
  priorYearColumnTotals: Record<string, number>;
  currency: string;
  /** Accrual actuals keyed by column (YYYY-MM). */
  accrualByMonth?: Record<string, number>;
};

type SpendRow = {
  period_year: number;
  period_month: number;
  budget_code: string;
  spent: unknown;
};

type DefinedBudgetRow = {
  l2Code: string;
  l1Id: string;
  yearlyAmount: number;
  currency: string;
};

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function requisitionTypeSql(type?: string | null): Prisma.Sql {
  const value = String(type ?? "").trim();
  if (!value || value === "all") return Prisma.empty;
  return Prisma.sql`AND r.requisition_type::text = ${value}`;
}

function machinerySql(ids?: string[]): Prisma.Sql {
  if (!ids?.length) return Prisma.empty;
  return Prisma.sql`AND EXISTS (
    SELECT 1 FROM requisition_items ri
    WHERE ri.requisition_id = r.id
      AND ri.machinery_instance_id IN (${Prisma.join(ids)})
  )`;
}

function purchaseScopeSql(scope: PurchaseBudgetScope): Prisma.Sql {
  if (scope === PURCHASE_BUDGET_SCOPE.DRY_DOCK) {
    return Prisma.sql`AND UPPER(COALESCE(r.requisition_purpose, '')) = 'DRY_DOCK'`;
  }
  return Prisma.sql`AND UPPER(COALESCE(r.requisition_purpose, '')) <> 'DRY_DOCK'`;
}

async function resolveL2CodesForL1Filter(
  companyId: string,
  l1BudgetTypeIds: string[],
  budgetScope: PurchaseBudgetScope
): Promise<string[] | null> {
  if (!l1BudgetTypeIds.length) return null;
  const rows = await prisma.purchaseBudgetType.findMany({
    where: {
      companyId,
      budgetScope,
      level: 2,
      isActive: true,
      parentId: { in: l1BudgetTypeIds },
    },
    select: { code: true },
  });
  return rows.map((r) => r.code);
}

async function fetchSpendByL2YearMonth(params: {
  vesselIds: string[];
  startDate: Date;
  endDate: Date;
  budgetScope: PurchaseBudgetScope;
  filters: BudgetMonthlyMonitorFilters;
  l2Codes?: string[] | null;
  actualsSource?: BudgetVarianceActualsSource;
  postingBasis?: BudgetPostingBasis;
}): Promise<SpendRow[]> {
  const {
    vesselIds,
    startDate,
    endDate,
    budgetScope,
    filters,
    l2Codes,
    actualsSource = "po",
    postingBasis = "req_created",
  } = params;
  if (vesselIds.length === 0) return [];

  const l2Filter =
    l2Codes && l2Codes.length > 0
      ? Prisma.sql`AND COALESCE(NULLIF(TRIM(po.budget_code), ''), NULLIF(TRIM(r.budget_code), '')) IN (${Prisma.join(l2Codes)})`
      : Prisma.empty;

  const monthExtract = spendMonthExtractSql(postingBasis, actualsSource);

  if (actualsSource === "invoice") {
    return prisma.$queryRaw<SpendRow[]>`
      SELECT ${monthExtract},
             COALESCE(NULLIF(TRIM(po.budget_code), ''), NULLIF(TRIM(r.budget_code), '')) AS budget_code,
             COALESCE(SUM(i.invoice_amount), 0) AS spent
      FROM invoices i
      INNER JOIN requisitions r ON i.requisition_id = r.id
      LEFT JOIN purchase_orders po ON po.id = i.purchase_order_id
      WHERE i.status NOT IN ('CANCELLED', 'RETURNED')
        AND r.vessel_id IN (${Prisma.join(vesselIds)})
        AND COALESCE(NULLIF(TRIM(po.budget_code), ''), NULLIF(TRIM(r.budget_code), '')) IS NOT NULL
        ${invoiceSpendPeriodSql(postingBasis, startDate, endDate)}
        ${purchaseScopeSql(budgetScope)}
        ${requisitionTypeSql(filters.requisitionType)}
        ${machinerySql(filters.machineryInstanceIds)}
        ${l2Filter}
      GROUP BY period_year, period_month, budget_code
    `;
  }

  return prisma.$queryRaw<SpendRow[]>`
    SELECT ${monthExtract},
           COALESCE(NULLIF(TRIM(po.budget_code), ''), NULLIF(TRIM(r.budget_code), '')) AS budget_code,
           COALESCE(SUM(po.total_amount), 0) AS spent
    FROM purchase_orders po
    INNER JOIN requisitions r ON po.requisition_id = r.id
    WHERE po.status <> 'CANCELLED'
      AND r.vessel_id IN (${Prisma.join(vesselIds)})
      AND COALESCE(NULLIF(TRIM(po.budget_code), ''), NULLIF(TRIM(r.budget_code), '')) IS NOT NULL
      ${poSpendPeriodSql(postingBasis, startDate, endDate)}
      ${purchaseScopeSql(budgetScope)}
      ${requisitionTypeSql(filters.requisitionType)}
      ${machinerySql(filters.machineryInstanceIds)}
      ${l2Filter}
    GROUP BY period_year, period_month, budget_code
  `;
}

type CommittedRow = {
  period_year: number;
  period_month: number;
  budget_code: string;
  committed: unknown;
};

async function fetchCommittedByL2YearMonth(params: {
  vesselIds: string[];
  startDate: Date;
  endDate: Date;
  budgetScope: PurchaseBudgetScope;
  filters: BudgetMonthlyMonitorFilters;
  l2Codes?: string[] | null;
}): Promise<CommittedRow[]> {
  const { vesselIds, startDate, endDate, budgetScope, filters, l2Codes } = params;
  if (vesselIds.length === 0) return [];

  const l2Filter =
    l2Codes && l2Codes.length > 0
      ? Prisma.sql`AND NULLIF(TRIM(r.budget_code), '') IN (${Prisma.join(l2Codes)})`
      : Prisma.empty;

  return prisma.$queryRaw<CommittedRow[]>`
    WITH reqs AS (
      SELECT r.id, r.budget_code,
             EXTRACT(YEAR FROM r.date_of_creation)::int AS period_year,
             EXTRACT(MONTH FROM r.date_of_creation)::int AS period_month
      FROM requisitions r
      WHERE r.deleted_at IS NULL
        AND r.vessel_id IN (${Prisma.join(vesselIds)})
        AND r.status::text IN (${Prisma.join([...PIPELINE_REQUISITION_STATUSES])})
        AND r.date_of_creation >= ${startDate}
        AND r.date_of_creation <= ${endDate}
        AND NULLIF(TRIM(r.budget_code), '') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM purchase_orders po
          WHERE po.requisition_id = r.id AND po.status <> 'CANCELLED'
        )
        ${purchaseScopeSql(budgetScope)}
        ${requisitionTypeSql(filters.requisitionType)}
        ${machinerySql(filters.machineryInstanceIds)}
        ${l2Filter}
    ),
    valued AS (
      SELECT reqs.period_year, reqs.period_month, reqs.budget_code,
        COALESCE(
          (SELECT vq.total_amount FROM vendor_quotes vq
           WHERE vq.requisition_id = reqs.id AND vq.status = 'APPROVED'
           ORDER BY vq.updated_at DESC LIMIT 1),
          (SELECT vq.total_amount FROM vendor_quotes vq
           WHERE vq.requisition_id = reqs.id AND vq.status IN ('RECEIVED', 'APPROVED')
           ORDER BY vq.updated_at DESC LIMIT 1),
          0
        ) AS committed
      FROM reqs
    )
    SELECT period_year, period_month, budget_code, COALESCE(SUM(committed), 0) AS committed
    FROM valued
    WHERE committed > 0
    GROUP BY period_year, period_month, budget_code
  `;
}

function sumMonthlyCells(
  target: Record<string, BudgetMonthlyCell>,
  source: Record<string, BudgetMonthlyCell>
): void {
  for (const [key, cell] of Object.entries(source)) {
    const existing = target[key] ?? emptyMonthlyCell();
    target[key] = finalizeMonthlyCell(
      existing.budget + cell.budget,
      existing.actual + cell.actual,
      existing.committed + cell.committed
    );
  }
}

export async function computePurchaseBudgetMonthlyMonitor(params: {
  vesselId: string;
  rangeFrom: BudgetYearMonth;
  rangeTo: BudgetYearMonth;
  budgetScope?: PurchaseBudgetScope | string | null;
  filters?: BudgetMonthlyMonitorFilters;
  actualsSource?: BudgetVarianceActualsSource;
  postingBasis?: BudgetPostingBasis;
  definedBudgets?: DefinedBudgetRow[];
}): Promise<BudgetMonthlyMonitorPayload> {
  const budgetScope = parsePurchaseBudgetScope(params.budgetScope);
  const filters = params.filters ?? {};
  const columns = budgetRangeMonthColumns(params.rangeFrom, params.rangeTo);
  const emptyCell = emptyMonthlyCell();
  const columnTotals: Record<string, BudgetMonthlyCell> = Object.fromEntries(
    columns.map((c) => [c.key, { ...emptyCell }])
  );
  const empty: BudgetMonthlyMonitorPayload = {
    columns,
    rows: [],
    columnTotals,
    grandTotal: { ...emptyCell },
    priorYearColumnTotals: Object.fromEntries(columns.map((c) => [c.key, 0])),
    currency: "USD",
  };

  const vessel = await prisma.vessel.findUnique({
    where: { id: params.vesselId },
    select: { companyId: true },
  });
  if (!vessel?.companyId) return empty;

  const l1Types = await prisma.purchaseBudgetType.findMany({
    where: {
      companyId: vessel.companyId,
      budgetScope,
      level: 1,
      isActive: true,
      ...(filters.l1BudgetTypeIds?.length
        ? { id: { in: filters.l1BudgetTypeIds } }
        : {}),
    },
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
    select: { id: true, code: true, name: true },
  });

  if (l1Types.length === 0) return empty;

  const l2Types = await prisma.purchaseBudgetType.findMany({
    where: {
      companyId: vessel.companyId,
      budgetScope,
      level: 2,
      isActive: true,
      parentId: { in: l1Types.map((l1) => l1.id) },
    },
    select: { code: true, parentId: true },
  });

  const l2ToL1 = new Map<string, { id: string; code: string; name: string }>();
  const l1ById = new Map(l1Types.map((l1) => [l1.id, l1]));
  for (const l2 of l2Types) {
    const parent = l2.parentId ? l1ById.get(l2.parentId) : undefined;
    if (parent) l2ToL1.set(l2.code, parent);
  }

  const l2Codes = await resolveL2CodesForL1Filter(
    vessel.companyId,
    filters.l1BudgetTypeIds ?? [],
    budgetScope
  );

  const { startDate, endDate } = yearMonthRangeToDateBounds(params.rangeFrom, params.rangeTo);
  const postingBasis = params.postingBasis ?? "req_created";

  const [spendRows, committedRows, priorSpendRows] = await Promise.all([
    fetchSpendByL2YearMonth({
      vesselIds: [params.vesselId],
      startDate,
      endDate,
      budgetScope,
      filters,
      l2Codes,
      actualsSource: params.actualsSource,
      postingBasis,
    }),
    fetchCommittedByL2YearMonth({
      vesselIds: [params.vesselId],
      startDate,
      endDate,
      budgetScope,
      filters,
      l2Codes,
    }),
    fetchSpendByL2YearMonth({
      vesselIds: [params.vesselId],
      startDate: yearMonthRangeToDateBounds(
        { year: params.rangeFrom.year - 1, month: params.rangeFrom.month },
        { year: params.rangeTo.year - 1, month: params.rangeTo.month }
      ).startDate,
      endDate: yearMonthRangeToDateBounds(
        { year: params.rangeFrom.year - 1, month: params.rangeFrom.month },
        { year: params.rangeTo.year - 1, month: params.rangeTo.month }
      ).endDate,
      budgetScope,
      filters,
      l2Codes,
      actualsSource: params.actualsSource,
      postingBasis,
    }),
  ]);

  const rowMaps = new Map<string, BudgetMonthlyMonitorRow>();
  for (const l1 of l1Types) {
    rowMaps.set(l1.id, {
      l1Id: l1.id,
      l1Code: l1.code,
      l1Name: l1.name,
      label: `${l1.code} ${l1.name}`,
      months: Object.fromEntries(columns.map((c) => [c.key, emptyMonthlyCell()])),
      totals: { ...emptyCell },
    });
  }

  const columnKeySet = new Set(columns.map((c) => c.key));

  // Budget amounts from defined budgets (real DB rows passed in)
  const defined = params.definedBudgets ?? [];
  let currency = defined.find((b) => b.currency)?.currency ?? "USD";

  for (const budget of defined) {
    const parent = l1ById.get(budget.l1Id);
    if (!parent) continue;
    const monitorRow = rowMaps.get(parent.id);
    if (!monitorRow) continue;

    const prorated = prorateBudgetToMonthColumns(budget.yearlyAmount, columns);
    for (const [key, amount] of Object.entries(prorated)) {
      if (!columnKeySet.has(key)) continue;
      const cell = monitorRow.months[key] ?? emptyMonthlyCell();
      monitorRow.months[key] = finalizeMonthlyCell(
        cell.budget + amount,
        cell.actual,
        cell.committed
      );
    }
    if (budget.currency) currency = budget.currency;
  }

  // Actual spend by month
  for (const row of spendRows) {
    const l2Code = String(row.budget_code ?? "").trim();
    const parent = l2ToL1.get(l2Code);
    if (!parent) continue;

    const year = Number(row.period_year);
    const month = Number(row.period_month);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) continue;

    const key = monthKey(year, month);
    if (!columnKeySet.has(key)) continue;

    const amount = Number(row.spent) || 0;
    const monitorRow = rowMaps.get(parent.id);
    if (!monitorRow) continue;

    const cell = monitorRow.months[key] ?? emptyMonthlyCell();
    monitorRow.months[key] = finalizeMonthlyCell(cell.budget, cell.actual + amount, cell.committed);
  }

  // Committed pipeline by month (cash-flow forecast)
  for (const row of committedRows) {
    const l2Code = String(row.budget_code ?? "").trim();
    const parent = l2ToL1.get(l2Code);
    if (!parent) continue;

    const year = Number(row.period_year);
    const month = Number(row.period_month);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) continue;

    const key = monthKey(year, month);
    if (!columnKeySet.has(key)) continue;

    const amount = Number(row.committed) || 0;
    const monitorRow = rowMaps.get(parent.id);
    if (!monitorRow) continue;

    const cell = monitorRow.months[key] ?? emptyMonthlyCell();
    monitorRow.months[key] = finalizeMonthlyCell(cell.budget, cell.actual, cell.committed + amount);
  }

  const priorYearColumnTotals = Object.fromEntries(columns.map((c) => [c.key, 0]));
  for (const row of priorSpendRows) {
    const year = Number(row.period_year);
    const month = Number(row.period_month);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) continue;
    const currentKey = monthKey(year + 1, month);
    if (!columnKeySet.has(currentKey)) continue;
    priorYearColumnTotals[currentKey] =
      (priorYearColumnTotals[currentKey] ?? 0) + (Number(row.spent) || 0);
  }
  for (const key of Object.keys(priorYearColumnTotals)) {
    priorYearColumnTotals[key] = roundBudgetAmount(priorYearColumnTotals[key]);
  }

  const rows = [...rowMaps.values()]
    .map((row) => {
      let totalBudget = 0;
      let totalActual = 0;
      let totalCommitted = 0;
      for (const key of columnKeySet) {
        const cell = row.months[key] ?? emptyMonthlyCell();
        totalBudget += cell.budget;
        totalActual += cell.actual;
        totalCommitted += cell.committed;
        columnTotals[key] = finalizeMonthlyCell(
          (columnTotals[key]?.budget ?? 0) + cell.budget,
          (columnTotals[key]?.actual ?? 0) + cell.actual,
          (columnTotals[key]?.committed ?? 0) + cell.committed
        );
      }
      return {
        ...row,
        totals: finalizeMonthlyCell(totalBudget, totalActual, totalCommitted),
      };
    })
    .filter(
      (r) => r.totals.budget > 0 || r.totals.actual > 0 || r.totals.committed > 0
    )
    .sort((a, b) => a.l1Code.localeCompare(b.l1Code, undefined, { numeric: true }));

  const grandTotal = rows.reduce(
    (acc, row) =>
      finalizeMonthlyCell(
        acc.budget + row.totals.budget,
        acc.actual + row.totals.actual,
        acc.committed + row.totals.committed
      ),
    { ...emptyCell }
  );

  return {
    columns,
    rows,
    columnTotals,
    grandTotal,
    priorYearColumnTotals,
    currency,
  };
}

export function parseCsvIds(value: string | null): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}
