import { prisma } from "@/lib/prisma";
import { RequisitionStatus } from "@/lib/types/requisition";
import {
  recordPurchaseHistory,
  PurchaseHistoryActionType,
} from "@/lib/services/purchase-history.service";
import { PurchaseOrderWorkflowStatus } from "@/lib/types/purchase-order-workflow";

/**
 * After a pre-send PO is purged/cancelled, roll requisition status back so purchasers
 * can create a new PO from the same approved quote (supports multiple reject/create cycles).
 */
export async function reconcileRequisitionAfterPoRemoval(params: {
  requisitionId: string;
  performedById: string;
  reason?: string;
}): Promise<{ updated: boolean; previousStatus?: string; newStatus?: string }> {
  const requisition = await prisma.requisition.findUnique({
    where: { id: params.requisitionId },
    select: {
      id: true,
      requisitionNumber: true,
      status: true,
      vendorQuotes: {
        where: { status: "APPROVED" },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!requisition) {
    return { updated: false };
  }

  const [activePos, sentPo] = await Promise.all([
    prisma.purchaseOrder.count({
      where: {
        requisitionId: params.requisitionId,
        status: "ACTIVE",
      },
    }),
    prisma.purchaseOrder.findFirst({
      where: {
        requisitionId: params.requisitionId,
        workflowStatus: PurchaseOrderWorkflowStatus.PO_SENT,
      },
      select: { id: true },
    }),
  ]);

  if (activePos > 0 || sentPo) {
    return { updated: false };
  }

  if (requisition.vendorQuotes.length === 0) {
    return { updated: false };
  }

  const revertStatuses = new Set<string>([
    RequisitionStatus.QUOTE_CONFIRMED_PO_SENT,
  ]);

  if (!revertStatuses.has(requisition.status)) {
    return { updated: false };
  }

  const previousStatus = requisition.status;
  const newStatus = RequisitionStatus.QUOTE_APPROVED;

  await prisma.requisition.update({
    where: { id: params.requisitionId },
    data: {
      status: newStatus,
      isEditable: true,
    },
  });

  await recordPurchaseHistory({
    requisitionId: params.requisitionId,
    actionType: PurchaseHistoryActionType.STATUS_CHANGED,
    performedById: params.performedById,
    actionDescription: `Requisition status restored to ${newStatus} after purchase order removal`,
    previousStatus,
    newStatus,
    comments: params.reason,
  });

  return { updated: true, previousStatus, newStatus };
}
