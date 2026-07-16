import { NextRequest, NextResponse } from "next/server";
import { getSessionPrincipalFromRequest } from "@/lib/session";
import { resolveRequisitionBudgetCode } from "@/lib/purchase-budget-resolve";
import { parsePurchaseBudgetScope } from "@/lib/purchase-budget-scope";

export const dynamic = "force-dynamic";

/** GET /api/purchase/budget-categories/resolve?requisitionType=STR&requisitionPurpose=... */
export async function GET(request: NextRequest) {
  const started = Date.now();
  try {
    const principal = await getSessionPrincipalFromRequest(request);
    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requisitionType = searchParams.get("requisitionType");
    const requisitionPurpose = searchParams.get("requisitionPurpose");
    const explicitBudgetCode = searchParams.get("budgetCode");
    const subCategoryCode = searchParams.get("subCategoryCode");

    if (!requisitionType) {
      return NextResponse.json({ error: "requisitionType is required" }, { status: 400 });
    }

    const budgetScopeParam = searchParams.get("budgetScope");
    const resolved = await resolveRequisitionBudgetCode({
      requisitionType,
      requisitionPurpose,
      explicitBudgetCode,
      subCategoryCode,
      budgetScope: budgetScopeParam
        ? parsePurchaseBudgetScope(budgetScopeParam)
        : undefined,
    });

    return NextResponse.json(resolved, {
      headers: { "X-Response-Time-Ms": String(Date.now() - started) },
    });
  } catch (error: unknown) {
    console.error("Error resolving budget code:", error);
    return NextResponse.json(
      { error: "Failed to resolve budget code", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
