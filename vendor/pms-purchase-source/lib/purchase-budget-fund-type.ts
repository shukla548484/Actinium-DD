export type PurchaseBudgetFundType =
  | "OPEX"
  | "DRY_DOCK"
  | "NEW_BUILDING"
  | "CAPEX"
  | "PRE_DELIVERY";

export const PURCHASE_BUDGET_FUND_TYPES: PurchaseBudgetFundType[] = [
  "OPEX",
  "DRY_DOCK",
  "NEW_BUILDING",
  "CAPEX",
  "PRE_DELIVERY",
];

export const PURCHASE_BUDGET_FUND_TYPE_LABELS: Record<PurchaseBudgetFundType, string> = {
  OPEX: "Operating (OPEX)",
  DRY_DOCK: "Dry Dock",
  NEW_BUILDING: "New Building",
  CAPEX: "Capital (Capex)",
  PRE_DELIVERY: "Pre-delivery",
};

export function parsePurchaseBudgetFundType(
  value: string | null | undefined
): PurchaseBudgetFundType | null {
  if (!value?.trim()) return null;
  const upper = value.trim().toUpperCase() as PurchaseBudgetFundType;
  return PURCHASE_BUDGET_FUND_TYPES.includes(upper) ? upper : null;
}

export function fundTypeFromBudgetScope(scope: string): PurchaseBudgetFundType {
  return scope === "DRY_DOCK" ? "DRY_DOCK" : "OPEX";
}
