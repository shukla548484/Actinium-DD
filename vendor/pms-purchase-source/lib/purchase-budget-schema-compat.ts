import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { PURCHASE_BUDGET_SCOPE, type PurchaseBudgetScope } from "@/lib/purchase-budget-scope";

function collectErrorText(error: unknown): string {
  const parts: string[] = [];
  const walk = (err: unknown) => {
    if (!err || typeof err !== "object") return;
    const e = err as { message?: string; cause?: unknown };
    if (e.message) parts.push(String(e.message));
    if (e.cause) walk(e.cause);
  };
  walk(error);
  return parts.join(" ");
}

/** Prisma P2022 when DB was created from add_purchase_budget.sql only (no budget_scope yet). */
export function isMissingBudgetScopeColumnError(error: unknown): boolean {
  const blob = collectErrorText(error).toLowerCase();
  return blob.includes("budget_scope") && blob.includes("does not exist");
}

export function isMissingDryDockProjectColumnError(error: unknown): boolean {
  const blob = collectErrorText(error).toLowerCase();
  return blob.includes("dry_dock_project_id") && blob.includes("does not exist");
}

export function isMissingBudgetQuarterColumnError(error: unknown): boolean {
  const blob = collectErrorText(error).toLowerCase();
  return blob.includes("budget_quarter") && blob.includes("does not exist");
}

export function isMissingBudgetYearEndColumnError(error: unknown): boolean {
  const blob = collectErrorText(error).toLowerCase();
  return blob.includes("budget_year_end") && blob.includes("does not exist");
}

export function isMissingBudgetPeriodCodeColumnError(error: unknown): boolean {
  const blob = collectErrorText(error).toLowerCase();
  return (
    (blob.includes("budget_period_code") || blob.includes("budget_period_type")) &&
    blob.includes("does not exist")
  );
}

export function isLegacyPurchaseBudgetSchemaError(error: unknown): boolean {
  return (
    isMissingBudgetScopeColumnError(error) ||
    isMissingDryDockProjectColumnError(error) ||
    isMissingBudgetQuarterColumnError(error) ||
    isMissingBudgetYearEndColumnError(error) ||
    isMissingBudgetPeriodCodeColumnError(error)
  );
}

const budgetTypeIncludeFull = {
  parent: {
    select: { id: true, code: true, name: true, level: true },
  },
  children: {
    select: {
      id: true,
      code: true,
      name: true,
      level: true,
      displayOrder: true,
      isActive: true,
    },
    orderBy: [{ displayOrder: "asc" as const }, { code: "asc" as const }],
  },
  createdBy: {
    select: { id: true, firstName: true, lastName: true },
  },
} satisfies Prisma.PurchaseBudgetTypeInclude;

const budgetIncludeFull = {
  vessel: { select: { id: true, name: true, code: true } },
  budgetType: {
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      level: true,
      parent: { select: { id: true, code: true, name: true } },
      fundType: true,
    },
  },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.PurchaseBudgetInclude;

function stripScopeFromTypeWhere(
  where: Prisma.PurchaseBudgetTypeWhereInput
): Prisma.PurchaseBudgetTypeWhereInput {
  const { budgetScope: _s, ...rest } = where;
  return rest;
}

function stripLegacyBudgetWhere(
  where: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...where };
  delete next.dryDockProjectId;
  if (typeof next.budgetQuarter !== "undefined") delete next.budgetQuarter;
  if (typeof next.budgetYearEnd !== "undefined") delete next.budgetYearEnd;
  if (typeof next.budgetPeriodCode !== "undefined") delete next.budgetPeriodCode;
  if (typeof next.budgetPeriodType !== "undefined") delete next.budgetPeriodType;
  return next;
}

/**
 * Loads company budget types. On legacy DB (no budget_scope), returns all rows for NORMAL
 * and an empty list for DRY_DOCK until migrations are applied.
 */
export async function findPurchaseBudgetTypesCompat(params: {
  where: Prisma.PurchaseBudgetTypeWhereInput;
  budgetScope: PurchaseBudgetScope;
  orderBy?: Prisma.PurchaseBudgetTypeOrderByWithRelationInput[];
}) {
  const { where, budgetScope, orderBy } = params;
  const order =
    orderBy ?? [{ level: "asc" as const }, { displayOrder: "asc" as const }, { code: "asc" as const }];

  try {
    return await prisma.purchaseBudgetType.findMany({
      where,
      include: budgetTypeIncludeFull,
      orderBy: order,
    });
  } catch (error) {
    if (!isMissingBudgetScopeColumnError(error)) {
      try {
        return await prisma.purchaseBudgetType.findMany({
          where,
          orderBy: order,
        });
      } catch {
        throw error;
      }
    }
  }

  if (budgetScope === PURCHASE_BUDGET_SCOPE.DRY_DOCK) {
    return [];
  }

  try {
    return await prisma.purchaseBudgetType.findMany({
      where: stripScopeFromTypeWhere(where),
      include: budgetTypeIncludeFull,
      orderBy: order,
    });
  } catch {
    return prisma.purchaseBudgetType.findMany({
      where: stripScopeFromTypeWhere(where),
      orderBy: order,
    });
  }
}

type PurchaseBudgetColumnFlags = {
  yearEnd: boolean;
  quarter: boolean;
  periodCode: boolean;
  periodType: boolean;
  dryDockProject: boolean;
  typeBudgetScope: boolean;
};

let cachedPurchaseBudgetColumns: PurchaseBudgetColumnFlags | undefined;

async function getPurchaseBudgetColumnFlags(): Promise<PurchaseBudgetColumnFlags> {
  if (cachedPurchaseBudgetColumns) return cachedPurchaseBudgetColumns;
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        year_end: boolean;
        quarter: boolean;
        period_code: boolean;
        period_type: boolean;
        dry_dock: boolean;
        type_scope: boolean;
      }>
    >`
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'purchase_budgets' AND column_name = 'budget_year_end'
        ) AS year_end,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'purchase_budgets' AND column_name = 'budget_quarter'
        ) AS quarter,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'purchase_budgets' AND column_name = 'budget_period_code'
        ) AS period_code,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'purchase_budgets' AND column_name = 'budget_period_type'
        ) AS period_type,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'purchase_budgets' AND column_name = 'dry_dock_project_id'
        ) AS dry_dock,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'purchase_budget_types' AND column_name = 'budget_scope'
        ) AS type_scope
    `;
    cachedPurchaseBudgetColumns = {
      yearEnd: Boolean(rows[0]?.year_end),
      quarter: Boolean(rows[0]?.quarter),
      periodCode: Boolean(rows[0]?.period_code),
      periodType: Boolean(rows[0]?.period_type),
      dryDockProject: Boolean(rows[0]?.dry_dock),
      typeBudgetScope: Boolean(rows[0]?.type_scope),
    };
  } catch {
    cachedPurchaseBudgetColumns = {
      yearEnd: false,
      quarter: false,
      periodCode: false,
      periodType: false,
      dryDockProject: false,
      typeBudgetScope: false,
    };
  }
  cachedPurchaseBudgetQuarterColumn = cachedPurchaseBudgetColumns.quarter;
  return cachedPurchaseBudgetColumns;
}

function buildPurchaseBudgetListSelect(
  flags: PurchaseBudgetColumnFlags
): Prisma.PurchaseBudgetSelect {
  return {
    id: true,
    vesselId: true,
    budgetTypeId: true,
    budgetYear: true,
    budgetMonth: true,
    monthlyAmount: true,
    yearlyAmount: true,
    dailyAmount: true,
    currency: true,
    notes: true,
    createdAt: true,
    updatedAt: true,
    ...(flags.yearEnd ? { budgetYearEnd: true } : {}),
    ...(flags.quarter ? { budgetQuarter: true } : {}),
    ...(flags.periodCode ? { budgetPeriodCode: true } : {}),
    ...(flags.periodType ? { budgetPeriodType: true } : {}),
    ...(flags.dryDockProject ? { dryDockProjectId: true } : {}),
    vessel: budgetIncludeFull.vessel,
    budgetType: {
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        level: true,
        parent: { select: { id: true, code: true, name: true } },
      },
    },
    createdBy: budgetIncludeFull.createdBy,
  };
}

function normalizePurchaseBudgetListRow(
  row: Record<string, unknown>,
  flags: PurchaseBudgetColumnFlags
) {
  const budgetYear = Number(row.budgetYear);
  return {
    ...row,
    budgetYearEnd: flags.yearEnd
      ? (row.budgetYearEnd as number | null | undefined) ?? budgetYear
      : budgetYear,
    budgetQuarter: flags.quarter
      ? ((row.budgetQuarter as number | null | undefined) ?? null)
      : null,
    budgetPeriodCode: flags.periodCode
      ? ((row.budgetPeriodCode as string | null | undefined) ?? null)
      : null,
    budgetPeriodType: flags.periodType
      ? ((row.budgetPeriodType as string | null | undefined) ?? null)
      : null,
    dryDockProjectId: flags.dryDockProject
      ? ((row.dryDockProjectId as string | null | undefined) ?? null)
      : null,
  };
}

function preparePurchaseBudgetWhere(
  where: Record<string, unknown>,
  flags: PurchaseBudgetColumnFlags,
  budgetScope: PurchaseBudgetScope
): Prisma.PurchaseBudgetWhereInput {
  const next = { ...where } as Record<string, unknown>;
  if (!flags.yearEnd) delete next.budgetYearEnd;
  if (!flags.quarter) delete next.budgetQuarter;
  if (!flags.dryDockProject) delete next.dryDockProjectId;
  if (!flags.periodCode) delete next.budgetPeriodCode;
  if (!flags.periodType) delete next.budgetPeriodType;

  if (flags.typeBudgetScope) {
    next.budgetType = {
      ...(typeof next.budgetType === "object" && next.budgetType !== null
        ? (next.budgetType as Record<string, unknown>)
        : {}),
      budgetScope,
    };
  }

  return next as Prisma.PurchaseBudgetWhereInput;
}

function filterBudgetsByYearRange<T extends { budgetYear: number; budgetYearEnd?: number | null }>(
  rows: T[],
  yearStart?: number,
  yearEnd?: number
): T[] {
  if (yearStart == null && yearEnd == null) return rows;
  return rows.filter((row) => {
    const end = row.budgetYearEnd ?? row.budgetYear;
    if (yearStart != null && end < yearStart) return false;
    if (yearEnd != null && row.budgetYear > yearEnd) return false;
    return true;
  });
}

/**
 * Loads vessel budgets. Uses explicit column selects so legacy DBs without
 * budget_year_end / budget_quarter / period metadata still work.
 */
export async function findPurchaseBudgetsCompat(params: {
  where: Record<string, unknown>;
  budgetScope: PurchaseBudgetScope;
}) {
  const { where, budgetScope } = params;
  const flags = await getPurchaseBudgetColumnFlags();

  if (budgetScope === PURCHASE_BUDGET_SCOPE.DRY_DOCK && !flags.dryDockProject) {
    return [];
  }

  const yearStartFilter =
    typeof where.budgetYear === "number" ? where.budgetYear : undefined;
  const yearEndFilter =
    typeof where.budgetYearEnd === "number" ? where.budgetYearEnd : undefined;

  const queryWhere = preparePurchaseBudgetWhere(where, flags, budgetScope);
  const select = buildPurchaseBudgetListSelect(flags);
  const orderBy: Prisma.PurchaseBudgetOrderByWithRelationInput[] = [
    { budgetYear: "desc" },
    { budgetMonth: "asc" },
    { budgetType: { displayOrder: "asc" } },
  ];

  const rows = await prisma.purchaseBudget.findMany({
    where: queryWhere,
    select,
    orderBy,
  });

  const normalized = rows.map((row) =>
    normalizePurchaseBudgetListRow(row as Record<string, unknown>, flags)
  );

  if (!flags.yearEnd) {
    return filterBudgetsByYearRange(normalized, yearStartFilter, yearEndFilter);
  }

  return normalized;
}

/** Fields used by fleet budget variance (excludes dry_dock_project_id for legacy DBs). */
export const purchaseBudgetVarianceSelect = {
  vesselId: true,
  budgetMonth: true,
  budgetQuarter: true,
  monthlyAmount: true,
  yearlyAmount: true,
  vessel: { select: { id: true, name: true, code: true } },
  budgetType: {
    select: {
      code: true,
      name: true,
      level: true,
      parent: { select: { code: true, name: true } },
    },
  },
} satisfies Prisma.PurchaseBudgetSelect;

const purchaseBudgetVarianceSelectLegacy = {
  vesselId: true,
  budgetMonth: true,
  monthlyAmount: true,
  yearlyAmount: true,
  vessel: { select: { id: true, name: true, code: true } },
  budgetType: {
    select: {
      code: true,
      name: true,
      level: true,
      parent: { select: { code: true, name: true } },
    },
  },
} satisfies Prisma.PurchaseBudgetSelect;

export type PurchaseBudgetVarianceRow = Prisma.PurchaseBudgetGetPayload<{
  select: typeof purchaseBudgetVarianceSelect;
}>;

let cachedPurchaseBudgetQuarterColumn: boolean | undefined;

async function purchaseBudgetHasQuarterColumn(): Promise<boolean> {
  if (cachedPurchaseBudgetQuarterColumn !== undefined) return cachedPurchaseBudgetQuarterColumn;
  try {
    const rows = await prisma.$queryRaw<{ ok: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'purchase_budgets'
          AND column_name = 'budget_quarter'
      ) AS ok
    `;
    cachedPurchaseBudgetQuarterColumn = Boolean(rows[0]?.ok);
  } catch {
    cachedPurchaseBudgetQuarterColumn = false;
  }
  return cachedPurchaseBudgetQuarterColumn;
}

/**
 * Budget rows for variance / snapshots. Uses explicit `select` so legacy DBs without
 * `dry_dock_project_id` (or `budget_quarter`) do not fail on implicit column reads.
 */
export async function findPurchaseBudgetsForVariance(
  where: Prisma.PurchaseBudgetWhereInput
): Promise<PurchaseBudgetVarianceRow[]> {
  const hasQuarter = await purchaseBudgetHasQuarterColumn();
  if (!hasQuarter) {
    return (await prisma.purchaseBudget.findMany({
      where: stripLegacyBudgetWhere(where as Record<string, unknown>) as Prisma.PurchaseBudgetWhereInput,
      select: purchaseBudgetVarianceSelectLegacy,
    })) as PurchaseBudgetVarianceRow[];
  }
  try {
    return await prisma.purchaseBudget.findMany({
      where,
      select: purchaseBudgetVarianceSelect,
    });
  } catch (error) {
    if (!isLegacyPurchaseBudgetSchemaError(error)) throw error;
    cachedPurchaseBudgetQuarterColumn = false;
    return (await prisma.purchaseBudget.findMany({
      where: stripLegacyBudgetWhere(where as Record<string, unknown>) as Prisma.PurchaseBudgetWhereInput,
      select: purchaseBudgetVarianceSelectLegacy,
    })) as PurchaseBudgetVarianceRow[];
  }
}

const purchaseBudgetCodeSelect = {
  yearlyAmount: true,
  budgetMonth: true,
  budgetType: { select: { code: true } },
} satisfies Prisma.PurchaseBudgetSelect;

export async function findPurchaseBudgetYearlyByCode(
  where: Prisma.PurchaseBudgetWhereInput
): Promise<Prisma.PurchaseBudgetGetPayload<{ select: typeof purchaseBudgetCodeSelect }>[]> {
  try {
    return await prisma.purchaseBudget.findMany({ where, select: purchaseBudgetCodeSelect });
  } catch (error) {
    if (!isLegacyPurchaseBudgetSchemaError(error)) throw error;
    return prisma.purchaseBudget.findMany({
      where: stripLegacyBudgetWhere(where as Record<string, unknown>) as Prisma.PurchaseBudgetWhereInput,
      select: purchaseBudgetCodeSelect,
    });
  }
}
