import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { listGoodsPosPendingApproval } from "@/lib/procurement/goods-po-approvals";
import { getPoApprovalPolicy } from "@/lib/services/po-approval-policy.service";

export const dynamic = "force-dynamic";

/** GET /api/purchase/po-approvals — Goods POs needing tier approval for current user */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessLevel = user.designationAccessLevel ?? 0;
    const rows = await listGoodsPosPendingApproval();

    const enriched = await Promise.all(
      rows.map(async (po) => {
        const amt = po.totalAmount ? Number(po.totalAmount) : 0;
        const companyId = po.requisition?.vessel?.companyId ?? null;
        const vesselId = po.requisition?.vesselId ?? null;
        const policy = await getPoApprovalPolicy(companyId, vesselId);
        return {
          id: po.id,
          poNumber: po.poNumber,
          poType: po.poType,
          totalAmount: amt,
          currency: po.currency,
          dateOfIssue: po.dateOfIssue,
          levelOneApprovedAt: po.levelOneApprovedAt,
          levelTwoApprovedAt: po.levelTwoApprovedAt,
          levelThreeApprovedAt: po.levelThreeApprovedAt,
          workflowStatus: po.workflowStatus,
          quoteId: po.quoteId,
          requisition: po.requisition,
          vendor: po.quote?.vendor,
          requiresApproval: amt >= policy.thresholdLevel2,
          requiresThreeApprovals: amt >= policy.thresholdLevel3,
          policy,
        };
      })
    );

    const pendingForUser = enriched.filter((po) => {
      if (!po.requiresApproval) return false;
      const p = po.policy;
      if (p.level1AccessLevels.includes(accessLevel) && !po.levelOneApprovedAt) return true;
      if (
        p.level2AccessLevels.includes(accessLevel) &&
        po.levelOneApprovedAt &&
        !po.levelTwoApprovedAt
      ) {
        return true;
      }
      if (
        po.requiresThreeApprovals &&
        p.level3AccessLevels.includes(accessLevel) &&
        po.levelTwoApprovedAt &&
        !po.levelThreeApprovedAt
      ) {
        return true;
      }
      return false;
    });

    return NextResponse.json({
      success: true,
      purchaseOrders: pendingForUser,
      count: pendingForUser.length,
      currentUserAccessLevel: accessLevel,
    });
  } catch (error) {
    console.error("[po-approvals GET]", error);
    const message = error instanceof Error ? error.message : "Failed to list PO approvals";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
