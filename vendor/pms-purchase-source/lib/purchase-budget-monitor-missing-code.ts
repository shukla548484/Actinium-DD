import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { PurchaseBudgetScope } from "@/lib/purchase-budget-scope";
import { PURCHASE_BUDGET_SCOPE } from "@/lib/purchase-budget-scope";
import type { BudgetVarianceActualsSource } from "@/lib/purchase-budget-variance";
import { PIPELINE_REQUISITION_STATUSES } from "@/lib/purchase-budget-spend";
import {
  invoiceSpendPeriodSql,
  poSpendPeriodSql,
  type BudgetPostingBasis,
} from "@/lib/purchase-budget-posting-basis";

function purchaseScopeSql(scope: PurchaseBudgetScope): Prisma.Sql {
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

/** Spend/commitment on requisitions or POs with no budget code assigned. */
export async function sumMissingBudgetCodeExposure(params: {
  vesselId: string;
  startDate: Date;
  endDate: Date;
  actualsSource: BudgetVarianceActualsSource;
  postingBasis?: BudgetPostingBasis;
  budgetScope: PurchaseBudgetScope;
  requisitionType?: string | null;
  machineryFilterIds: string[];
}): Promise<{ actual: number; committed: number }> {
  const {
    vesselId,
    startDate,
    endDate,
    actualsSource,
    postingBasis = "req_created",
    budgetScope,
    requisitionType,
    machineryFilterIds,
  } = params;

  let actual = 0;

  if (actualsSource === "invoice") {
    const rows = await prisma.$queryRaw<Array<{ total: unknown }>>`
      SELECT COALESCE(SUM(i.invoice_amount), 0) AS total
      FROM invoices i
      INNER JOIN requisitions r ON i.requisition_id = r.id
      LEFT JOIN purchase_orders po ON po.id = i.purchase_order_id
      WHERE i.status NOT IN ('CANCELLED', 'RETURNED')
        AND r.deleted_at IS NULL
        AND r.vessel_id = ${vesselId}::uuid
        ${invoiceSpendPeriodSql(postingBasis, startDate, endDate)}
        AND COALESCE(NULLIF(TRIM(po.budget_code), ''), NULLIF(TRIM(r.budget_code), '')) IS NULL
        ${purchaseScopeSql(budgetScope)}
        ${requisitionTypeSql(requisitionType)}
        ${machinerySql(machineryFilterIds)}
    `;
    actual = Number(rows[0]?.total) || 0;
  } else {
    const rows = await prisma.$queryRaw<Array<{ total: unknown }>>`
      SELECT COALESCE(SUM(po.total_amount), 0) AS total
      FROM purchase_orders po
      INNER JOIN requisitions r ON po.requisition_id = r.id
      WHERE po.status <> 'CANCELLED'
        AND r.deleted_at IS NULL
        AND r.vessel_id = ${vesselId}::uuid
        ${poSpendPeriodSql(postingBasis, startDate, endDate)}
        AND COALESCE(NULLIF(TRIM(po.budget_code), ''), NULLIF(TRIM(r.budget_code), '')) IS NULL
        ${purchaseScopeSql(budgetScope)}
        ${requisitionTypeSql(requisitionType)}
        ${machinerySql(machineryFilterIds)}
    `;
    actual = Number(rows[0]?.total) || 0;
  }

  const committedRows = await prisma.$queryRaw<Array<{ total: unknown }>>`
    WITH reqs AS (
      SELECT r.id
      FROM requisitions r
      WHERE r.deleted_at IS NULL
        AND r.vessel_id = ${vesselId}::uuid
        AND r.status::text IN (${Prisma.join([...PIPELINE_REQUISITION_STATUSES])})
        AND r.date_of_creation >= ${startDate}
        AND r.date_of_creation <= ${endDate}
        AND COALESCE(NULLIF(TRIM(r.budget_code), ''), '') = ''
        AND NOT EXISTS (
          SELECT 1 FROM purchase_orders po
          WHERE po.requisition_id = r.id AND po.status <> 'CANCELLED'
        )
        ${purchaseScopeSql(budgetScope)}
        ${requisitionTypeSql(requisitionType)}
        ${machinerySql(machineryFilterIds)}
    )
    SELECT COALESCE(SUM(
      COALESCE(
        (SELECT vq.total_amount FROM vendor_quotes vq
         WHERE vq.requisition_id = reqs.id AND vq.status = 'APPROVED'
         ORDER BY vq.updated_at DESC LIMIT 1),
        (SELECT vq.total_amount FROM vendor_quotes vq
         WHERE vq.requisition_id = reqs.id AND vq.status IN ('RECEIVED', 'APPROVED')
         ORDER BY vq.updated_at DESC LIMIT 1),
        0
      )
    ), 0) AS total
    FROM reqs
  `;

  const committed = Number(committedRows[0]?.total) || 0;

  return { actual, committed };
}
