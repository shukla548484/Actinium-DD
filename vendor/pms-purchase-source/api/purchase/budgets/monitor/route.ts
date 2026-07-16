import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { parsePurchaseBudgetScope, PURCHASE_BUDGET_SCOPE } from "@/lib/purchase-budget-scope";
import { requireBudgetViewForContext } from "@/lib/drydock-budget-access";
import { serializePrismaError } from "@/lib/prisma-error-utils";
import {
  loadPurchaseBudgetMonitorPayload,
  parseMonitorQueryFromSearchParams,
} from "@/lib/purchase-budget-monitor-load";

// GET /api/purchase/budgets/monitor - Budget monitoring with vs-actual rollup
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dryDockProjectId = searchParams.get("dryDockProjectId");
    const budgetScope = parsePurchaseBudgetScope(searchParams.get("budgetScope"));
    const dryDockContext =
      Boolean(dryDockProjectId) || budgetScope === PURCHASE_BUDGET_SCOPE.DRY_DOCK;

    const viewDenied = requireBudgetViewForContext(user, dryDockContext);
    if (viewDenied) return viewDenied;

    const payload = await loadPurchaseBudgetMonitorPayload(
      parseMonitorQueryFromSearchParams(searchParams)
    );

    return NextResponse.json({
      budgets: payload.budgets,
      stats: payload.stats,
      budgetVsActualL1: payload.budgetVsActualL1,
      monthlyBreakdown: payload.monthlyBreakdown,
      ytdMetrics: payload.ytdMetrics,
      actualsSource: payload.actualsSource,
      periodLabel: payload.periodLabel,
    });
  } catch (error: unknown) {
    const details = serializePrismaError(error);
    console.error("Error fetching budget monitoring data:", details);
    return NextResponse.json(
      {
        error: "Failed to fetch budget monitoring data",
        details: details.message,
        ...(process.env.NODE_ENV !== "production" && details.hint ? { hint: details.hint } : {}),
      },
      { status: 500 }
    );
  }
}
