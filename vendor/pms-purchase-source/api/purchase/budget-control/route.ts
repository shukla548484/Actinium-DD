import { NextRequest, NextResponse } from "next/server";

/**
 * @deprecated Legacy route used MaintenanceBudget — not purchase L1/L2 declarations.
 * Use GET /api/purchase/budgets/monitor and Purchase → Budget Control instead.
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      deprecated: true,
      error:
        "This endpoint is deprecated. Use GET /api/purchase/budgets/monitor for purchase budget monitoring.",
      replacement: "/api/purchase/budgets/monitor",
      ui: "/purchase/budget-control?tab=monitor",
    },
    { status: 410 }
  );
}
