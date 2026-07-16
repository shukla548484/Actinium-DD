export const FREIGHT_PO_SUFFIX = ".FRT";

export const FREIGHT_CHARGE_KEYS = [
  "deliveryCharges",
  "courierCharges",
  "handlingCharges",
  "transportCharges",
  "customClearanceCharges",
  "warehouseCharges",
] as const;

export const FREIGHT_PURCHASE_ACCESS_LEVELS = [32, 33, 37, 39, 41, 44, 46, 47, 48, 50, 99, 100];

export function isFreightPoNumber(poNumber: string): boolean {
  return poNumber.trim().toUpperCase().endsWith(FREIGHT_PO_SUFFIX);
}

export function buildFreightPoNumber(parentPoNumber: string): string {
  const base = parentPoNumber.trim();
  if (isFreightPoNumber(base)) {
    throw new Error("Parent PO cannot already be a freight PO");
  }
  return `${base}${FREIGHT_PO_SUFFIX}`;
}

export function canManageFreight(accessLevel: number | null | undefined): boolean {
  if (accessLevel == null) return false;
  return FREIGHT_PURCHASE_ACCESS_LEVELS.includes(accessLevel);
}
