import { normalizeDesignationAccessLevel } from "@/lib/admin-access-level";

/** Vessel crew and Master (≤25) must not see purchase audit history; office users (>25) may. */
export function canViewPurchaseEntityHistory(
  level: number | string | null | undefined
): boolean {
  const n = normalizeDesignationAccessLevel(level);
  return n != null && n > 25;
}
