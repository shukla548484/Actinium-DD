import { prisma } from "@/lib/prisma";
import {
  recordPurchaseHistory,
  PurchaseHistoryActionType,
} from "@/lib/services/purchase-history.service";

/** Record requisition approval step in purchase history. */
export async function recordRequisitionApprovalHistory(params: {
  requisitionId: string;
  performedById: string;
  previousStatus: string;
  newStatus: string;
  description: string;
  comments?: string;
}): Promise<void> {
  await recordPurchaseHistory({
    requisitionId: params.requisitionId,
    actionType: PurchaseHistoryActionType.APPROVED,
    performedById: params.performedById,
    actionDescription: params.description,
    previousStatus: params.previousStatus,
    newStatus: params.newStatus,
    comments: params.comments,
  });
}

/** Record quote approval in purchase history. */
export async function recordQuoteApprovalHistory(params: {
  requisitionId: string;
  performedById: string;
  quoteId: string;
  quoteNumber?: string | null;
  previousRequisitionStatus: string;
}): Promise<void> {
  await recordPurchaseHistory({
    requisitionId: params.requisitionId,
    actionType: PurchaseHistoryActionType.QUOTE_APPROVED,
    performedById: params.performedById,
    actionDescription: `Quote ${params.quoteNumber ?? params.quoteId} approved`,
    previousStatus: params.previousRequisitionStatus,
    newStatus: "QUOTE_APPROVED",
    newValue: { quoteId: params.quoteId, quoteNumber: params.quoteNumber },
  });
}

/** Record quote rejection in purchase history. */
export async function recordQuoteRejectionHistory(params: {
  requisitionId: string;
  performedById: string;
  quoteId: string;
  quoteNumber?: string | null;
  reason?: string;
}): Promise<void> {
  await recordPurchaseHistory({
    requisitionId: params.requisitionId,
    actionType: PurchaseHistoryActionType.REJECTED,
    performedById: params.performedById,
    actionDescription: `Quote ${params.quoteNumber ?? params.quoteId} rejected`,
    newValue: { quoteId: params.quoteId, quoteNumber: params.quoteNumber },
    comments: params.reason,
  });
}

/** Record PO tier approval in purchase + PO history. */
export async function recordPoApprovalHistory(params: {
  purchaseOrderId: string;
  requisitionId: string;
  performedById: string;
  poNumber: string;
  approvalLevel: 1 | 2 | 3;
  comments?: string;
  allApprovalsComplete: boolean;
}): Promise<void> {
  await recordPurchaseHistory({
    requisitionId: params.requisitionId,
    actionType: PurchaseHistoryActionType.APPROVED,
    performedById: params.performedById,
    actionDescription: `PO ${params.poNumber} approved at Level ${params.approvalLevel}${params.allApprovalsComplete ? " (all levels complete)" : ""}`,
    newValue: {
      poId: params.purchaseOrderId,
      poNumber: params.poNumber,
      approvalLevel: params.approvalLevel,
      allApprovalsComplete: params.allApprovalsComplete,
    },
    comments: params.comments,
  });

  await prisma.purchaseOrderHistory.create({
    data: {
      purchaseOrderId: params.purchaseOrderId,
      actionType: "STATUS_CHANGED",
      actionDescription: `Approved at Level ${params.approvalLevel}${params.allApprovalsComplete ? " — ready to send" : ""}`,
      performedById: params.performedById,
      newValue: JSON.stringify({
        approvalLevel: params.approvalLevel,
        allApprovalsComplete: params.allApprovalsComplete,
      }),
      comments: params.comments ?? null,
    },
  });
}

/** Record PO tier rejection in purchase + PO history. */
export async function recordPoRejectionHistory(params: {
  purchaseOrderId: string;
  requisitionId: string;
  performedById: string;
  poNumber: string;
  rejectedLevel: 1 | 2 | 3;
  previousWorkflowStatus: string;
  newWorkflowStatus: string;
  comments: string;
  quoteId?: string | null;
}): Promise<void> {
  await recordPurchaseHistory({
    requisitionId: params.requisitionId,
    actionType: PurchaseHistoryActionType.REJECTED,
    performedById: params.performedById,
    actionDescription: `PO ${params.poNumber} rejected at Level ${params.rejectedLevel}`,
    previousStatus: params.previousWorkflowStatus,
    newStatus: params.newWorkflowStatus,
    newValue: {
      poId: params.purchaseOrderId,
      poNumber: params.poNumber,
      rejectedLevel: params.rejectedLevel,
      ...(params.quoteId ? { quoteId: params.quoteId } : {}),
    },
    comments: params.comments,
  });

  await prisma.purchaseOrderHistory.create({
    data: {
      purchaseOrderId: params.purchaseOrderId,
      actionType: "REJECTED",
      actionDescription: `Rejected at Level ${params.rejectedLevel}`,
      previousStatus: params.previousWorkflowStatus,
      newStatus: params.newWorkflowStatus,
      performedById: params.performedById,
      comments: params.comments,
    },
  }).catch(async () => {
    await prisma.purchaseOrderHistory.create({
      data: {
        purchaseOrderId: params.purchaseOrderId,
        actionType: "STATUS_CHANGED",
        actionDescription: `Rejected at Level ${params.rejectedLevel}`,
        previousStatus: params.previousWorkflowStatus,
        newStatus: params.newWorkflowStatus,
        performedById: params.performedById,
        comments: params.comments,
      },
    });
  });
}

/** Record PO cancellation in both histories. */
export async function recordPoCancellationHistory(params: {
  purchaseOrderId: string;
  requisitionId: string;
  performedById: string;
  poNumber: string;
  previousStatus: string;
  comments: string;
}): Promise<void> {
  await recordPurchaseHistory({
    requisitionId: params.requisitionId,
    actionType: PurchaseHistoryActionType.CANCELLED,
    performedById: params.performedById,
    actionDescription: `PO ${params.poNumber} cancelled`,
    previousStatus: params.previousStatus,
    newStatus: "CANCELLED",
    comments: params.comments,
  });
}
