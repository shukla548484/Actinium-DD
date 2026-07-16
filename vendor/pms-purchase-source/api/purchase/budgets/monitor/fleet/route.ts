import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { parsePurchaseBudgetScope, PURCHASE_BUDGET_SCOPE } from "@/lib/purchase-budget-scope";
import { requireBudgetViewForContext } from "@/lib/drydock-budget-access";
import { serializePrismaError } from "@/lib/prisma-error-utils";
import { parseMonitorQueryFromSearchParams } from "@/lib/purchase-budget-monitor-load";
import { loadFleetBudgetMonitorPayload } from "@/lib/purchase-budget-monitor-fleet";
import { BASE_CURRENCY } from "@/lib/utils/currency-shared";

export const dynamic = "force-dynamic";

// GET /api/purchase/budgets/monitor/fleet — fleet rollup with FX conversion
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

    const displayCurrency = (searchParams.get("displayCurrency") ?? BASE_CURRENCY).toUpperCase();
    const vesselIdFilter = searchParams.get("vesselId");

    const companyId =
      user.companyId ??
      (user as { company?: { id?: string } }).company?.id ??
      null;

    const vesselWhere: { isActive: boolean; companyId?: string; id?: string } = {
      isActive: true,
    };
    if (companyId) vesselWhere.companyId = companyId;
    if (vesselIdFilter && vesselIdFilter !== "all") vesselWhere.id = vesselIdFilter;

    const vesselRows = await prisma.vessel.findMany({
      where: vesselWhere,
      select: { id: true },
      orderBy: { name: "asc" },
      take: 50,
    });

    const query = parseMonitorQueryFromSearchParams(searchParams);
    const { vesselId: _v, ...restQuery } = query;

    const payload = await loadFleetBudgetMonitorPayload({
      vesselIds: vesselRows.map((v) => v.id),
      query: restQuery,
      displayCurrency,
    });

    return NextResponse.json(payload);
  } catch (error: unknown) {
    const details = serializePrismaError(error);
    console.error("Error fetching fleet budget monitor:", details);
    return NextResponse.json(
      { error: "Failed to fetch fleet budget monitor", details: details.message },
      { status: 500 }
    );
  }
}
