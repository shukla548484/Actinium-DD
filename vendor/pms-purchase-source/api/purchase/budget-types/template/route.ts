import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { generateBudgetTypeTemplate } from "@/lib/excel-budget-type-utils";
import { parsePurchaseBudgetScope, PURCHASE_BUDGET_SCOPE } from "@/lib/purchase-budget-scope";
import { requireBudgetViewForContext } from "@/lib/drydock-budget-access";

/**
 * GET /api/purchase/budget-types/template - Download budget types Excel template
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const budgetScope = parsePurchaseBudgetScope(searchParams.get("budgetScope"));
    const viewDenied = requireBudgetViewForContext(
      user,
      budgetScope === PURCHASE_BUDGET_SCOPE.DRY_DOCK
    );
    if (viewDenied) return viewDenied;
    const buffer = await generateBudgetTypeTemplate(budgetScope);
    const filename =
      budgetScope === "DRY_DOCK"
        ? "dry-dock-budget-categories-template.xlsx"
        : "purchase-budget-categories-template.xlsx";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Error generating budget types template:", error);
    return NextResponse.json(
      { error: "Failed to generate template", details: error?.message },
      { status: 500 }
    );
  }
}
