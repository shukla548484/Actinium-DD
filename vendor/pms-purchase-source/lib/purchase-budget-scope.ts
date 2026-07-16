/**
 * Separates normal purchase budgets from dry-dock project budgets.
 */
export const PURCHASE_BUDGET_SCOPE = {
  NORMAL: "NORMAL",
  DRY_DOCK: "DRY_DOCK",
} as const;

export type PurchaseBudgetScope =
  (typeof PURCHASE_BUDGET_SCOPE)[keyof typeof PURCHASE_BUDGET_SCOPE];

export const PURCHASE_BUDGET_SCOPE_LABELS: Record<PurchaseBudgetScope, string> = {
  NORMAL: "Normal Budget",
  DRY_DOCK: "Dry Dock Budget",
};

export function parsePurchaseBudgetScope(
  value: string | null | undefined
): PurchaseBudgetScope {
  const v = String(value ?? "").trim().toUpperCase();
  if (v === PURCHASE_BUDGET_SCOPE.DRY_DOCK) return PURCHASE_BUDGET_SCOPE.DRY_DOCK;
  return PURCHASE_BUDGET_SCOPE.NORMAL;
}

/** Dry-dock requisitions resolve against DD-* master categories, not normal L1/L2. */
export function budgetScopeForRequisitionPurpose(
  requisitionPurpose?: string | null
): PurchaseBudgetScope {
  if (String(requisitionPurpose ?? "").trim().toUpperCase() === "DRY_DOCK") {
    return PURCHASE_BUDGET_SCOPE.DRY_DOCK;
  }
  return PURCHASE_BUDGET_SCOPE.NORMAL;
}
