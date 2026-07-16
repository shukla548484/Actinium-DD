import { prisma } from "@/lib/prisma";
import { getPoApprovalPolicy } from "@/lib/services/po-approval-policy.service";
import { PurchaseOrderWorkflowStatus } from "@/lib/types/purchase-order-workflow";

const PENDING_WORKFLOW_STATUSES = [
  PurchaseOrderWorkflowStatus.PO_CREATED,
  PurchaseOrderWorkflowStatus.PO_LVL1_APPROVAL,
  PurchaseOrderWorkflowStatus.PO_LVL2_APPROVAL,
  PurchaseOrderWorkflowStatus.PO_LVL3_APPROVAL,
] as const;

/** Goods POs with pending tier approval (mirrors freight-approvals). */
export async function listGoodsPosPendingApproval() {
  const rows = await prisma.purchaseOrder.findMany({
    where: {
      poType: "GOODS",
      status: "ACTIVE",
      workflowStatus: {
        in: [...PENDING_WORKFLOW_STATUSES],
      },
    },
    orderBy: { dateOfIssue: "desc" },
    select: {
      id: true,
      poNumber: true,
      poType: true,
      quoteId: true,
      totalAmount: true,
      currency: true,
      dateOfIssue: true,
      workflowStatus: true,
      levelOneApprovedAt: true,
      levelTwoApprovedAt: true,
      levelThreeApprovedAt: true,
      requisition: {
        select: {
          id: true,
          requisitionNumber: true,
          heading: true,
          vesselId: true,
          vessel: { select: { id: true, name: true, code: true, companyId: true } },
        },
      },
      quote: {
        select: {
          vendor: { select: { id: true, name: true } },
        },
      },
    },
  });

  const pending: typeof rows = [];

  for (const po of rows) {
    const amt = po.totalAmount ? Number(po.totalAmount) : 0;
    const companyId = po.requisition?.vessel?.companyId ?? null;
    const vesselId = po.requisition?.vesselId ?? null;
    const policy = await getPoApprovalPolicy(companyId, vesselId);

    if (amt < policy.thresholdLevel2) continue;

    const needsL1 = !po.levelOneApprovedAt;
    const needsL2 = po.levelOneApprovedAt && !po.levelTwoApprovedAt;
    const needsL3 =
      amt >= policy.thresholdLevel3 &&
      po.levelTwoApprovedAt &&
      !po.levelThreeApprovedAt;

    if (needsL1 || needsL2 || needsL3) {
      pending.push(po);
    }
  }

  return pending;
}
