import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { parsePurchaseBudgetScope, PURCHASE_BUDGET_SCOPE, PURCHASE_BUDGET_SCOPE_LABELS } from "@/lib/purchase-budget-scope";
import { requireBudgetViewForContext } from "@/lib/drydock-budget-access";
import { serializePrismaError } from "@/lib/prisma-error-utils";
import {
  loadPurchaseBudgetMonitorPayload,
  parseMonitorQueryFromSearchParams,
} from "@/lib/purchase-budget-monitor-load";
import { generateBudgetMonitorExcelBuffer } from "@/lib/excel-budget-monitor-export";

export const dynamic = "force-dynamic";

// GET /api/purchase/budgets/monitor/export — Excel export for monitor tab
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vesselId = searchParams.get("vesselId");
    if (!vesselId) {
      return NextResponse.json({ error: "vesselId is required" }, { status: 400 });
    }

    const dryDockProjectId = searchParams.get("dryDockProjectId");
    const budgetScope = parsePurchaseBudgetScope(searchParams.get("budgetScope"));
    const dryDockContext =
      Boolean(dryDockProjectId) || budgetScope === PURCHASE_BUDGET_SCOPE.DRY_DOCK;
    const viewDenied = requireBudgetViewForContext(user, dryDockContext);
    if (viewDenied) return viewDenied;

    const vessel = await prisma.vessel.findUnique({
      where: { id: vesselId },
      select: { name: true, code: true },
    });
    if (!vessel) {
      return NextResponse.json({ error: "Vessel not found" }, { status: 404 });
    }

    const payload = await loadPurchaseBudgetMonitorPayload(
      parseMonitorQueryFromSearchParams(searchParams)
    );

    const buffer = await generateBudgetMonitorExcelBuffer(payload, {
      vesselName: vessel.name,
      vesselCode: vessel.code ?? vesselId.slice(0, 8),
      budgetScopeLabel: PURCHASE_BUDGET_SCOPE_LABELS[budgetScope],
      actualsSourceLabel: payload.actualsSource === "invoice" ? "Invoices" : "Purchase orders",
    });

    const filename = `Budget_Monitor_${vessel.code ?? "vessel"}_${payload.periodLabel.replace(/\s+/g, "_")}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    const details = serializePrismaError(error);
    console.error("Error exporting budget monitor:", details);
    return NextResponse.json(
      { error: "Failed to export budget monitor", details: details.message },
      { status: 500 }
    );
  }
}
