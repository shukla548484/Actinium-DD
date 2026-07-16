import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import {
  canViewPoBudgetChangePage,
} from "@/lib/purchase/po-budget-change-access";
import {
  createPoBudgetChangeRequest,
  listPoBudgetChangeRequests,
} from "@/lib/purchase/po-budget-change.service";
import {
  notifyPoBudgetChangePending,
} from "@/lib/procurement/approval-notifications";

export const dynamic = "force-dynamic";

/** GET /api/purchase/po-budget-change — list budget change requests */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessLevel = user.designationAccessLevel ?? 0;
    if (!canViewPoBudgetChangePage(accessLevel)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const purchaseOrderId = searchParams.get("purchaseOrderId") ?? undefined;

    const result = await listPoBudgetChangeRequests({
      accessLevel,
      userId: user.id,
      status,
      purchaseOrderId,
    });

    return NextResponse.json({
      success: true,
      ...result,
      currentUserAccessLevel: accessLevel,
    });
  } catch (error) {
    console.error("[po-budget-change GET]", error);
    const message = error instanceof Error ? error.message : "Failed to list requests";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/purchase/po-budget-change — submit budget change request */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessLevel = user.designationAccessLevel ?? 0;
    const body = await request.json();
    const purchaseOrderId = String(body.purchaseOrderId || "").trim();
    const requestedIsBudgeted = body.requestedIsBudgeted === true;
    const reason = body.reason != null ? String(body.reason) : undefined;

    if (!purchaseOrderId) {
      return NextResponse.json({ error: "purchaseOrderId is required" }, { status: 400 });
    }
    if (body.requestedIsBudgeted !== true && body.requestedIsBudgeted !== false) {
      return NextResponse.json(
        { error: "requestedIsBudgeted must be true (Budgeted) or false (Un-Budgeted)" },
        { status: 400 }
      );
    }

    const created = await createPoBudgetChangeRequest({
      purchaseOrderId,
      requestedIsBudgeted,
      reason,
      requestedById: user.id,
      accessLevel,
    });

    try {
      await notifyPoBudgetChangePending({
        request,
        actorUserId: user.id,
        requestId: created.id,
        purchaseOrderId: created.purchaseOrderId,
        purchaseOrderNumber: created.poNumber,
        requisitionNumber: created.requisitionNumber,
        vesselId: created.vessel.id,
        currentIsBudgeted: created.currentIsBudgeted,
        requestedIsBudgeted: created.requestedIsBudgeted,
      });
    } catch (notifyError) {
      console.error("[po-budget-change POST] notification:", notifyError);
    }

    return NextResponse.json({ success: true, request: created });
  } catch (error) {
    console.error("[po-budget-change POST]", error);
    const message = error instanceof Error ? error.message : "Failed to create request";
    const status = message.includes("permission") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
