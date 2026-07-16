import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { requireBudgetViewForContext } from "@/lib/drydock-budget-access";
import { listPurchaseBudgetDeclarations } from "@/lib/purchase-budget-declarations";
import { parsePurchaseBudgetScope, PURCHASE_BUDGET_SCOPE } from "@/lib/purchase-budget-scope";

export const dynamic = "force-dynamic";

/** GET /api/purchase/budgets/declarations?vesselId=&budgetScope=&dryDockProjectId= */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vesselId = searchParams.get("vesselId")?.trim();
    if (!vesselId) {
      return NextResponse.json({ error: "vesselId is required" }, { status: 400 });
    }

    const budgetScope = parsePurchaseBudgetScope(searchParams.get("budgetScope"));
    const dryDockProjectId = searchParams.get("dryDockProjectId")?.trim() || null;
    const dryDockContext =
      Boolean(dryDockProjectId) || budgetScope === PURCHASE_BUDGET_SCOPE.DRY_DOCK;

    const viewDenied = requireBudgetViewForContext(user, dryDockContext);
    if (viewDenied) return viewDenied;

    const declarations = await listPurchaseBudgetDeclarations({
      vesselId,
      budgetScope,
      dryDockProjectId,
    });

    return NextResponse.json({ declarations });
  } catch (error: unknown) {
    console.error("Error listing budget declarations:", error);
    const message = error instanceof Error ? error.message : "Unknown";
    return NextResponse.json(
      { error: "Failed to list budget declarations", details: message },
      { status: 500 }
    );
  }
}
