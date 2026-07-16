import { Prisma } from "@prisma/client";
import type { BudgetVarianceActualsSource } from "@/lib/purchase-budget-spend";

export type BudgetPostingBasis = "req_created" | "po_date" | "invoice_date";

export const BUDGET_POSTING_BASIS_LABELS: Record<BudgetPostingBasis, string> = {
  req_created: "Requisition date",
  po_date: "PO issue date",
  invoice_date: "Invoice date",
};

export function parseBudgetPostingBasis(value: string | null | undefined): BudgetPostingBasis {
  if (value === "po_date" || value === "invoice_date") return value;
  return "req_created";
}

/** Date window for PO-based actual spend queries. */
export function poSpendPeriodSql(
  basis: BudgetPostingBasis,
  startDate: Date,
  endDate: Date
): Prisma.Sql {
  if (basis === "po_date") {
    return Prisma.sql`
      AND po.date_of_issue >= ${startDate}
      AND po.date_of_issue <= ${endDate}
    `;
  }
  return Prisma.sql`
    AND r.date_of_creation >= ${startDate}
    AND r.date_of_creation <= ${endDate}
  `;
}

/** Date window for invoice-based actual spend queries. */
export function invoiceSpendPeriodSql(
  basis: BudgetPostingBasis,
  startDate: Date,
  endDate: Date
): Prisma.Sql {
  if (basis === "invoice_date") {
    return Prisma.sql`
      AND i.invoice_date >= ${startDate}
      AND i.invoice_date <= ${endDate}
    `;
  }
  if (basis === "po_date") {
    return Prisma.sql`
      AND po.date_of_issue >= ${startDate}
      AND po.date_of_issue <= ${endDate}
    `;
  }
  return Prisma.sql`
    AND r.date_of_creation >= ${startDate}
    AND r.date_of_creation <= ${endDate}
  `;
}

/** Month bucket for monthly matrices (always uses the same anchor as period filter). */
export function spendMonthExtractSql(
  basis: BudgetPostingBasis,
  actualsSource: BudgetVarianceActualsSource
): Prisma.Sql {
  if (actualsSource === "invoice" && basis === "invoice_date") {
    return Prisma.sql`
      EXTRACT(YEAR FROM i.invoice_date)::int AS period_year,
      EXTRACT(MONTH FROM i.invoice_date)::int AS period_month
    `;
  }
  if (basis === "po_date") {
    return Prisma.sql`
      EXTRACT(YEAR FROM po.date_of_issue)::int AS period_year,
      EXTRACT(MONTH FROM po.date_of_issue)::int AS period_month
    `;
  }
  return Prisma.sql`
    EXTRACT(YEAR FROM r.date_of_creation)::int AS period_year,
    EXTRACT(MONTH FROM r.date_of_creation)::int AS period_month
  `;
}

/** Month bucket filter for drill-down and list queries (matches spendMonthExtractSql anchor). */
export function spendMonthKeySql(
  basis: BudgetPostingBasis,
  actualsSource: BudgetVarianceActualsSource,
  monthKey: string | null
): Prisma.Sql {
  if (!monthKey?.trim()) return Prisma.empty;
  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return Prisma.empty;

  if (actualsSource === "invoice" && basis === "invoice_date") {
    return Prisma.sql`
      AND EXTRACT(YEAR FROM i.invoice_date)::int = ${year}
      AND EXTRACT(MONTH FROM i.invoice_date)::int = ${month}
    `;
  }
  if (basis === "po_date") {
    return Prisma.sql`
      AND EXTRACT(YEAR FROM po.date_of_issue)::int = ${year}
      AND EXTRACT(MONTH FROM po.date_of_issue)::int = ${month}
    `;
  }
  return Prisma.sql`
    AND EXTRACT(YEAR FROM r.date_of_creation)::int = ${year}
    AND EXTRACT(MONTH FROM r.date_of_creation)::int = ${month}
  `;
}
