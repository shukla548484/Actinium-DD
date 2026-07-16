import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { parsePurchaseBudgetScope, PURCHASE_BUDGET_SCOPE } from "@/lib/purchase-budget-scope";
import { requireBudgetViewForContext } from "@/lib/drydock-budget-access";
import { serializePrismaError } from "@/lib/prisma-error-utils";
import { parseCsvIds } from "@/lib/purchase-budget-monthly-monitor";
import { yearMonthRangeToDateBounds } from "@/lib/purchase-budget-year-range";
import type { BudgetVarianceActualsSource } from "@/lib/purchase-budget-variance";
import { findPurchaseBudgetsCompat } from "@/lib/purchase-budget-schema-compat";
import {
  invoiceSpendPeriodSql,
  parseBudgetPostingBasis,
  poSpendPeriodSql,
  spendMonthKeySql,
  type BudgetPostingBasis,
} from "@/lib/purchase-budget-posting-basis";

export type BudgetMonitorTransaction = {
  id: string;
  kind: "actual" | "committed";
  sourceType: "purchase_order" | "invoice" | "requisition";
  reference: string;
  date: string;
  budgetCode: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
  requisitionId: string | null;
  purchaseOrderId: string | null;
};

function parseActualsSource(value: string | null): BudgetVarianceActualsSource {
  return value === "invoice" ? "invoice" : "po";
}

function purchaseScopeSql(scope: ReturnType<typeof parsePurchaseBudgetScope>): Prisma.Sql {
  if (scope === PURCHASE_BUDGET_SCOPE.DRY_DOCK) {
    return Prisma.sql`AND UPPER(COALESCE(r.requisition_purpose, '')) = 'DRY_DOCK'`;
  }
  return Prisma.sql`AND UPPER(COALESCE(r.requisition_purpose, '')) <> 'DRY_DOCK'`;
}

function requisitionTypeSql(type?: string | null): Prisma.Sql {
  const value = String(type ?? "").trim();
  if (!value || value === "all") return Prisma.empty;
  return Prisma.sql`AND r.requisition_type::text = ${value}`;
}

function machinerySql(ids: string[]): Prisma.Sql {
  if (!ids.length) return Prisma.empty;
  return Prisma.sql`AND EXISTS (
    SELECT 1 FROM requisition_items ri
    WHERE ri.requisition_id = r.id
      AND ri.machinery_instance_id IN (${Prisma.join(ids)})
  )`;
}

function committedMonthSql(monthKey: string | null): Prisma.Sql {
  if (!monthKey?.trim()) return Prisma.empty;
  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return Prisma.empty;
  return Prisma.sql`
    AND EXTRACT(YEAR FROM r.date_of_creation)::int = ${year}
    AND EXTRACT(MONTH FROM r.date_of_creation)::int = ${month}
  `;
}

function transactionDisplayDate(
  row: {
    date_of_creation: Date;
    date_of_issue?: Date | null;
    invoice_date?: Date | null;
  },
  postingBasis: BudgetPostingBasis,
  actualsSource: BudgetVarianceActualsSource,
  kind: "actual" | "committed"
): Date {
  if (kind === "committed") return row.date_of_creation;
  if (actualsSource === "invoice" && postingBasis === "invoice_date" && row.invoice_date) {
    return row.invoice_date;
  }
  if (postingBasis === "po_date" && row.date_of_issue) {
    return row.date_of_issue;
  }
  return row.date_of_creation;
}

// GET /api/purchase/budgets/monitor/transactions — drill-down lines
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vesselId = searchParams.get("vesselId");
    if (!vesselId) {
      return NextResponse.json({ error: "vesselId is required" }, { status: 400 });
    }

    const dryDockProjectId = searchParams.get("dryDockProjectId");
    const budgetScope = parsePurchaseBudgetScope(searchParams.get("budgetScope"));
    const dryDockContext =
      Boolean(dryDockProjectId) || budgetScope === PURCHASE_BUDGET_SCOPE.DRY_DOCK;
    const viewDenied = requireBudgetViewForContext(user, dryDockContext);
    if (viewDenied) return viewDenied;

    const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
    const yearEnd = parseInt(searchParams.get("yearEnd") ?? String(year), 10);
    const monthFrom = parseInt(searchParams.get("monthFrom") ?? "1", 10);
    const monthTo = parseInt(searchParams.get("monthTo") ?? "12", 10);
    const kind = searchParams.get("kind") === "committed" ? "committed" : "actual";
    const actualsSource = parseActualsSource(searchParams.get("actualsSource"));
    const postingBasis = parseBudgetPostingBasis(searchParams.get("postingBasis"));
    const l1BudgetTypeId = searchParams.get("l1BudgetTypeId");
    const l2BudgetCode = searchParams.get("l2BudgetCode");
    const unbudgetedOnly = searchParams.get("unbudgetedOnly") === "true";
    const missingCodeOnly = searchParams.get("missingCodeOnly") === "true";
    const monthKey = searchParams.get("monthKey");
    const requisitionType = searchParams.get("requisitionType");
    const machineryFilterIds = parseCsvIds(searchParams.get("machineryInstanceIds"));

    const { startDate, endDate } = yearMonthRangeToDateBounds(
      { year, month: monthFrom },
      { year: yearEnd, month: monthTo }
    );

    let definedL2Codes: Set<string> | null = null;
    let l1L2Codes: Set<string> | null = null;

    if (unbudgetedOnly && !missingCodeOnly) {
      const budgets = await findPurchaseBudgetsCompat({
        where: {
          vesselId,
          budgetYear: year,
          budgetYearEnd: yearEnd,
          ...(dryDockProjectId ? { dryDockProjectId } : { dryDockProjectId: null }),
        },
        budgetScope,
      });
      definedL2Codes = new Set(budgets.map((b) => b.budgetType.code));
    } else if (l1BudgetTypeId) {
      const l2Rows = await prisma.purchaseBudgetType.findMany({
        where: { parentId: l1BudgetTypeId, level: 2, isActive: true },
        select: { code: true },
      });
      l1L2Codes = new Set(l2Rows.map((r) => r.code));
    }

    const matchesBudgetCodeFilter = (budgetCode: string): boolean => {
      const code = budgetCode?.trim() ?? "";
      if (missingCodeOnly) return code.length === 0;
      if (!code) return false;
      if (l2BudgetCode && code !== l2BudgetCode) return false;
      if (unbudgetedOnly && definedL2Codes) {
        return !definedL2Codes.has(code);
      }
      if (l1L2Codes) {
        return l1L2Codes.has(code);
      }
      return true;
    };

    const transactions: BudgetMonitorTransaction[] = [];
    const budgetCodePresenceSql = missingCodeOnly
      ? Prisma.sql`AND COALESCE(NULLIF(TRIM(r.budget_code), ''), '') = ''`
      : Prisma.sql`AND NULLIF(TRIM(r.budget_code), '') IS NOT NULL`;

    if (kind === "committed") {
      const rows = await prisma.$queryRaw<
        Array<{
          id: string;
          requisition_number: string;
          date_of_creation: Date;
          budget_code: string;
          heading: string | null;
          amount: unknown;
          status: string;
        }>
      >`
        WITH reqs AS (
          SELECT r.id, r.requisition_number, r.date_of_creation,
                 NULLIF(TRIM(r.budget_code), '') AS budget_code,
                 r.heading, r.status::text AS status
          FROM requisitions r
          WHERE r.deleted_at IS NULL
            AND r.vessel_id = ${vesselId}::uuid
            AND r.status::text = 'QUOTE_APPROVED'
            AND r.date_of_creation >= ${startDate}
            AND r.date_of_creation <= ${endDate}
            ${budgetCodePresenceSql}
            AND NOT EXISTS (
              SELECT 1 FROM purchase_orders po
              WHERE po.requisition_id = r.id AND po.status <> 'CANCELLED'
            )
            ${purchaseScopeSql(budgetScope)}
            ${requisitionTypeSql(requisitionType)}
            ${machinerySql(machineryFilterIds)}
            ${committedMonthSql(monthKey)}
        ),
        valued AS (
          SELECT reqs.*,
            COALESCE(
              (SELECT vq.total_amount FROM vendor_quotes vq
               WHERE vq.requisition_id = reqs.id AND vq.status = 'APPROVED'
               ORDER BY vq.updated_at DESC LIMIT 1),
              0
            ) AS amount
          FROM reqs
        )
        SELECT id, requisition_number, date_of_creation, budget_code, heading, amount, status
        FROM valued
        WHERE amount > 0
        ORDER BY date_of_creation DESC
        LIMIT 200
      `;

      for (const row of rows) {
        if (!matchesBudgetCodeFilter(row.budget_code)) continue;
        transactions.push({
          id: row.id,
          kind: "committed",
          sourceType: "requisition",
          reference: row.requisition_number,
          date: row.date_of_creation.toISOString(),
          budgetCode: row.budget_code,
          description: row.heading ?? row.requisition_number,
          amount: Number(row.amount) || 0,
          currency: "USD",
          status: row.status,
          requisitionId: row.id,
          purchaseOrderId: null,
        });
      }
    } else if (actualsSource === "invoice") {
      const rows = await prisma.$queryRaw<
        Array<{
          id: string;
          invoice_number: string | null;
          invoice_amount: unknown;
          status: string;
          invoice_date: Date;
          purchase_order_id: string | null;
          requisition_id: string;
          requisition_number: string;
          heading: string | null;
          req_budget_code: string | null;
          po_budget_code: string | null;
          date_of_creation: Date;
          date_of_issue: Date | null;
        }>
      >`
        SELECT i.id, i.invoice_number, i.invoice_amount, i.status::text AS status,
               i.invoice_date, i.purchase_order_id,
               r.id AS requisition_id, r.requisition_number, r.heading,
               NULLIF(TRIM(r.budget_code), '') AS req_budget_code,
               NULLIF(TRIM(po.budget_code), '') AS po_budget_code,
               r.date_of_creation, po.date_of_issue
        FROM invoices i
        INNER JOIN requisitions r ON i.requisition_id = r.id
        LEFT JOIN purchase_orders po ON po.id = i.purchase_order_id
        WHERE i.status NOT IN ('CANCELLED', 'RETURNED')
          AND r.deleted_at IS NULL
          AND r.vessel_id = ${vesselId}::uuid
          ${invoiceSpendPeriodSql(postingBasis, startDate, endDate)}
          ${spendMonthKeySql(postingBasis, "invoice", monthKey)}
          ${purchaseScopeSql(budgetScope)}
          ${requisitionTypeSql(requisitionType)}
          ${machinerySql(machineryFilterIds)}
        ORDER BY i.invoice_date DESC NULLS LAST
        LIMIT 200
      `;

      for (const row of rows) {
        const budgetCode = row.po_budget_code?.trim() || row.req_budget_code?.trim() || "";
        if (missingCodeOnly) {
          if (budgetCode.length > 0) continue;
        } else if (!budgetCode) {
          continue;
        }
        if (!matchesBudgetCodeFilter(budgetCode)) continue;

        const displayDate = transactionDisplayDate(
          {
            date_of_creation: row.date_of_creation,
            date_of_issue: row.date_of_issue,
            invoice_date: row.invoice_date,
          },
          postingBasis,
          actualsSource,
          kind
        );

        transactions.push({
          id: row.id,
          kind: "actual",
          sourceType: "invoice",
          reference: row.invoice_number ?? row.id,
          date: displayDate.toISOString(),
          budgetCode,
          description: row.heading ?? row.requisition_number,
          amount: Number(row.invoice_amount) || 0,
          currency: "USD",
          status: row.status,
          requisitionId: row.requisition_id,
          purchaseOrderId: row.purchase_order_id,
        });
      }
    } else {
      const rows = await prisma.$queryRaw<
        Array<{
          id: string;
          po_number: string | null;
          total_amount: unknown;
          status: string;
          budget_code: string | null;
          date_of_issue: Date | null;
          requisition_id: string;
          requisition_number: string;
          heading: string | null;
          req_budget_code: string | null;
          date_of_creation: Date;
        }>
      >`
        SELECT po.id, po.po_number, po.total_amount, po.status::text AS status,
               NULLIF(TRIM(po.budget_code), '') AS budget_code,
               po.date_of_issue,
               r.id AS requisition_id, r.requisition_number, r.heading,
               NULLIF(TRIM(r.budget_code), '') AS req_budget_code,
               r.date_of_creation
        FROM purchase_orders po
        INNER JOIN requisitions r ON po.requisition_id = r.id
        WHERE po.status <> 'CANCELLED'
          AND r.deleted_at IS NULL
          AND r.vessel_id = ${vesselId}::uuid
          ${poSpendPeriodSql(postingBasis, startDate, endDate)}
          ${spendMonthKeySql(postingBasis, "po", monthKey)}
          ${purchaseScopeSql(budgetScope)}
          ${requisitionTypeSql(requisitionType)}
          ${machinerySql(machineryFilterIds)}
        ORDER BY COALESCE(po.date_of_issue, r.date_of_creation) DESC
        LIMIT 200
      `;

      for (const row of rows) {
        const budgetCode = row.budget_code?.trim() || row.req_budget_code?.trim() || "";
        if (missingCodeOnly) {
          if (budgetCode.length > 0) continue;
        } else if (!budgetCode) {
          continue;
        }
        if (!matchesBudgetCodeFilter(budgetCode)) continue;

        const displayDate = transactionDisplayDate(
          {
            date_of_creation: row.date_of_creation,
            date_of_issue: row.date_of_issue,
          },
          postingBasis,
          actualsSource,
          kind
        );

        transactions.push({
          id: row.id,
          kind: "actual",
          sourceType: "purchase_order",
          reference: row.po_number ?? row.id,
          date: displayDate.toISOString(),
          budgetCode,
          description: row.heading ?? row.requisition_number,
          amount: Number(row.total_amount) || 0,
          currency: "USD",
          status: row.status,
          requisitionId: row.requisition_id,
          purchaseOrderId: row.id,
        });
      }
    }

    return NextResponse.json({ transactions, kind, actualsSource, postingBasis });
  } catch (error: unknown) {
    const details = serializePrismaError(error);
    console.error("Error fetching budget monitor transactions:", details);
    return NextResponse.json(
      { error: "Failed to fetch transactions", details: details.message },
      { status: 500 }
    );
  }
}
