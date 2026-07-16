import prisma from "@/lib/prisma";

export type BackfillPoBudgetRow = {
  poId: string;
  requisitionId: string;
  poNumber: string;
  requisitionNumber: string;
  resolved: boolean;
  source: "requisition_flag" | "budget_code_inferred";
};

export type BackfillPoBudgetResult = {
  pendingCount: number;
  wouldUpdate: number;
  skipped: number;
  rows: BackfillPoBudgetRow[];
  applied: number;
  dryRun: boolean;
};

type RawPoRow = {
  po_id: string;
  requisition_id: string;
  po_number: string;
  requisition_number: string;
  po_is_budgeted: boolean | null;
  req_is_budgeted: boolean | null;
  budget_code: string | null;
};

async function fetchPendingPoRows(): Promise<RawPoRow[]> {
  return prisma.$queryRaw<RawPoRow[]>`
    SELECT po.id AS po_id,
           po.requisition_id,
           po.po_number,
           r.requisition_number,
           po.po_is_budgeted,
           r.is_budgeted AS req_is_budgeted,
           COALESCE(NULLIF(TRIM(po.budget_code), ''), NULLIF(TRIM(r.budget_code), '')) AS budget_code
    FROM purchase_orders po
    INNER JOIN requisitions r ON r.id = po.requisition_id
    WHERE po.status <> 'CANCELLED'
      AND r.deleted_at IS NULL
      AND po.po_is_budgeted IS NULL
    ORDER BY po.date_of_issue ASC
  `;
}

export async function backfillPoBudgetClassification(params: {
  dryRun: boolean;
  inferFromBudgetCode?: boolean;
  limit?: number;
}): Promise<BackfillPoBudgetResult> {
  const { dryRun, inferFromBudgetCode = false, limit = 500 } = params;
  const poRows = await fetchPendingPoRows();

  const toApply: BackfillPoBudgetRow[] = [];
  let skipped = 0;

  for (const row of poRows) {
    let resolved: boolean | null = null;
    let source: BackfillPoBudgetRow["source"] | null = null;

    if (row.req_is_budgeted === true || row.req_is_budgeted === false) {
      resolved = row.req_is_budgeted;
      source = "requisition_flag";
    } else if (inferFromBudgetCode && row.budget_code) {
      resolved = true;
      source = "budget_code_inferred";
    }

    if (resolved === null || source === null) {
      skipped += 1;
      continue;
    }

    toApply.push({
      poId: row.po_id,
      requisitionId: row.requisition_id,
      poNumber: row.po_number,
      requisitionNumber: row.requisition_number,
      resolved,
      source,
    });
  }

  const batch = toApply.slice(0, limit);
  let applied = 0;

  if (!dryRun) {
    for (const row of batch) {
      await prisma.$transaction([
        prisma.purchaseOrder.update({
          where: { id: row.poId },
          data: { isBudgeted: row.resolved },
        }),
        prisma.requisition.update({
          where: { id: row.requisitionId },
          data: { isBudgeted: row.resolved },
        }),
      ]);
      applied += 1;
    }
  }

  return {
    pendingCount: poRows.length,
    wouldUpdate: toApply.length,
    skipped,
    rows: dryRun ? batch : batch.slice(0, applied),
    applied: dryRun ? 0 : applied,
    dryRun,
  };
}

/** One-time SQL for hosts where CLI cannot reach production (Neon / Supabase SQL editor). */
export const ADD_PO_IS_BUDGETED_COLUMN_SQL = `
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS po_is_budgeted BOOLEAN;

CREATE INDEX IF NOT EXISTS purchase_orders_po_is_budgeted_idx
  ON purchase_orders (po_is_budgeted);
`.trim();
