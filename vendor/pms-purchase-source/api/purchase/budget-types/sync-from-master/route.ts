import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { syncPurchaseBudgetTypesFromMaster } from "@/lib/purchase-budget-sync-from-master";
import { parsePurchaseBudgetScope, PURCHASE_BUDGET_SCOPE } from "@/lib/purchase-budget-scope";
import { requireBudgetEditForContext } from "@/lib/drydock-budget-access";

/**
 * POST /api/purchase/budget-types/sync-from-master
 * Body: { companyId: string }
 * Copies global master categories into company purchase_budget_types.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const companyId = String(body.companyId ?? "").trim();
    const budgetScope = parsePurchaseBudgetScope(body.budgetScope);
    const editDenied = requireBudgetEditForContext(
      user,
      budgetScope === PURCHASE_BUDGET_SCOPE.DRY_DOCK
    );
    if (editDenied) return editDenied;
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    const result = await syncPurchaseBudgetTypesFromMaster(companyId, user.id, budgetScope);

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error("Error syncing budget types from master:", error);
    return NextResponse.json(
      { error: "Failed to sync budget categories", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
