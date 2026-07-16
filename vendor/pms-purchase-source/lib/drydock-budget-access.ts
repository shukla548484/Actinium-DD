import { NextResponse } from "next/server";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import {
  canEditPurchaseBudget,
  canViewPurchaseBudgetControl,
  requirePurchaseBudgetEdit,
  requirePurchaseBudgetView,
} from "@/lib/purchase-budget-access";

export const DRY_DOCK_MODULE_NAME = "Dry Dock";

type UserWithModules = {
  designationAccessLevel?: number | null;
  assignedModules?: Array<{ module?: { name?: string } }> | null;
};

export function hasDryDockModuleAccess(user: UserWithModules | null | undefined): boolean {
  if (!user) return false;
  if (isAdminEquivalentAccessLevel(user.designationAccessLevel ?? undefined)) return true;
  const modules = user.assignedModules;
  if (!Array.isArray(modules)) return false;
  return modules.some((m) => m?.module?.name === DRY_DOCK_MODULE_NAME);
}

export function canViewDryDockBudgetControl(
  user: UserWithModules | null | undefined
): boolean {
  if (!user) return false;
  return (
    canViewPurchaseBudgetControl(user.designationAccessLevel) ||
    hasDryDockModuleAccess(user)
  );
}

export function canEditDryDockBudget(user: UserWithModules | null | undefined): boolean {
  if (!user) return false;
  return (
    canEditPurchaseBudget(user.designationAccessLevel) || hasDryDockModuleAccess(user)
  );
}

export function dryDockBudgetViewForbiddenResponse() {
  return NextResponse.json(
    {
      error: "Forbidden",
      message: "Dry Dock module access or purchase budget view permission is required",
    },
    { status: 403 }
  );
}

export function dryDockBudgetEditForbiddenResponse() {
  return NextResponse.json(
    {
      error: "Forbidden",
      message: "Dry Dock module access or purchase budget edit permission is required",
    },
    { status: 403 }
  );
}

export function requireDryDockBudgetView(
  user: UserWithModules | null | undefined
): NextResponse | null {
  if (!canViewDryDockBudgetControl(user)) return dryDockBudgetViewForbiddenResponse();
  return null;
}

export function requireDryDockBudgetEdit(
  user: UserWithModules | null | undefined
): NextResponse | null {
  if (!canEditDryDockBudget(user)) return dryDockBudgetEditForbiddenResponse();
  return null;
}

/** Route guard: dry dock project budgets vs normal purchase budgets. */
export function requireBudgetViewForContext(
  user: UserWithModules | null | undefined,
  dryDockContext: boolean
): NextResponse | null {
  if (dryDockContext) return requireDryDockBudgetView(user);
  return requirePurchaseBudgetView(user?.designationAccessLevel);
}

export function requireBudgetEditForContext(
  user: UserWithModules | null | undefined,
  dryDockContext: boolean
): NextResponse | null {
  if (dryDockContext) return requireDryDockBudgetEdit(user);
  return requirePurchaseBudgetEdit(user?.designationAccessLevel);
}
