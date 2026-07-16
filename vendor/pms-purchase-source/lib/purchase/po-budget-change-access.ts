import { isAdminEquivalentAccessLevel, normalizeDesignationAccessLevel } from "@/lib/admin-access-level";

/** Accounts trainee / assistant — may request PO budget reclassification after invoice upload. */
export const PO_BUDGET_CHANGE_REQUESTOR_LEVELS = [30, 31] as const;

/** Superintendent through Fleet Manager — approve budget reclassification. */
export const PO_BUDGET_CHANGE_APPROVER_LEVELS = [44, 45, 46, 47, 48] as const;

export function canRequestPoBudgetChange(accessLevel: number | string | null | undefined): boolean {
  const level = normalizeDesignationAccessLevel(accessLevel);
  if (level == null) return false;
  if (isAdminEquivalentAccessLevel(level)) return true;
  return (PO_BUDGET_CHANGE_REQUESTOR_LEVELS as readonly number[]).includes(level);
}

export function canApprovePoBudgetChange(accessLevel: number | string | null | undefined): boolean {
  const level = normalizeDesignationAccessLevel(accessLevel);
  if (level == null) return false;
  if (isAdminEquivalentAccessLevel(level)) return true;
  return (PO_BUDGET_CHANGE_APPROVER_LEVELS as readonly number[]).includes(level);
}

export function canViewPoBudgetChangePage(accessLevel: number | string | null | undefined): boolean {
  return canRequestPoBudgetChange(accessLevel) || canApprovePoBudgetChange(accessLevel);
}
