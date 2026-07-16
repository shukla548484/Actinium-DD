import prisma from "@/lib/prisma";

/**
 * Resolve Budgeted / Un-Budgeted at PO issue.
 * Priority: explicit request (confirm/create PO UI) → existing requisition flag → budget code hint.
 */
export function resolveIsBudgetedForPoIssue(params: {
  requested?: boolean | null;
  requisitionIsBudgeted?: boolean | null;
  budgetCode?: string | null;
}): boolean {
  if (params.requested === true || params.requested === false) {
    return params.requested;
  }
  if (params.requisitionIsBudgeted === true || params.requisitionIsBudgeted === false) {
    return params.requisitionIsBudgeted;
  }
  const code = String(params.budgetCode ?? "").trim();
  if (code) return true;
  return false;
}

/** Persist classification on requisition + snapshot on PO (analytics uses PO snapshot first). */
export async function applyBudgetClassificationAtPoIssue(params: {
  requisitionId: string;
  purchaseOrderId: string;
  isBudgeted: boolean;
}): Promise<void> {
  await prisma.$transaction([
    prisma.requisition.update({
      where: { id: params.requisitionId },
      data: { isBudgeted: params.isBudgeted },
    }),
    prisma.purchaseOrder.update({
      where: { id: params.purchaseOrderId },
      data: { isBudgeted: params.isBudgeted },
    }),
  ]);
}

export function formatBudgetClassificationLabel(
  isBudgeted: boolean | null | undefined
): "Budgeted" | "Un-Budgeted" | "Unset" {
  if (isBudgeted === true) return "Budgeted";
  if (isBudgeted === false) return "Un-Budgeted";
  return "Unset";
}
