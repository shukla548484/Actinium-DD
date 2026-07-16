import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { parsePurchaseBudgetScope, PURCHASE_BUDGET_SCOPE } from "@/lib/purchase-budget-scope";
import { requireBudgetViewForContext } from "@/lib/drydock-budget-access";
import { serializePrismaError } from "@/lib/prisma-error-utils";
import { listPurchaseBudgetVersions } from "@/lib/purchase-budget-version";

export const dynamic = "force-dynamic";

// GET /api/purchase/budgets/versions
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const vesselId = searchParams.get("vesselId");
    if (!vesselId) {
      return NextResponse.json({ error: "vesselId is required" }, { status: 400 });
    }

    const dryDockProjectId = searchParams.get("dryDockProjectId");
    const budgetScope = parsePurchaseBudgetScope(searchParams.get("budgetScope"));
    const viewDenied = requireBudgetViewForContext(
      user,
      Boolean(dryDockProjectId) || budgetScope === PURCHASE_BUDGET_SCOPE.DRY_DOCK
    );
    if (viewDenied) return viewDenied;

    const budgetPeriodCode = searchParams.get("budgetPeriodCode");
    const versions = await listPurchaseBudgetVersions({
      vesselId,
      budgetPeriodCode,
    });

    return NextResponse.json({ versions });
  } catch (error: unknown) {
    const details = serializePrismaError(error);
    console.error("Error fetching budget versions:", details);
    return NextResponse.json(
      { error: "Failed to fetch budget versions", details: details.message },
      { status: 500 }
    );
  }
}
