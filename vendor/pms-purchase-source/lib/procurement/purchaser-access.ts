import {
  isAdminEquivalentAccessLevel,
  normalizeDesignationAccessLevel,
} from "@/lib/admin-access-level";

/** Purchaser / admin levels allowed to create and issue purchase orders (32/33 + admins). */
export const PURCHASER_PO_ACCESS_LEVELS = [32, 33, 50, 99, 100] as const;

export function canIssuePurchaseOrders(
  level: number | string | null | undefined
): boolean {
  const n = normalizeDesignationAccessLevel(level);
  if (n == null) return false;
  if (isAdminEquivalentAccessLevel(n)) return true;
  return n === 32 || n === 33;
}
