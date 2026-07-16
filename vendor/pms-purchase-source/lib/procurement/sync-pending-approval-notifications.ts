import { prisma } from "@/lib/prisma";
import { GenerationStatus, RequisitionStatus } from "@/lib/types/requisition";
import { getPoApprovalPolicy } from "@/lib/services/po-approval-policy.service";
import { getInvoiceApprovalLevels } from "@/lib/services/invoice-approval-config.service";
import { listGoodsPosPendingApproval } from "@/lib/procurement/goods-po-approvals";
import {
  resolveNextPoApproverLevels,
  resolveNextInvoiceApproverLevels,
  invoicePendingLevelNumber,
  PURCHASER_ACCESS_LEVELS,
  QUOTE_APPROVER_ACCESS_LEVELS,
  REQ_SHORE_APPROVER_ACCESS_LEVELS,
} from "@/lib/procurement/approval-notifications";
import { createProcurementTaskNotifications } from "@/lib/procurement/procurement-task-notification";
import { PurchaseOrderWorkflowStatus } from "@/lib/types/purchase-order-workflow";
import {
  resolveWorkflowStatusAfterApproval,
} from "@/lib/services/po-workflow-status.service";
import { quoteCreatePoUrl, quoteSendPoUrl } from "@/lib/procurement/quote-po-navigation";
import { PurchaseHistoryActionType } from "@/lib/services/purchase-history.service";
import { buildInvoiceVerificationUrl } from "@/lib/purchase/invoice-verification-url";
import { parseTierLevelFromDedupeKey } from "@/lib/notifications/task-dedupe";

function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://www.actinium-sm.org";
}

function parsePurchaseHistoryNewValue(
  raw: string | null | undefined
): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export type SyncPendingNotificationsResult = {
  requisitions: number;
  quotes: number;
  purchaseOrders: number;
  invoices: number;
  repairedPoApprovalMetadata: number;
  totalCreated: number;
};

/** Fix PO_APPROVAL_PENDING rows where dedupeKey tier disagrees with metadata.approvalLevel. */
async function repairMislabeledPoApprovalNotificationMetadata(): Promise<number> {
  const rows = await prisma.operationNotification.findMany({
    where: {
      operation: "PO_APPROVAL_PENDING",
      type: "TASK_ASSIGNED",
    },
    select: { id: true, metadata: true },
    take: 500,
    orderBy: { createdAt: "desc" },
  });

  let repaired = 0;
  for (const row of rows) {
    const meta = (row.metadata as Record<string, unknown> | null) ?? {};
    const dedupeKey = typeof meta.dedupeKey === "string" ? meta.dedupeKey : "";
    const levelFromDedupe = parseTierLevelFromDedupeKey(dedupeKey);
    if (levelFromDedupe == null) continue;
    if (meta.approvalLevel === levelFromDedupe) continue;

    await prisma.operationNotification.update({
      where: { id: row.id },
      data: {
        metadata: {
          ...meta,
          approvalLevel: levelFromDedupe,
        },
      },
    });
    repaired += 1;
  }
  return repaired;
}

/**
 * Backfill TASK_ASSIGNED notifications for requisitions, quotes, POs, and invoices
 * stuck waiting for the next approval/action phase. Idempotent (deduped per user).
 */
export async function syncPendingProcurementNotifications(options?: {
  limitPerCategory?: number;
}): Promise<SyncPendingNotificationsResult> {
  const limit = options?.limitPerCategory ?? 150;
  let requisitions = 0;
  let quotes = 0;
  let purchaseOrders = 0;
  let invoices = 0;
  const repairedPoApprovalMetadata = await repairMislabeledPoApprovalNotificationMetadata();

  // —— Requisitions awaiting shore approval ——
  const pendingReqs = await prisma.requisition.findMany({
    where: {
      OR: [
        {
          generationStatus: GenerationStatus.CREATED,
          status: RequisitionStatus.NOT_READY,
        },
        { status: RequisitionStatus.NEW_REQ },
        { status: RequisitionStatus.REQ_APPROVED },
      ],
    },
    include: {
      vessel: { select: { id: true, companyId: true } },
      vendorQuotes: { where: { status: "RECEIVED" }, select: { id: true }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  for (const req of pendingReqs) {
    const vesselId = req.vesselId;
    const companyId = req.vessel?.companyId ?? null;
    const base = appBaseUrl();

    if (
      req.generationStatus === GenerationStatus.CREATED &&
      req.status === RequisitionStatus.NOT_READY
    ) {
      requisitions += await createProcurementTaskNotifications({
        operation: "REQ_APPROVAL_PENDING",
        dedupeKey: `req:${req.id}:not_ready`,
        actionUrl: `${base}/purchase/requisitions/${req.id}/approve?from=notification`,
        targetAccessLevels: [...REQ_SHORE_APPROVER_ACCESS_LEVELS],
        vesselId,
        companyId,
        entityId: req.id,
        metadata: { requisitionId: req.id, requisitionNumber: req.requisitionNumber, stage: "NOT_READY" },
      });
    } else if (req.status === RequisitionStatus.NEW_REQ) {
      requisitions += await createProcurementTaskNotifications({
        operation: "REQ_APPROVAL_PENDING",
        dedupeKey: `req:${req.id}:new_req`,
        actionUrl: `${base}/purchase/view-requisitions?req=${encodeURIComponent(req.requisitionNumber)}&from=notification`,
        targetAccessLevels: [...REQ_SHORE_APPROVER_ACCESS_LEVELS],
        vesselId,
        companyId,
        entityId: req.id,
        metadata: { requisitionId: req.id, requisitionNumber: req.requisitionNumber, stage: "NEW_REQ" },
      });
    } else if (req.status === RequisitionStatus.REQ_APPROVED) {
      requisitions += await createProcurementTaskNotifications({
        operation: "APPROVE_REQUISITION",
        dedupeKey: `req:${req.id}:send_quote`,
        actionUrl: `${base}/purchase/view-requisitions?req=${encodeURIComponent(req.requisitionNumber)}&from=notification`,
        targetAccessLevels: [...PURCHASER_ACCESS_LEVELS],
        vesselId,
        companyId,
        entityId: req.id,
        metadata: { requisitionId: req.id, requisitionNumber: req.requisitionNumber, action: "send_for_quote" },
      });
    }
  }

  // —— Quotes received, awaiting approval ——
  const pendingQuotes = await prisma.vendorQuote.findMany({
    where: { status: "RECEIVED" },
    include: {
      requisition: {
        select: {
          id: true,
          requisitionNumber: true,
          vesselId: true,
          vessel: { select: { companyId: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  for (const quote of pendingQuotes) {
    if (!quote.requisition) continue;
    quotes += await createProcurementTaskNotifications({
      operation: "CREATE_QUOTE",
      dedupeKey: `quote:${quote.id}:approve`,
      actionUrl: `${appBaseUrl()}/purchase/requisitions/${quote.requisition.id}/quotes?from=notification`,
      targetAccessLevels: [...QUOTE_APPROVER_ACCESS_LEVELS],
      vesselId: quote.requisition.vesselId,
      companyId: quote.requisition.vessel?.companyId ?? null,
      entityId: quote.id,
      metadata: {
        quoteId: quote.id,
        requisitionId: quote.requisition.id,
        requisitionNumber: quote.requisition.requisitionNumber,
      },
    });
  }

  // —— Quotes approved, PO not sent ——
  const approvedQuotes = await prisma.vendorQuote.findMany({
    where: { status: "APPROVED" },
    include: {
      requisition: {
        select: {
          id: true,
          requisitionNumber: true,
          status: true,
          vesselId: true,
          vessel: { select: { companyId: true } },
        },
      },
      purchaseOrders: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          poNumber: true,
          workflowStatus: true,
          levelOneApprovedAt: true,
          levelTwoApprovedAt: true,
          levelThreeApprovedAt: true,
          totalAmount: true,
        },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  for (const quote of approvedQuotes) {
    const req = quote.requisition;
    if (!req) continue;
    const po = quote.purchaseOrders[0];
    const vesselId = req.vesselId;
    const companyId = req.vessel?.companyId ?? null;

    if (req.status === "QUOTE_APPROVED" || !po) {
      const rejectHistory = await prisma.purchaseHistory.findFirst({
        where: {
          requisitionId: req.id,
          actionType: PurchaseHistoryActionType.REJECTED,
          newStatus: "PURCHASER_REVISION",
        },
        orderBy: { createdAt: "desc" },
        select: { newValue: true, comments: true },
      });

      if (rejectHistory) {
        const historyValue = parsePurchaseHistoryNewValue(rejectHistory.newValue);
        const historyQuoteId =
          typeof historyValue?.quoteId === "string" ? historyValue.quoteId : null;
        if (!historyQuoteId || historyQuoteId === quote.id) {
          quotes += await createProcurementTaskNotifications({
            operation: "PO_RETURNED_FOR_REVISION",
            dedupeKey: `quote:${quote.id}:po_revision`,
            actionUrl: quoteCreatePoUrl(quote.id, { from: "notification", revision: true }),
            targetAccessLevels: [...PURCHASER_ACCESS_LEVELS],
            vesselId,
            companyId,
            entityId: quote.id,
            metadata: {
              quoteId: quote.id,
              requisitionNumber: req.requisitionNumber,
              purchaseOrderNumber:
                typeof historyValue?.poNumber === "string"
                  ? historyValue.poNumber
                  : undefined,
              rejectionComments: rejectHistory.comments ?? undefined,
            },
          });
          continue;
        }
      }

      quotes += await createProcurementTaskNotifications({
        operation: "APPROVE_QUOTE",
        dedupeKey: `quote:${quote.id}:confirm_po`,
        actionUrl: quoteCreatePoUrl(quote.id, { from: "notification" }),
        targetAccessLevels: [...PURCHASER_ACCESS_LEVELS],
        vesselId,
        companyId,
        entityId: quote.id,
        metadata: { quoteId: quote.id, requisitionNumber: req.requisitionNumber },
      });
      continue;
    }

    const amt = po.totalAmount ? Number(po.totalAmount) : 0;
    const policy = await getPoApprovalPolicy(companyId, vesselId);
    if (amt < policy.thresholdLevel2) continue;

    const poWorkflow =
      po.workflowStatus ??
      resolveWorkflowStatusAfterApproval(po, amt, policy);

    if (
      poWorkflow === PurchaseOrderWorkflowStatus.PO_SENT ||
      poWorkflow === PurchaseOrderWorkflowStatus.CANCELLED ||
      poWorkflow === PurchaseOrderWorkflowStatus.PO_CONFIRMED
    ) {
      if (poWorkflow === PurchaseOrderWorkflowStatus.PO_CONFIRMED) {
        purchaseOrders += await createProcurementTaskNotifications({
          operation: "PO_READY_TO_SEND",
          dedupeKey: `po:${po.id}:ready_send`,
          actionUrl: quoteSendPoUrl(quote.id, { from: "notification" }),
          targetAccessLevels: [...PURCHASER_ACCESS_LEVELS],
          vesselId,
          companyId,
          entityId: po.id,
          metadata: { poId: po.id, poNumber: po.poNumber, quoteId: quote.id },
        });
      }
      continue;
    }

    const requiresThree = amt >= policy.thresholdLevel3;
    const nextLevels = resolveNextPoApproverLevels(policy, po, requiresThree);

    if (nextLevels.length > 0) {
      const levelNum = !po.levelOneApprovedAt ? 1 : !po.levelTwoApprovedAt ? 2 : 3;
      purchaseOrders += await createProcurementTaskNotifications({
        operation: "PO_APPROVAL_PENDING",
        dedupeKey: `po:${po.id}:level${levelNum}`,
        actionUrl: quoteSendPoUrl(quote.id, { from: "notification" }),
        targetAccessLevels: nextLevels,
        vesselId,
        companyId,
        entityId: po.id,
        metadata: {
          poId: po.id,
          poNumber: po.poNumber,
          quoteId: quote.id,
          approvalLevel: levelNum,
        },
      });
    }
  }

  // —— Active goods POs pending tier (confirm-flow POs without quote link edge cases) ——
  const pendingPos = await listGoodsPosPendingApproval();
  for (const po of pendingPos.slice(0, limit)) {
    const amt = po.totalAmount ? Number(po.totalAmount) : 0;
    const companyId = po.requisition?.vessel?.companyId ?? null;
    const vesselId = po.requisition?.vesselId ?? null;
    const policy = await getPoApprovalPolicy(companyId, vesselId);
    const requiresThree = amt >= policy.thresholdLevel3;
    const nextLevels = resolveNextPoApproverLevels(policy, po, requiresThree);
    if (nextLevels.length === 0) continue;

    const levelNum = !po.levelOneApprovedAt ? 1 : !po.levelTwoApprovedAt ? 2 : 3;
    const actionUrl = po.quoteId
      ? quoteSendPoUrl(po.quoteId, { from: "notification" })
      : `${appBaseUrl()}/purchase/view-pos?po=${encodeURIComponent(po.poNumber ?? po.id)}&from=notification`;

    purchaseOrders += await createProcurementTaskNotifications({
      operation: "PO_APPROVAL_PENDING",
      dedupeKey: `po:${po.id}:level${levelNum}`,
      actionUrl,
      targetAccessLevels: nextLevels,
      vesselId,
      companyId,
      entityId: po.id,
      metadata: {
        poId: po.id,
        poNumber: po.poNumber,
        quoteId: po.quoteId,
        approvalLevel: levelNum,
      },
    });
  }

  // —— Invoices in verification chain ——
  const pendingInvoices = await prisma.invoice.findMany({
    where: {
      status: {
        in: [
          "READY_FOR_APPROVAL",
          "LEVEL_ONE_APPROVED",
          "LEVEL_TWO_APPROVED",
          "LEVEL_THREE_APPROVED",
          "READY_FOR_PAYMENT",
        ],
      },
    },
    include: {
      requisition: { include: { vessel: { select: { companyId: true } } } },
      purchaseOrder: { select: { poNumber: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  for (const inv of pendingInvoices) {
    const vesselId = inv.requisition?.vesselId ?? null;
    const companyId = inv.requisition?.vessel?.companyId ?? null;
    const levels = await getInvoiceApprovalLevels(companyId, vesselId);

    if (inv.status === "READY_FOR_PAYMENT") {
      invoices += await createProcurementTaskNotifications({
        operation: "INVOICE_READY_FOR_PAYMENT",
        dedupeKey: `invoice:${inv.id}:payment`,
        actionUrl: `${appBaseUrl()}/accounts/pending-invoices?invoice=${encodeURIComponent(inv.invoiceNumber)}&from=notification`,
        targetAccessLevels: [...PURCHASER_ACCESS_LEVELS],
        vesselId,
        companyId,
        entityId: inv.id,
        metadata: { invoiceId: inv.id, invoiceNumber: inv.invoiceNumber },
      });
      continue;
    }

    const nextLevels = resolveNextInvoiceApproverLevels(levels, inv.status);
    const levelNum = invoicePendingLevelNumber(inv.status);
    if (!nextLevels?.length || !levelNum) continue;

    invoices += await createProcurementTaskNotifications({
      operation: "INVOICE_APPROVAL_PENDING",
      dedupeKey: `invoice:${inv.id}:level${levelNum}`,
      actionUrl: `${appBaseUrl()}${buildInvoiceVerificationUrl(inv.id, { fromNotification: true, mode: "approve" })}`,
      targetAccessLevels: nextLevels,
      vesselId,
      companyId,
      entityId: inv.id,
      metadata: {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        approvalLevel: levelNum,
      },
    });
  }

  return {
    requisitions,
    quotes,
    purchaseOrders,
    invoices,
    repairedPoApprovalMetadata,
    totalCreated: requisitions + quotes + purchaseOrders + invoices,
  };
}
