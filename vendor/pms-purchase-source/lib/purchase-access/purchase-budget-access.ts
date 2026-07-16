import { NextResponse } from "next/server";
import {
  isAdminEquivalentAccessLevel,
  normalizeDesignationAccessLevel,
} from "@/lib/admin-access-level";

/** Minimum access level to open Budget Control (view / monitor). */
export const PURCHASE_BUDGET_VIEW_MIN_ACCESS = 28;

/** Minimum access level to define or edit purchase budgets and budget categories. */
export const PURCHASE_BUDGET_EDIT_MIN_ACCESS = 40;

export function canViewPurchaseBudgetControl(
  level: number | string | null | undefined
): boolean {
  const n = normalizeDesignationAccessLevel(level);
  if (n == null) return false;
  if (isAdminEquivalentAccessLevel(n)) return true;
  return n >= PURCHASE_BUDGET_VIEW_MIN_ACCESS;
}

export function canEditPurchaseBudget(
  level: number | string | null | undefined
): boolean {
  const n = normalizeDesignationAccessLevel(level);
  if (n == null) return false;
  if (isAdminEquivalentAccessLevel(n)) return true;
  return n >= PURCHASE_BUDGET_EDIT_MIN_ACCESS;
}

export function purchaseBudgetViewForbiddenResponse() {
  return NextResponse.json(
    {
      error: "Forbidden",
      message: `Access level ${PURCHASE_BUDGET_VIEW_MIN_ACCESS} or higher is required to view purchase budgets`,
    },
    { status: 403 }
  );
}

export function purchaseBudgetEditForbiddenResponse() {
  return NextResponse.json(
    {
      error: "Forbidden",
      message: `Access level ${PURCHASE_BUDGET_EDIT_MIN_ACCESS} or higher is required to define or edit budgets`,
    },
    { status: 403 }
  );
}

/** Returns a 403 response if the user cannot view; otherwise null. */
export function requirePurchaseBudgetView(
  level: number | null | undefined
): NextResponse | null {
  if (!canViewPurchaseBudgetControl(level)) {
    return purchaseBudgetViewForbiddenResponse();
  }
  return null;
}

/** Returns a 403 response if the user cannot edit; otherwise null. */
export function requirePurchaseBudgetEdit(
  level: number | null | undefined
): NextResponse | null {
  if (!canEditPurchaseBudget(level)) {
    return purchaseBudgetEditForbiddenResponse();
  }
  return null;
}
