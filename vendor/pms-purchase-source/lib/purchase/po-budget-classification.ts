/** Effective budget flag: PO classification wins, then requisition. */
export function resolveEffectiveIsBudgeted(
  poIsBudgeted: boolean | null | undefined,
  requisitionIsBudgeted: boolean | null | undefined
): boolean | null {
  if (poIsBudgeted === true || requisitionIsBudgeted === true) return true;
  if (poIsBudgeted === false || requisitionIsBudgeted === false) return false;
  return null;
}

export function isUnbudgetedPurchase(params: {
  poIsBudgeted?: boolean | null;
  requisitionIsBudgeted?: boolean | null;
}): boolean {
  return resolveEffectiveIsBudgeted(params.poIsBudgeted, params.requisitionIsBudgeted) === false;
}

export type BudgetClassificationDisplay = "Budgeted" | "Un-Budgeted" | "Unset";

export function budgetClassificationLabel(
  isBudgeted: boolean | null | undefined
): BudgetClassificationDisplay {
  if (isBudgeted === true) return "Budgeted";
  if (isBudgeted === false) return "Un-Budgeted";
  return "Unset";
}
