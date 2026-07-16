import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { canManageFreight } from "@/lib/freight/constants";
import { listFreightPosPendingApproval } from "@/lib/freight/freight-service";
import { getPoApprovalPolicy } from "@/lib/services/po-approval-policy.service";

export const dynamic = "force-dynamic";

/** GET /api/purchase/freight-approvals — FRT POs needing approval (same thresholds as goods) */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessLevel = user.designationAccessLevel ?? 0;
    const rows = await listFreightPosPendingApproval();

    const enriched = await Promise.all(
      rows.map(async (po) => {
        const amt = po.totalAmount ? Number(po.totalAmount) : 0;
        const companyId = po.requisition?.vessel?.companyId ?? null;
        const vesselId = po.requisition?.vessel?.id ?? null;
        const policy = await getPoApprovalPolicy(companyId, vesselId);
        return {
          id: po.id,
          poNumber: po.poNumber,
          poType: po.poType,
          parentPoNumber: po.parentPurchaseOrder?.poNumber ?? null,
          totalAmount: amt,
          currency: po.currency,
          dateOfIssue: po.dateOfIssue,
          levelOneApprovedAt: po.levelOneApprovedAt,
          levelTwoApprovedAt: po.levelTwoApprovedAt,
          levelThreeApprovedAt: po.levelThreeApprovedAt,
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
    console.error("[freight-approvals GET]", error);
    const message = error instanceof Error ? error.message : "Failed to list freight PO approvals";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
