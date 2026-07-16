import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { formatBudgetClassificationLabel } from "@/lib/procurement/requisition-budget-classification";
import type { PurchaseBudgetScope } from "@/lib/purchase-budget-scope";
import { PURCHASE_BUDGET_SCOPE } from "@/lib/purchase-budget-scope";
import {
  invoiceSpendPeriodSql,
  poSpendPeriodSql,
  type BudgetPostingBasis,
} from "@/lib/purchase-budget-posting-basis";

export type BudgetVarianceActualsSource = "po" | "invoice";

export type BudgetMonitorStatus = "ON_TRACK" | "WARNING" | "EXCEEDED";

export const BUDGET_WARNING_UTILIZATION_PCT = 80;

export function spendMapKey(vesselId: string, budgetCode: string): string {
  return `${vesselId}::${budgetCode}`;
}

export function getRequisitionDateRangeForBudget(
  budgetYear: number,
  budgetMonth?: number | null,
  budgetYearEnd?: number | null
): { startDate: Date; endDate: Date } {
  const endYear = budgetYearEnd != null && budgetYearEnd >= budgetYear ? budgetYearEnd : budgetYear;
  if (budgetMonth != null && budgetMonth >= 1 && budgetMonth <= 12) {
    return {
      startDate: new Date(budgetYear, budgetMonth - 1, 1),
      endDate: new Date(budgetYear, budgetMonth, 0, 23, 59, 59, 999),
    };
  }
  return {
    startDate: new Date(budgetYear, 0, 1),
    endDate: new Date(endYear, 11, 31, 23, 59, 59, 999),
  };
}

export function utilizationPct(spent: number, allocated: number): number {
  if (allocated <= 0) return spent > 0 ? 100 : 0;
  return (spent / allocated) * 100;
}

/**
 * Spend period anchor (aligned with `/api/purchase/budgets/monitor`):
 * filter transactions by **requisition.date_of_creation** within the budget year/month window.
 */
export const BUDGET_SPEND_PERIOD_FIELD = "requisition.dateOfCreation" as const;

/**
 * **Projected / committed pipeline** (does not include PO actuals):
 *
 * 1. **Projected** — Quote approved, PO not yet issued:
 *    requisition status QUOTE_APPROVED, no non-cancelled PO, valued at APPROVED vendor quote total.
 *    This is separate from Actual (issued PO amounts) and must not be added into Actual.
 *
 * 2. **Uninvoiced PO remainder** (only when actualsSource = invoice):
 *    per requisition, MAX(0, sum(PO totals) − sum(non-cancelled invoice amounts)).
 *
 * When actualsSource = po, committed = projected pipeline only (PO totals are in `spent` / Actual).
 * API `exposure` may still report spent + committed for legacy monitors; Vessel Budget Variance
 * treats Actual and Projected as separate KPIs.
 */
export const PIPELINE_REQUISITION_STATUSES = ["QUOTE_APPROVED"] as const;

/** L2 budget code: PO header wins when set, else requisition header. */
export function effectiveBudgetCode(
  poBudgetCode: string | null | undefined,
  requisitionBudgetCode: string | null | undefined
): string | null {
  const po = String(poBudgetCode ?? "").trim();
  if (po) return po;
  const req = String(requisitionBudgetCode ?? "").trim();
  return req || null;
}

export function budgetExposure(spent: number, committed: number): number {
  return (Number(spent) || 0) + (Number(committed) || 0);
}

export function remainingBudget(allocated: number, spent: number, committed: number): number {
  return (Number(allocated) || 0) - budgetExposure(spent, committed);
}

export function computeBudgetExposureStatus(
  spent: number,
  committed: number,
  allocated: number
): {
  status: BudgetMonitorStatus;
  percentageUsed: number;
  exposure: number;
  remaining: number;
} {
  const exposure = budgetExposure(spent, committed);
  const percentageUsed = utilizationPct(exposure, allocated);
  const status: BudgetMonitorStatus =
    exposure >= allocated && allocated > 0
      ? "EXCEEDED"
      : percentageUsed >= BUDGET_WARNING_UTILIZATION_PCT
        ? "WARNING"
        : "ON_TRACK";
  return {
    status,
    percentageUsed,
    exposure,
    remaining: remainingBudget(allocated, spent, committed),
  };
}

type AmountRow = { vessel_id: string; budget_code: string; amount: unknown };

function mergeAmountMaps(target: Map<string, number>, rows: AmountRow[]): void {
  for (const row of rows) {
    const code = row.budget_code?.trim();
    if (!code) continue;
    const key = spendMapKey(row.vessel_id, code);
    target.set(key, (target.get(key) ?? 0) + (Number(row.amount) || 0));
  }
}

/** Batch actuals grouped by vessel + effective L2 budget code (PO or invoice). */
export async function fetchSpendByVesselAndBudgetCode(params: {
  vesselIds: string[];
  startDate: Date;
  endDate: Date;
  actualsSource?: BudgetVarianceActualsSource;
  postingBasis?: BudgetPostingBasis;
}): Promise<Map<string, number>> {
  const { vesselIds, startDate, endDate, actualsSource = "po", postingBasis = "req_created" } =
    params;
  const map = new Map<string, number>();
  if (vesselIds.length === 0) return map;

  const rows =
    actualsSource === "invoice"
      ? await prisma.$queryRaw<AmountRow[]>`
          SELECT r.vessel_id,
                 COALESCE(NULLIF(TRIM(po.budget_code), ''), NULLIF(TRIM(r.budget_code), '')) AS budget_code,
                 COALESCE(SUM(i.invoice_amount), 0) AS amount
          FROM invoices i
          INNER JOIN requisitions r ON i.requisition_id = r.id
          LEFT JOIN purchase_orders po ON po.id = i.purchase_order_id
          WHERE i.status NOT IN ('CANCELLED', 'RETURNED')
            AND r.vessel_id IN (${Prisma.join(vesselIds)})
            AND COALESCE(NULLIF(TRIM(po.budget_code), ''), NULLIF(TRIM(r.budget_code), '')) IS NOT NULL
            ${invoiceSpendPeriodSql(postingBasis, startDate, endDate)}
          GROUP BY r.vessel_id, 2
        `
      : await prisma.$queryRaw<AmountRow[]>`
          SELECT r.vessel_id,
                 COALESCE(NULLIF(TRIM(po.budget_code), ''), NULLIF(TRIM(r.budget_code), '')) AS budget_code,
                 COALESCE(SUM(po.total_amount), 0) AS amount
          FROM purchase_orders po
          INNER JOIN requisitions r ON po.requisition_id = r.id
          WHERE po.status <> 'CANCELLED'
            AND r.vessel_id IN (${Prisma.join(vesselIds)})
            AND COALESCE(NULLIF(TRIM(po.budget_code), ''), NULLIF(TRIM(r.budget_code), '')) IS NOT NULL
            ${poSpendPeriodSql(postingBasis, startDate, endDate)}
          GROUP BY r.vessel_id, 2
        `;

  mergeAmountMaps(map, rows);
  return map;
}

async function fetchPipelineCommitted(params: {
  vesselIds: string[];
  startDate: Date;
  endDate: Date;
}): Promise<Map<string, number>> {
  const { vesselIds, startDate, endDate } = params;
  const map = new Map<string, number>();
  if (vesselIds.length === 0) return map;

  const rows = await prisma.$queryRaw<AmountRow[]>`
    WITH reqs AS (
      SELECT r.id, r.vessel_id, NULLIF(TRIM(r.budget_code), '') AS budget_code
      FROM requisitions r
      WHERE r.deleted_at IS NULL
        AND r.vessel_id IN (${Prisma.join(vesselIds)})
        AND r.status::text = 'QUOTE_APPROVED'
        AND r.date_of_creation >= ${startDate}
        AND r.date_of_creation <= ${endDate}
        AND NULLIF(TRIM(r.budget_code), '') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM purchase_orders po
          WHERE po.requisition_id = r.id AND po.status <> 'CANCELLED'
        )
    ),
    valued AS (
      SELECT
        r.vessel_id,
        r.budget_code,
        COALESCE(
          (
            SELECT vq.total_amount
            FROM vendor_quotes vq
            WHERE vq.requisition_id = r.id AND vq.status = 'APPROVED'
            ORDER BY vq.updated_at DESC
            LIMIT 1
          ),
          0
        ) AS amount
      FROM reqs r
    )
    SELECT vessel_id, budget_code, COALESCE(SUM(amount), 0) AS amount
    FROM valued
    WHERE amount > 0
    GROUP BY vessel_id, budget_code
  `;

  mergeAmountMaps(map, rows);
  return map;
}

async function fetchUninvoicedPoCommitted(params: {
  vesselIds: string[];
  startDate: Date;
  endDate: Date;
}): Promise<Map<string, number>> {
  const { vesselIds, startDate, endDate } = params;
  const map = new Map<string, number>();
  if (vesselIds.length === 0) return map;

  const rows = await prisma.$queryRaw<AmountRow[]>`
    SELECT r.vessel_id,
           COALESCE(NULLIF(TRIM(po.budget_code), ''), NULLIF(TRIM(r.budget_code), '')) AS budget_code,
           COALESCE(SUM(GREATEST(0, po.total_amount - COALESCE(inv.invoiced, 0))), 0) AS amount
    FROM purchase_orders po
    INNER JOIN requisitions r ON po.requisition_id = r.id
    LEFT JOIN (
      SELECT i.requisition_id, COALESCE(SUM(i.invoice_amount), 0) AS invoiced
      FROM invoices i
      WHERE i.status NOT IN ('CANCELLED', 'RETURNED')
      GROUP BY i.requisition_id
    ) inv ON inv.requisition_id = r.id
    WHERE po.status <> 'CANCELLED'
      AND r.vessel_id IN (${Prisma.join(vesselIds)})
      AND COALESCE(NULLIF(TRIM(po.budget_code), ''), NULLIF(TRIM(r.budget_code), '')) IS NOT NULL
      AND r.date_of_creation >= ${startDate}
      AND r.date_of_creation <= ${endDate}
    GROUP BY r.vessel_id, 2
    HAVING COALESCE(SUM(GREATEST(0, po.total_amount - COALESCE(inv.invoiced, 0))), 0) > 0
  `;

  mergeAmountMaps(map, rows);
  return map;
}

/** Committed pipeline (+ uninvoiced PO remainder when using invoice actuals). */
export async function fetchCommittedByVesselAndBudgetCode(params: {
  vesselIds: string[];
  startDate: Date;
  endDate: Date;
  actualsSource?: BudgetVarianceActualsSource;
}): Promise<Map<string, number>> {
  const { vesselIds, startDate, endDate, actualsSource = "po" } = params;
  const pipeline = await fetchPipelineCommitted({ vesselIds, startDate, endDate });
  if (actualsSource !== "invoice") {
    return pipeline;
  }
  const uninvoiced = await fetchUninvoicedPoCommitted({ vesselIds, startDate, endDate });
  const merged = new Map(pipeline);
  for (const [key, amt] of uninvoiced) {
    merged.set(key, (merged.get(key) ?? 0) + amt);
  }
  return merged;
}

/** Filters for budget performance analytics (PO confirmed / quote projected). */
export type BudgetAnalyticsFilter = {
  purchaseScope: PurchaseBudgetScope;
  /** When set, only requisitions with this flag (quotes page Budgeted / Un-Budgeted). */
  isBudgeted?: boolean | null;
};

function requisitionScopeSql(scope: PurchaseBudgetScope): Prisma.Sql {
  if (scope === PURCHASE_BUDGET_SCOPE.DRY_DOCK) {
    return Prisma.sql`AND UPPER(COALESCE(r.requisition_purpose, '')) = 'DRY_DOCK'`;
  }
  return Prisma.sql`AND UPPER(COALESCE(r.requisition_purpose, '')) <> 'DRY_DOCK'`;
}

function isBudgetedSql(
  isBudgeted: boolean | null | undefined,
  /** PO-backed queries join `po`; projected (quote-only) queries use requisition flag only. */
  source: "po" | "requisition" = "po"
): Prisma.Sql {
  const effective =
    source === "po"
      ? Prisma.sql`COALESCE(po.po_is_budgeted, r.is_budgeted, false)`
      : Prisma.sql`COALESCE(r.is_budgeted, false)`;
  if (isBudgeted === true) return Prisma.sql`AND ${effective} = true`;
  if (isBudgeted === false) return Prisma.sql`AND ${effective} = false`;
  return Prisma.empty;
}

/** Budget performance analytics: confirmed spend uses PO issue date within the budget window. */
export const BUDGET_ANALYTICS_CONFIRMED_PERIOD_FIELD = "purchase_order.dateOfIssue" as const;

function poIssueDateInRangeSql(startDate: Date, endDate: Date): Prisma.Sql {
  return Prisma.sql`
    AND po.date_of_issue >= ${startDate}
    AND po.date_of_issue <= ${endDate}
  `;
}

function approvedQuoteInRangeSql(startDate: Date, endDate: Date): Prisma.Sql {
  return Prisma.sql`
    AND vq.status = 'APPROVED'
    AND vq.updated_at >= ${startDate}
    AND vq.updated_at <= ${endDate}
  `;
}

/**
 * Confirmed consumption: non-cancelled PO totals (issued orders).
 */
export async function fetchConfirmedSpendByVesselAndBudgetCode(params: {
  vesselIds: string[];
  startDate: Date;
  endDate: Date;
  filter?: BudgetAnalyticsFilter;
}): Promise<Map<string, number>> {
  const { vesselIds, startDate, endDate, filter } = params;
  const map = new Map<string, number>();
  if (vesselIds.length === 0) return map;

  const scope = filter?.purchaseScope ?? PURCHASE_BUDGET_SCOPE.NORMAL;
  const budgetedSql = isBudgetedSql(filter?.isBudgeted);

  const rows = await prisma.$queryRaw<AmountRow[]>`
    SELECT r.vessel_id,
           COALESCE(NULLIF(TRIM(po.budget_code), ''), NULLIF(TRIM(r.budget_code), '')) AS budget_code,
           COALESCE(SUM(po.total_amount), 0) AS amount
    FROM purchase_orders po
    INNER JOIN requisitions r ON po.requisition_id = r.id
    WHERE po.status <> 'CANCELLED'
      AND r.deleted_at IS NULL
      AND r.vessel_id IN (${Prisma.join(vesselIds)})
      AND COALESCE(NULLIF(TRIM(po.budget_code), ''), NULLIF(TRIM(r.budget_code), '')) IS NOT NULL
      ${poIssueDateInRangeSql(startDate, endDate)}
      ${requisitionScopeSql(scope)}
      ${budgetedSql}
    GROUP BY r.vessel_id, 2
  `;

  mergeAmountMaps(map, rows);
  return map;
}

/**
 * Projected consumption: approved vendor quote, no PO issued yet (quote comparison page).
 */
export async function fetchProjectedSpendByVesselAndBudgetCode(params: {
  vesselIds: string[];
  startDate: Date;
  endDate: Date;
  filter?: BudgetAnalyticsFilter;
}): Promise<Map<string, number>> {
  const { vesselIds, startDate, endDate, filter } = params;
  const map = new Map<string, number>();
  if (vesselIds.length === 0) return map;

  const scope = filter?.purchaseScope ?? PURCHASE_BUDGET_SCOPE.NORMAL;
  const budgetedSql = isBudgetedSql(filter?.isBudgeted, "requisition");

  const rows = await prisma.$queryRaw<AmountRow[]>`
    WITH reqs AS (
      SELECT r.id, r.vessel_id, NULLIF(TRIM(r.budget_code), '') AS budget_code
      FROM requisitions r
      WHERE r.deleted_at IS NULL
        AND r.vessel_id IN (${Prisma.join(vesselIds)})
        AND NULLIF(TRIM(r.budget_code), '') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM purchase_orders po
          WHERE po.requisition_id = r.id AND po.status <> 'CANCELLED'
        )
        AND EXISTS (
          SELECT 1 FROM vendor_quotes vq
          WHERE vq.requisition_id = r.id
            ${approvedQuoteInRangeSql(startDate, endDate)}
        )
        ${requisitionScopeSql(scope)}
        ${budgetedSql}
    ),
    valued AS (
      SELECT
        r.vessel_id,
        r.budget_code,
        (
          SELECT vq.total_amount
          FROM vendor_quotes vq
          WHERE vq.requisition_id = r.id
            ${approvedQuoteInRangeSql(startDate, endDate)}
          ORDER BY vq.updated_at DESC
          LIMIT 1
        ) AS amount
      FROM reqs r
    )
    SELECT vessel_id, budget_code, COALESCE(SUM(amount), 0) AS amount
    FROM valued
    WHERE amount > 0
    GROUP BY vessel_id, budget_code
  `;

  mergeAmountMaps(map, rows);
  return map;
}

export type BudgetByRequisitionTypeRow = {
  requisitionType: string;
  label: string;
  isBudgeted: boolean;
  confirmed: number;
  projected: number;
  consumed: number;
  poCount: number;
  requisitionCount: number;
};

const REQUISITION_TYPE_LABELS: Record<string, string> = {
  STR: "Stores",
  SPR: "Spares",
  GLY: "Galley",
  PNT: "Paints",
  REP: "Repair",
  SER: "Service",
  CTM: "CTM",
  PRO: "Provisions",
  BNK: "Bunker",
  LUB: "Lube oil",
  FCL: "Flag/Class",
  OTR: "Other",
  CHE: "Chemicals",
};

export async function fetchBudgetConsumptionByRequisitionType(params: {
  vesselIds: string[];
  startDate: Date;
  endDate: Date;
  filter?: BudgetAnalyticsFilter;
}): Promise<BudgetByRequisitionTypeRow[]> {
  const { vesselIds, startDate, endDate, filter } = params;
  if (vesselIds.length === 0) return [];

  const scope = filter?.purchaseScope ?? PURCHASE_BUDGET_SCOPE.NORMAL;
  const budgetedSqlConfirmed = isBudgetedSql(filter?.isBudgeted, "po");
  const budgetedSqlProjected = isBudgetedSql(filter?.isBudgeted, "requisition");

  const confirmedRows = await prisma.$queryRaw<
    Array<{
      requisition_type: string;
      is_budgeted: boolean | null;
      amount: unknown;
      po_count: unknown;
    }>
  >`
    SELECT r.requisition_type::text AS requisition_type,
           COALESCE(po.po_is_budgeted, r.is_budgeted, false) AS is_budgeted,
           COALESCE(SUM(po.total_amount), 0) AS amount,
           COUNT(DISTINCT po.id)::int AS po_count
    FROM purchase_orders po
    INNER JOIN requisitions r ON po.requisition_id = r.id
    WHERE po.status <> 'CANCELLED'
      AND r.deleted_at IS NULL
      AND r.vessel_id IN (${Prisma.join(vesselIds)})
      ${poIssueDateInRangeSql(startDate, endDate)}
      ${requisitionScopeSql(scope)}
      ${budgetedSqlConfirmed}
    GROUP BY r.requisition_type, COALESCE(po.po_is_budgeted, r.is_budgeted, false)
  `;

  const projectedRows = await prisma.$queryRaw<
    Array<{
      requisition_type: string;
      is_budgeted: boolean | null;
      amount: unknown;
      req_count: unknown;
    }>
  >`
    SELECT r.requisition_type::text AS requisition_type,
           COALESCE(r.is_budgeted, false) AS is_budgeted,
           COALESCE(SUM(vq.total_amount), 0) AS amount,
           COUNT(DISTINCT r.id)::int AS req_count
    FROM requisitions r
    INNER JOIN vendor_quotes vq ON vq.requisition_id = r.id
    WHERE r.deleted_at IS NULL
      AND r.vessel_id IN (${Prisma.join(vesselIds)})
      ${approvedQuoteInRangeSql(startDate, endDate)}
      AND NOT EXISTS (
        SELECT 1 FROM purchase_orders po
        WHERE po.requisition_id = r.id AND po.status <> 'CANCELLED'
      )
      ${requisitionScopeSql(scope)}
      ${budgetedSqlProjected}
    GROUP BY r.requisition_type, COALESCE(r.is_budgeted, false)
  `;

  const merged = new Map<string, BudgetByRequisitionTypeRow>();

  for (const row of confirmedRows) {
    const type = row.requisition_type || "OTR";
    const isBudgeted = Boolean(row.is_budgeted);
    const key = `${type}::${isBudgeted}`;
    const confirmed = Number(row.amount) || 0;
    merged.set(key, {
      requisitionType: type,
      label: REQUISITION_TYPE_LABELS[type] ?? type,
      isBudgeted,
      confirmed,
      projected: 0,
      consumed: confirmed,
      poCount: Number(row.po_count) || 0,
      requisitionCount: 0,
    });
  }

  for (const row of projectedRows) {
    const type = row.requisition_type || "OTR";
    const isBudgeted = Boolean(row.is_budgeted);
    const key = `${type}::${isBudgeted}`;
    const projected = Number(row.amount) || 0;
    const existing = merged.get(key);
    if (existing) {
      existing.projected = projected;
      existing.consumed = existing.confirmed + projected;
      existing.requisitionCount = Number(row.req_count) || 0;
    } else {
      merged.set(key, {
        requisitionType: type,
        label: REQUISITION_TYPE_LABELS[type] ?? type,
        isBudgeted,
        confirmed: 0,
        projected,
        consumed: projected,
        poCount: 0,
        requisitionCount: Number(row.req_count) || 0,
      });
    }
  }

  return [...merged.values()].sort((a, b) => b.consumed - a.consumed);
}

type MonthSpendRow = { period_month: number; amount: unknown };

export async function fetchConfirmedSpendByCalendarMonth(params: {
  vesselIds: string[];
  year: number;
  filter?: BudgetAnalyticsFilter;
}): Promise<Map<number, number>> {
  const { vesselIds, year, filter } = params;
  const map = new Map<number, number>();
  if (vesselIds.length === 0) return map;

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  const scope = filter?.purchaseScope ?? PURCHASE_BUDGET_SCOPE.NORMAL;
  const budgetedSql = isBudgetedSql(filter?.isBudgeted);

  const rows = await prisma.$queryRaw<MonthSpendRow[]>`
    SELECT EXTRACT(MONTH FROM po.date_of_issue)::int AS period_month,
           COALESCE(SUM(po.total_amount), 0) AS amount
    FROM purchase_orders po
    INNER JOIN requisitions r ON po.requisition_id = r.id
    WHERE po.status <> 'CANCELLED'
      AND r.deleted_at IS NULL
      AND r.vessel_id IN (${Prisma.join(vesselIds)})
      AND po.date_of_issue >= ${yearStart}
      AND po.date_of_issue <= ${yearEnd}
      ${requisitionScopeSql(scope)}
      ${budgetedSql}
    GROUP BY period_month
  `;

  for (const row of rows) {
    const m = Number(row.period_month);
    if (m >= 1 && m <= 12) map.set(m, Number(row.amount) || 0);
  }
  return map;
}

export async function fetchProjectedSpendByCalendarMonth(params: {
  vesselIds: string[];
  year: number;
  filter?: BudgetAnalyticsFilter;
}): Promise<Map<number, number>> {
  const { vesselIds, year, filter } = params;
  const map = new Map<number, number>();
  if (vesselIds.length === 0) return map;

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  const scope = filter?.purchaseScope ?? PURCHASE_BUDGET_SCOPE.NORMAL;
  const budgetedSql = isBudgetedSql(filter?.isBudgeted, "requisition");

  const rows = await prisma.$queryRaw<MonthSpendRow[]>`
    SELECT EXTRACT(MONTH FROM vq.updated_at)::int AS period_month,
           COALESCE(SUM(vq.total_amount), 0) AS amount
    FROM requisitions r
    INNER JOIN vendor_quotes vq ON vq.requisition_id = r.id
    WHERE r.deleted_at IS NULL
      AND r.vessel_id IN (${Prisma.join(vesselIds)})
      ${approvedQuoteInRangeSql(yearStart, yearEnd)}
      AND NOT EXISTS (
        SELECT 1 FROM purchase_orders po
        WHERE po.requisition_id = r.id AND po.status <> 'CANCELLED'
      )
      ${requisitionScopeSql(scope)}
      ${budgetedSql}
    GROUP BY period_month
  `;

  for (const row of rows) {
    const m = Number(row.period_month);
    if (m >= 1 && m <= 12) map.set(m, Number(row.amount) || 0);
  }
  return map;
}

export type BudgetPerformancePoExportRow = {
  poNumber: string;
  dateOfIssue: string;
  totalAmount: number;
  currency: string;
  poStatus: string;
  completionStatus: string;
  vesselName: string;
  requisitionNumber: string;
  requisitionType: string;
  requisitionCreatedAt: string;
  budgetCode: string;
  isBudgeted: string;
  vendorName: string;
  quoteNumber: string;
  glCode: string;
  costCenter: string;
};

export type BudgetPerformanceProjectedExportRow = {
  requisitionNumber: string;
  requisitionType: string;
  quoteApprovedAt: string;
  projectedAmount: number;
  currency: string;
  vesselName: string;
  budgetCode: string;
  isBudgeted: string;
  vendorName: string;
  quoteNumber: string;
};

function formatExportDate(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

/** All POs counted as confirmed consumption in budget performance analytics. */
export async function listConfirmedPosForBudgetAnalytics(params: {
  vesselIds: string[];
  startDate: Date;
  endDate: Date;
  filter?: BudgetAnalyticsFilter;
}): Promise<BudgetPerformancePoExportRow[]> {
  const { vesselIds, startDate, endDate, filter } = params;
  if (vesselIds.length === 0) return [];

  const scope = filter?.purchaseScope ?? PURCHASE_BUDGET_SCOPE.NORMAL;
  const isDryDock = scope === PURCHASE_BUDGET_SCOPE.DRY_DOCK;

  const requisitionWhere: Prisma.RequisitionWhereInput = {
    deletedAt: null,
    ...(isDryDock
      ? { requisitionPurpose: "DRY_DOCK" }
      : { NOT: { requisitionPurpose: "DRY_DOCK" } }),
  };
  if (filter?.isBudgeted === true) {
    requisitionWhere.isBudgeted = true;
  } else if (filter?.isBudgeted === false) {
    requisitionWhere.isBudgeted = false;
  }

  const orders = await prisma.purchaseOrder.findMany({
    where: {
      status: { not: "CANCELLED" },
      dateOfIssue: { gte: startDate, lte: endDate },
      vesselId: { in: vesselIds },
      requisition: requisitionWhere,
    },
    include: {
      requisition: {
        select: {
          requisitionNumber: true,
          requisitionType: true,
          dateOfCreation: true,
          budgetCode: true,
          isBudgeted: true,
        },
      },
      quote: {
        select: {
          quoteNumber: true,
          vendor: { select: { name: true } },
        },
      },
    },
    orderBy: [{ dateOfIssue: "asc" }, { poNumber: "asc" }],
  });

  return orders.map((po) => {
    const budgetCode =
      String(po.budgetCode ?? po.requisition.budgetCode ?? "").trim() || "—";
    return {
      poNumber: po.poNumber,
      dateOfIssue: formatExportDate(po.dateOfIssue),
      totalAmount: Number(po.totalAmount) || 0,
      currency: po.currency,
      poStatus: po.status,
      completionStatus: po.completionStatus,
      vesselName: po.vesselName,
      requisitionNumber: po.requisition.requisitionNumber,
      requisitionType: String(po.requisition.requisitionType),
      requisitionCreatedAt: formatExportDate(po.requisition.dateOfCreation),
      budgetCode,
      isBudgeted: formatBudgetClassificationLabel(
        po.isBudgeted ?? po.requisition.isBudgeted
      ),
      vendorName: po.quote.vendor?.name ?? "—",
      quoteNumber: po.quote.quoteNumber ?? "—",
      glCode: po.glCode ?? "—",
      costCenter: po.costCenter ?? "—",
    };
  });
}

/** Approved quotes without PO, counted as projected consumption. */
export async function listProjectedQuotesForBudgetAnalytics(params: {
  vesselIds: string[];
  startDate: Date;
  endDate: Date;
  filter?: BudgetAnalyticsFilter;
}): Promise<BudgetPerformanceProjectedExportRow[]> {
  const { vesselIds, startDate, endDate, filter } = params;
  if (vesselIds.length === 0) return [];

  const scope = filter?.purchaseScope ?? PURCHASE_BUDGET_SCOPE.NORMAL;
  const budgetedSql = isBudgetedSql(filter?.isBudgeted, "requisition");

  const rows = await prisma.$queryRaw<
    Array<{
      requisition_number: string;
      requisition_type: string;
      quote_approved_at: Date;
      projected_amount: unknown;
      currency: string;
      vessel_name: string;
      budget_code: string | null;
      is_budgeted: boolean | null;
      vendor_name: string | null;
      quote_number: string | null;
    }>
  >`
    SELECT DISTINCT ON (r.id)
      r.requisition_number,
      r.requisition_type::text AS requisition_type,
      vq.updated_at AS quote_approved_at,
      vq.total_amount AS projected_amount,
      vq.currency,
      v.name AS vessel_name,
      NULLIF(TRIM(r.budget_code), '') AS budget_code,
      COALESCE(r.is_budgeted, false) AS is_budgeted,
      ven.name AS vendor_name,
      vq.quote_number
    FROM requisitions r
    INNER JOIN vessels v ON v.id = r.vessel_id
    INNER JOIN vendor_quotes vq ON vq.requisition_id = r.id
    LEFT JOIN vendors ven ON ven.id = vq.vendor_id
    WHERE r.deleted_at IS NULL
      AND r.vessel_id IN (${Prisma.join(vesselIds)})
      ${approvedQuoteInRangeSql(startDate, endDate)}
      AND NOT EXISTS (
        SELECT 1 FROM purchase_orders po
        WHERE po.requisition_id = r.id AND po.status <> 'CANCELLED'
      )
      ${requisitionScopeSql(scope)}
      ${budgetedSql}
    ORDER BY r.id, vq.updated_at DESC
  `;

  return rows.map((row) => ({
    requisitionNumber: row.requisition_number,
    requisitionType: row.requisition_type || "OTR",
    quoteApprovedAt: formatExportDate(row.quote_approved_at),
    projectedAmount: Number(row.projected_amount) || 0,
    currency: row.currency || "USD",
    vesselName: row.vessel_name,
    budgetCode: row.budget_code?.trim() || "—",
    isBudgeted: row.is_budgeted ? "Budgeted" : "Un-Budgeted",
    vendorName: row.vendor_name ?? "—",
    quoteNumber: row.quote_number ?? "—",
  }));
}
