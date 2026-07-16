import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { approvePoBudgetChangeRequest } from "@/lib/purchase/po-budget-change.service";
import { notifyPoBudgetChangeResolved } from "@/lib/procurement/approval-notifications";

export const dynamic = "force-dynamic";

/** POST /api/purchase/po-budget-change/[id]/approve */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reviewComments =
      body.reviewComments != null ? String(body.reviewComments) : undefined;

    const updated = await approvePoBudgetChangeRequest({
      requestId: id,
      reviewedById: user.id,
      accessLevel: user.designationAccessLevel ?? 0,
      reviewComments,
    });

    try {
      await notifyPoBudgetChangeResolved({
        request,
        actorUserId: user.id,
        requestId: updated.id,
        purchaseOrderId: updated.purchaseOrderId,
        purchaseOrderNumber: updated.poNumber,
        requisitionNumber: updated.requisitionNumber,
        vesselId: updated.vessel.id,
        requestedById: updated.requestedBy.id,
        approved: true,
        requestedIsBudgeted: updated.requestedIsBudgeted,
      });
    } catch (notifyError) {
      console.error("[po-budget-change approve] notification:", notifyError);
    }

    return NextResponse.json({ success: true, request: updated });
  } catch (error) {
    console.error("[po-budget-change approve]", error);
    const message = error instanceof Error ? error.message : "Failed to approve request";
    const status = message.includes("permission") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
