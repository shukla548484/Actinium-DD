import type { NextRequest } from "next/server";
import { logActivityFromRequestWithNotification } from "@/lib/utils/enhanced-activity-logger";
import type { PoApprovalPolicy } from "@/lib/services/po-approval-policy.service";
import type { InvoiceApprovalLevels } from "@/lib/services/invoice-approval-config.service";
import { quoteCreatePoUrl, quoteSendPoUrl } from "@/lib/procurement/quote-po-navigation";
import { resolveTaskDedupeKey } from "@/lib/notifications/task-dedupe";
import { markUnreadTasksReadByDedupeKey } from "@/lib/notifications/has-unread-task";
import { rejectionRemarksSuffix } from "@/lib/procurement/rejection-remark-text";
import { buildInvoiceVerificationUrl } from "@/lib/purchase/invoice-verification-url";

import { ONBOARD_RECEIPT_ACCESS_LEVELS } from "@/lib/purchase/receipt-confirmation-access";
import { PO_BUDGET_CHANGE_APPROVER_LEVELS } from "@/lib/purchase/po-budget-change-access";
import { formatBudgetClassificationLabel } from "@/lib/procurement/requisition-budget-classification";

export const PURCHASER_ACCESS_LEVELS = [32, 33, 50, 99, 100] as const;
export const QUOTE_APPROVER_ACCESS_LEVELS = [37, 39, 50, 99, 100] as const;
export const REQ_SHORE_APPROVER_ACCESS_LEVELS = [37, 39, 50, 99, 100] as const;
export const ACCOUNTS_PAYMENT_ACCESS_LEVELS = [32, 33, 50, 99, 100] as const;

type NotifyContext = {
  request: NextRequest;
  actorUserId: string;
  vesselId?: string | null;
  companyId?: string | null;
  requisitionNumber?: string;
  purchaseOrderNumber?: string;
  quoteId?: string;
  invoiceId?: string;
  metadata?: Record<string, unknown>;
};

function baseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://www.actinium-sm.org";
}

/** PO tiers still pending approval (sequential). */
export function resolveNextPoApproverLevels(
  policy: PoApprovalPolicy,
  po: {
    levelOneApprovedAt: Date | null;
    levelTwoApprovedAt: Date | null;
    levelThreeApprovedAt: Date | null;
  },
  requiresThreeApprovals: boolean
): number[] {
  if (!po.levelOneApprovedAt) return policy.level1AccessLevels;
  if (!po.levelTwoApprovedAt) return policy.level2AccessLevels;
  if (requiresThreeApprovals && !po.levelThreeApprovedAt) return policy.level3AccessLevels;
  return [];
}

/** Invoice 4-level chain — next approvers from current status (not amount-based). */
export function resolveNextInvoiceApproverLevels(
  levels: InvoiceApprovalLevels,
  status: string
): number[] | null {
  switch (status) {
    case "LEVEL_ONE_APPROVED":
      return levels.level2AccessLevels;
    case "LEVEL_TWO_APPROVED":
      return levels.level3AccessLevels;
    case "LEVEL_THREE_APPROVED":
      return levels.level4AccessLevels;
    default:
      return null;
  }
}

export async function notifyRequisitionApprovalPending(
  ctx: NotifyContext & {
    requisitionId: string;
    stage: "CREATED_NOT_READY" | "NEW_REQ";
  }
): Promise<void> {
  const url =
    ctx.stage === "NEW_REQ"
      ? `${baseUrl()}/purchase/view-requisitions?from=notification`
      : `${baseUrl()}/purchase/requisitions/${ctx.requisitionId}/approve?from=notification`;

  const targetAccessLevels =
    ctx.stage === "NEW_REQ"
      ? [...REQ_SHORE_APPROVER_ACCESS_LEVELS]
      : [...REQ_SHORE_APPROVER_ACCESS_LEVELS];

  await logActivityFromRequestWithNotification(
    ctx.request,
    ctx.actorUserId,
    "REQ_APPROVAL_PENDING",
    `Requisition ${ctx.requisitionNumber ?? ctx.requisitionId} requires approval`,
    {
      module: "Purchase",
      page: "/purchase/view-requisitions",
      requisitionNumber: ctx.requisitionNumber,
      vesselId: ctx.vesselId ?? undefined,
      companyId: ctx.companyId ?? undefined,
      metadata: {
        requisitionId: ctx.requisitionId,
        stage: ctx.stage,
        dedupeKey: resolveTaskDedupeKey("REQ_APPROVAL_PENDING", {
          requisitionId: ctx.requisitionId,
          stage: ctx.stage,
        }),
        ...ctx.metadata,
      },
      createNotification: true,
      notificationType: "TASK_ASSIGNED",
      actionUrl: url,
      targetAccessLevels: [...targetAccessLevels],
    }
  );
}

export async function notifyRequisitionApprovedForPurchasing(
  ctx: NotifyContext & { requisitionId: string }
): Promise<void> {
  await logActivityFromRequestWithNotification(
    ctx.request,
    ctx.actorUserId,
    "APPROVE_REQUISITION",
    `Requisition ${ctx.requisitionNumber ?? ctx.requisitionId} approved — send for quote`,
    {
      module: "Purchase",
      page: "/purchase/view-requisitions",
      requisitionNumber: ctx.requisitionNumber,
      vesselId: ctx.vesselId ?? undefined,
      companyId: ctx.companyId ?? undefined,
      metadata: {
        requisitionId: ctx.requisitionId,
        dedupeKey: resolveTaskDedupeKey("APPROVE_REQUISITION", {
          requisitionId: ctx.requisitionId,
        }),
        ...ctx.metadata,
      },
      createNotification: true,
      notificationType: "TASK_ASSIGNED",
      actionUrl: `${baseUrl()}/purchase/view-requisitions?req=${encodeURIComponent(ctx.requisitionNumber ?? ctx.requisitionId)}&from=notification`,
      targetAccessLevels: [...PURCHASER_ACCESS_LEVELS],
    }
  );
}

export async function notifyQuoteReviewPending(
  ctx: NotifyContext & { requisitionId: string }
): Promise<void> {
  await logActivityFromRequestWithNotification(
    ctx.request,
    ctx.actorUserId,
    "CREATE_QUOTE",
    `Quote received for requisition ${ctx.requisitionNumber ?? ctx.requisitionId} — approval required`,
    {
      module: "Purchase",
      page: "/purchase/requisitions",
      requisitionNumber: ctx.requisitionNumber,
      vesselId: ctx.vesselId ?? undefined,
      companyId: ctx.companyId ?? undefined,
      metadata: {
        requisitionId: ctx.requisitionId,
        quoteId: ctx.quoteId,
        dedupeKey: resolveTaskDedupeKey("CREATE_QUOTE", {
          requisitionId: ctx.requisitionId,
          quoteId: ctx.quoteId,
        }),
        ...ctx.metadata,
      },
      createNotification: true,
      notificationType: "TASK_ASSIGNED",
      actionUrl: `${baseUrl()}/purchase/requisitions/${ctx.requisitionId}/quotes?from=notification`,
      targetAccessLevels: [...QUOTE_APPROVER_ACCESS_LEVELS],
    }
  );
}

export async function notifyQuoteApprovedForConfirm(
  ctx: NotifyContext
): Promise<void> {
  const quoteId = ctx.quoteId;
  if (!quoteId) return;

  await logActivityFromRequestWithNotification(
    ctx.request,
    ctx.actorUserId,
    "APPROVE_QUOTE",
    `Quote approved for requisition ${ctx.requisitionNumber ?? ""} — create PO`,
    {
      module: "Purchase",
      page: "/purchase/quotes",
      requisitionNumber: ctx.requisitionNumber,
      vesselId: ctx.vesselId ?? undefined,
      companyId: ctx.companyId ?? undefined,
      metadata: {
        quoteId,
        dedupeKey: resolveTaskDedupeKey("APPROVE_QUOTE", { quoteId }),
        ...ctx.metadata,
      },
      createNotification: true,
      notificationType: "TASK_ASSIGNED",
      actionUrl: quoteCreatePoUrl(quoteId, { from: "notification" }),
      targetAccessLevels: [...PURCHASER_ACCESS_LEVELS],
    }
  );
}

export async function notifyPoReturnedForRevision(
  ctx: NotifyContext & { quoteId: string; rejectionComments?: string }
): Promise<void> {
  const po = ctx.purchaseOrderNumber ?? "PO";
  const remarks = rejectionRemarksSuffix(ctx.rejectionComments);
  const dedupeKey = `quote:${ctx.quoteId}:po_revision`;

  await markUnreadTasksReadByDedupeKey({
    operation: "APPROVE_QUOTE",
    dedupeKey: `quote:${ctx.quoteId}:confirm_po`,
  });

  await logActivityFromRequestWithNotification(
    ctx.request,
    ctx.actorUserId,
    "PO_RETURNED_FOR_REVISION",
    `PO ${po} rejected — revise and re-create purchase order${remarks}`,
    {
      module: "Purchase",
      page: "/purchase/quotes",
      purchaseOrderNumber: ctx.purchaseOrderNumber,
      requisitionNumber: ctx.requisitionNumber,
      vesselId: ctx.vesselId ?? undefined,
      companyId: ctx.companyId ?? undefined,
      metadata: {
        quoteId: ctx.quoteId,
        rejectionComments: ctx.rejectionComments,
        dedupeKey,
        ...ctx.metadata,
      },
      createNotification: true,
      notificationType: "TASK_ASSIGNED",
      actionUrl: quoteCreatePoUrl(ctx.quoteId, { from: "notification", revision: true }),
      targetAccessLevels: [...PURCHASER_ACCESS_LEVELS],
    }
  );
}

export async function notifyPoApprovalPending(
  ctx: NotifyContext & {
    poId: string;
    approvalLevel: 1 | 2 | 3;
    targetAccessLevels: number[];
    rejectionComments?: string;
    returned?: boolean;
  }
): Promise<void> {
  const po = ctx.purchaseOrderNumber ?? ctx.poId;
  const returned = ctx.returned ?? ctx.metadata?.rejected === true;
  const remarks = rejectionRemarksSuffix(
    ctx.rejectionComments ??
      (typeof ctx.metadata?.rejectionComments === "string"
        ? ctx.metadata.rejectionComments
        : undefined)
  );
  const message = returned
    ? `PO ${po} was returned — Level ${ctx.approvalLevel} re-approval required${remarks}`
    : `PO ${po} requires Level ${ctx.approvalLevel} approval`;
  await logActivityFromRequestWithNotification(
    ctx.request,
    ctx.actorUserId,
    "PO_APPROVAL_PENDING",
    message,
    {
      module: "Purchase",
      page: "/purchase/view-pos",
      purchaseOrderNumber: ctx.purchaseOrderNumber,
      requisitionNumber: ctx.requisitionNumber,
      vesselId: ctx.vesselId ?? undefined,
      companyId: ctx.companyId ?? undefined,
      metadata: {
        ...ctx.metadata,
        poId: ctx.poId,
        approvalLevel: ctx.approvalLevel,
        quoteId: ctx.quoteId,
        rejectionComments:
          ctx.rejectionComments ??
          (typeof ctx.metadata?.rejectionComments === "string"
            ? ctx.metadata.rejectionComments
            : undefined),
        returned,
        dedupeKey: `po:${ctx.poId}:level${ctx.approvalLevel}`,
      },
      createNotification: true,
      notificationType: "TASK_ASSIGNED",
      actionUrl: ctx.quoteId
        ? quoteSendPoUrl(ctx.quoteId, { from: "notification" })
        : `${baseUrl()}/purchase/view-pos?po=${encodeURIComponent(po)}&from=notification`,
      targetAccessLevels: ctx.targetAccessLevels,
    }
  );
}

export async function notifyPoReadyToSend(ctx: NotifyContext & { poId: string }): Promise<void> {
  const po = ctx.purchaseOrderNumber ?? ctx.poId;
  await logActivityFromRequestWithNotification(
    ctx.request,
    ctx.actorUserId,
    "PO_READY_TO_SEND",
    `PO ${po} — all approvals complete, ready to send to vendor`,
    {
      module: "Purchase",
      page: "/purchase/quotes",
      purchaseOrderNumber: ctx.purchaseOrderNumber,
      requisitionNumber: ctx.requisitionNumber,
      vesselId: ctx.vesselId ?? undefined,
      companyId: ctx.companyId ?? undefined,
      metadata: { poId: ctx.poId, quoteId: ctx.quoteId, dedupeKey: `po:${ctx.poId}:ready_send`, ...ctx.metadata },
      createNotification: true,
      notificationType: "TASK_ASSIGNED",
      actionUrl: ctx.quoteId
        ? quoteSendPoUrl(ctx.quoteId, { from: "notification" })
        : `${baseUrl()}/purchase/view-pos?po=${encodeURIComponent(po)}&from=notification`,
      targetAccessLevels: [...PURCHASER_ACCESS_LEVELS],
    }
  );
}

export async function notifyInvoiceApprovalPending(
  ctx: NotifyContext & {
    invoiceNumber: string;
    approvalLevel: 1 | 2 | 3 | 4;
    targetAccessLevels: number[];
    returnRemarks?: string;
    returned?: boolean;
  }
): Promise<void> {
  const invoiceId = ctx.invoiceId;
  if (!invoiceId) return;

  const returned = ctx.returned ?? ctx.metadata?.returned === true;
  const remarks = rejectionRemarksSuffix(
    ctx.returnRemarks ??
      (typeof ctx.metadata?.returnRemarks === "string"
        ? ctx.metadata.returnRemarks
        : undefined)
  );
  const message = returned
    ? `Invoice ${ctx.invoiceNumber} was returned — Level ${ctx.approvalLevel} re-verification required${remarks}`
    : `Invoice ${ctx.invoiceNumber} requires Level ${ctx.approvalLevel} verification`;

  await logActivityFromRequestWithNotification(
    ctx.request,
    ctx.actorUserId,
    "INVOICE_APPROVAL_PENDING",
    message,
    {
      module: "Purchase",
      page: "/purchase/invoices",
      requisitionNumber: ctx.requisitionNumber,
      purchaseOrderNumber: ctx.purchaseOrderNumber,
      vesselId: ctx.vesselId ?? undefined,
      companyId: ctx.companyId ?? undefined,
      metadata: {
        ...ctx.metadata,
        invoiceId,
        invoiceNumber: ctx.invoiceNumber,
        approvalLevel: ctx.approvalLevel,
        returnRemarks:
          ctx.returnRemarks ??
          (typeof ctx.metadata?.returnRemarks === "string"
            ? ctx.metadata.returnRemarks
            : undefined),
        returned,
        dedupeKey: `invoice:${invoiceId}:level${ctx.approvalLevel}`,
      },
      createNotification: true,
      notificationType: "TASK_ASSIGNED",
      actionUrl: `${baseUrl()}${buildInvoiceVerificationUrl(invoiceId, { fromNotification: true, mode: "approve" })}`,
      targetAccessLevels: ctx.targetAccessLevels,
    }
  );
}

/** Maps post-approval status to the next verification tier (2–4). L1 is auto-completed on upload. */
export function invoicePendingLevelNumber(status: string): 1 | 2 | 3 | 4 | null {
  switch (status) {
    case "LEVEL_ONE_APPROVED":
      return 2;
    case "LEVEL_TWO_APPROVED":
      return 3;
    case "LEVEL_THREE_APPROVED":
      return 4;
    default:
      return null;
  }
}

export async function notifyInvoiceReadyForPayment(
  ctx: NotifyContext & { invoiceNumber: string }
): Promise<void> {
  await logActivityFromRequestWithNotification(
    ctx.request,
    ctx.actorUserId,
    "INVOICE_READY_FOR_PAYMENT",
    `Invoice ${ctx.invoiceNumber} verified — ready for payment`,
    {
      module: "Purchase",
      page: "/accounts/pending-invoices",
      requisitionNumber: ctx.requisitionNumber,
      purchaseOrderNumber: ctx.purchaseOrderNumber,
      vesselId: ctx.vesselId ?? undefined,
      companyId: ctx.companyId ?? undefined,
      metadata: {
        invoiceId: ctx.invoiceId,
        invoiceNumber: ctx.invoiceNumber,
        dedupeKey: `invoice:${ctx.invoiceId}:payment`,
        ...ctx.metadata,
      },
      createNotification: true,
      notificationType: "TASK_ASSIGNED",
      actionUrl: `${baseUrl()}/accounts/pending-invoices?invoice=${encodeURIComponent(ctx.invoiceNumber)}&from=notification`,
      targetAccessLevels: [...ACCOUNTS_PAYMENT_ACCESS_LEVELS],
    }
  );
}

/** After invoice return — notify purchasers (revision) or lower-tier verifiers (re-verify). */
export async function notifyInvoiceReturnedForCorrection(
  ctx: NotifyContext & {
    invoiceNumber: string;
    newStatus: string;
    returnRemarks: string;
    approvalLevels: InvoiceApprovalLevels;
  }
): Promise<void> {
  const invoiceId = ctx.invoiceId;
  if (!invoiceId) return;

  const remarks = rejectionRemarksSuffix(ctx.returnRemarks);

  if (ctx.newStatus === "READY_FOR_APPROVAL" || ctx.newStatus === "LEVEL_ONE_APPROVED") {
    await logActivityFromRequestWithNotification(
      ctx.request,
      ctx.actorUserId,
      "INVOICE_RETURNED_FOR_REVISION",
      `Invoice ${ctx.invoiceNumber} returned for purchaser correction${remarks}`,
      {
        module: "Purchase",
        page: "/purchase/invoices",
        requisitionNumber: ctx.requisitionNumber,
        purchaseOrderNumber: ctx.purchaseOrderNumber,
        vesselId: ctx.vesselId ?? undefined,
        companyId: ctx.companyId ?? undefined,
        metadata: {
          invoiceId,
          invoiceNumber: ctx.invoiceNumber,
          returnRemarks: ctx.returnRemarks,
          dedupeKey: resolveTaskDedupeKey("INVOICE_RETURNED_FOR_REVISION", {
            invoiceId,
          }),
          ...ctx.metadata,
        },
        createNotification: true,
        notificationType: "TASK_ASSIGNED",
        actionUrl: `${baseUrl()}${buildInvoiceVerificationUrl(invoiceId, { fromNotification: true, mode: "approve" })}`,
        targetAccessLevels: [...PURCHASER_ACCESS_LEVELS],
      }
    );
    return;
  }

  const nextLevels = resolveNextInvoiceApproverLevels(ctx.approvalLevels, ctx.newStatus);
  const pendingLevel = invoicePendingLevelNumber(ctx.newStatus);
  if (!nextLevels?.length || pendingLevel == null) return;

  await notifyInvoiceApprovalPending({
    ...ctx,
    approvalLevel: pendingLevel,
    targetAccessLevels: nextLevels,
    returnRemarks: ctx.returnRemarks,
    returned: true,
  });
}

/** Notify purchasers when a delivery note is rejected during verification. */
export async function notifyDeliveryNoteRejected(
  ctx: NotifyContext & {
    deliveryNoteId: string;
    deliveryNoteNumber?: string | null;
    rejectionNotes?: string;
  }
): Promise<void> {
  const dn = ctx.deliveryNoteNumber ?? ctx.deliveryNoteId;
  const remarks = rejectionRemarksSuffix(ctx.rejectionNotes);
  await logActivityFromRequestWithNotification(
    ctx.request,
    ctx.actorUserId,
    "DELIVERY_NOTE_REJECTED",
    `Delivery note ${dn} was rejected${remarks}`,
    {
      module: "Purchase",
      page: "/purchase/dn-status",
      requisitionNumber: ctx.requisitionNumber,
      purchaseOrderNumber: ctx.purchaseOrderNumber,
      vesselId: ctx.vesselId ?? undefined,
      companyId: ctx.companyId ?? undefined,
      metadata: {
        deliveryNoteId: ctx.deliveryNoteId,
        deliveryNoteNumber: ctx.deliveryNoteNumber,
        rejectionComments: ctx.rejectionNotes,
        dedupeKey: resolveTaskDedupeKey("DELIVERY_NOTE_REJECTED", {
          deliveryNoteId: ctx.deliveryNoteId,
        }),
        ...ctx.metadata,
      },
      createNotification: true,
      notificationType: "TASK_ASSIGNED",
      actionUrl: `${baseUrl()}/purchase/dn-status?from=notification`,
      targetAccessLevels: [...PURCHASER_ACCESS_LEVELS],
    }
  );
}

/** Notify requisition creator when shore returns a requisition for editing. */
export async function notifyRequisitionReturned(
  ctx: NotifyContext & {
    requisitionId: string;
    returnComments?: string;
    targetUserIds: string[];
  }
): Promise<void> {
  const remarks = rejectionRemarksSuffix(ctx.returnComments);
  await logActivityFromRequestWithNotification(
    ctx.request,
    ctx.actorUserId,
    "RETURN_REQUISITION",
    `Requisition ${ctx.requisitionNumber ?? ctx.requisitionId} returned for editing${remarks}`,
    {
      module: "Purchase",
      page: "/purchase/requisitions",
      requisitionNumber: ctx.requisitionNumber,
      vesselId: ctx.vesselId ?? undefined,
      companyId: ctx.companyId ?? undefined,
      metadata: {
        requisitionId: ctx.requisitionId,
        returnComments: ctx.returnComments,
        dedupeKey: resolveTaskDedupeKey("RETURN_REQUISITION", {
          requisitionId: ctx.requisitionId,
        }),
        ...ctx.metadata,
      },
      createNotification: true,
      notificationType: "TASK_ASSIGNED",
      actionUrl: `${baseUrl()}/purchase/requisitions/${ctx.requisitionId}/view?from=notification`,
      targetUserIds: ctx.targetUserIds,
    }
  );
}

/** Notify requisition creator when shore rejects a requisition. */
export async function notifyRequisitionRejected(
  ctx: NotifyContext & {
    requisitionId: string;
    rejectionComments: string;
    targetUserIds: string[];
  }
): Promise<void> {
  const remarks = rejectionRemarksSuffix(ctx.rejectionComments);
  await logActivityFromRequestWithNotification(
    ctx.request,
    ctx.actorUserId,
    "REQUISITION_REJECTED",
    `Requisition ${ctx.requisitionNumber ?? ctx.requisitionId} was rejected${remarks}`,
    {
      module: "Purchase",
      page: "/purchase/view-requisitions",
      requisitionNumber: ctx.requisitionNumber,
      vesselId: ctx.vesselId ?? undefined,
      companyId: ctx.companyId ?? undefined,
      metadata: {
        requisitionId: ctx.requisitionId,
        rejectionComments: ctx.rejectionComments,
        dedupeKey: resolveTaskDedupeKey("REQUISITION_REJECTED", {
          requisitionId: ctx.requisitionId,
        }),
        ...ctx.metadata,
      },
      createNotification: true,
      notificationType: "TASK_ASSIGNED",
      actionUrl: `${baseUrl()}/purchase/requisitions/${ctx.requisitionId}/view?from=notification`,
      targetUserIds: ctx.targetUserIds,
    }
  );
}

const DN_VERIFIER_ACCESS_LEVELS = [25, 50, 99, 100] as const;

/** Notify master/admin when a delivery note is uploaded or re-uploaded after rejection. */
export async function notifyDeliveryNoteVerificationPending(
  ctx: NotifyContext & {
    deliveryNoteId: string;
    deliveryNoteNumber?: string | null;
    reUploaded?: boolean;
  }
): Promise<void> {
  const dn = ctx.deliveryNoteNumber ?? ctx.deliveryNoteId;
  const reUploaded = ctx.reUploaded ?? ctx.metadata?.reUploaded === true;
  const message = reUploaded
    ? `Delivery note ${dn} was re-uploaded — optional master review`
    : `Delivery note ${dn} uploaded`;

  await logActivityFromRequestWithNotification(
    ctx.request,
    ctx.actorUserId,
    "DELIVERY_NOTE_VERIFICATION",
    message,
    {
      module: "Purchase",
      page: "/purchase/dn-status",
      requisitionNumber: ctx.requisitionNumber,
      purchaseOrderNumber: ctx.purchaseOrderNumber,
      vesselId: ctx.vesselId ?? undefined,
      companyId: ctx.companyId ?? undefined,
      metadata: {
        deliveryNoteId: ctx.deliveryNoteId,
        deliveryNoteNumber: ctx.deliveryNoteNumber,
        reUploaded,
        dedupeKey: resolveTaskDedupeKey("DELIVERY_NOTE_VERIFICATION", {
          deliveryNoteId: ctx.deliveryNoteId,
        }),
        ...ctx.metadata,
      },
      createNotification: true,
      notificationType: "TASK_ASSIGNED",
      actionUrl: `${baseUrl()}/purchase/dn-status?from=notification`,
      targetAccessLevels: [...DN_VERIFIER_ACCESS_LEVELS],
    }
  );
}

/** Notify purchasers when a quote is rejected during approval. */
export async function notifyQuoteRejected(
  ctx: NotifyContext & {
    requisitionId: string;
    quoteNumber?: string | null;
    reason?: string;
  }
): Promise<void> {
  const quote = ctx.quoteNumber ?? ctx.quoteId ?? "quote";
  const remarks = rejectionRemarksSuffix(ctx.reason);
  await logActivityFromRequestWithNotification(
    ctx.request,
    ctx.actorUserId,
    "REJECT_QUOTE",
    `Quote ${quote} for requisition ${ctx.requisitionNumber ?? ctx.requisitionId} was rejected${remarks}`,
    {
      module: "Purchase",
      page: "/purchase/quotes",
      requisitionNumber: ctx.requisitionNumber,
      vesselId: ctx.vesselId ?? undefined,
      companyId: ctx.companyId ?? undefined,
      metadata: {
        requisitionId: ctx.requisitionId,
        quoteId: ctx.quoteId,
        quoteNumber: ctx.quoteNumber,
        reason: ctx.reason,
        dedupeKey: resolveTaskDedupeKey("REJECT_QUOTE", {
          quoteId: ctx.quoteId,
        }),
        ...ctx.metadata,
      },
      createNotification: true,
      notificationType: "TASK_ASSIGNED",
      actionUrl: `${baseUrl()}/purchase/quotes?from=notification`,
      targetAccessLevels: [...PURCHASER_ACCESS_LEVELS],
    }
  );
}

/** Notify crew (levels 20–24) to confirm onboard receipt after DN upload. */
export async function notifyOnboardReceiptPending(
  ctx: NotifyContext & {
    deliveryNoteId: string;
    deliveryNoteNumber?: string | null;
    vesselId: string;
  }
): Promise<void> {
  const dn = ctx.deliveryNoteNumber ?? ctx.deliveryNoteId;
  const params = new URLSearchParams({
    dnId: ctx.deliveryNoteId,
    vesselId: ctx.vesselId,
    from: "notification",
  });

  await logActivityFromRequestWithNotification(
    ctx.request,
    ctx.actorUserId,
    "ONBOARD_RECEIPT_PENDING",
    `Delivery note ${dn} uploaded — confirm received quantities vs ordered PO lines`,
    {
      module: "Purchase",
      page: "/purchase/requisitions/receipt-confirmation",
      requisitionNumber: ctx.requisitionNumber,
      purchaseOrderNumber: ctx.purchaseOrderNumber,
      vesselId: ctx.vesselId,
      companyId: ctx.companyId ?? undefined,
      metadata: {
        deliveryNoteId: ctx.deliveryNoteId,
        deliveryNoteNumber: ctx.deliveryNoteNumber,
        dedupeKey: resolveTaskDedupeKey("ONBOARD_RECEIPT_PENDING", {
          deliveryNoteId: ctx.deliveryNoteId,
        }),
        ...ctx.metadata,
      },
      createNotification: true,
      notificationType: "TASK_ASSIGNED",
      actionUrl: `${baseUrl()}/purchase/requisitions/receipt-confirmation?${params.toString()}`,
      targetAccessLevels: [...ONBOARD_RECEIPT_ACCESS_LEVELS],
    }
  );
}

/** Notify purchasers when onboard receipt qty differs from PO ordered qty. */
export async function notifyReceiptQuantityVariance(
  ctx: NotifyContext & {
    deliveryNoteId: string;
    deliveryNoteNumber?: string | null;
    varianceLineCount: number;
  }
): Promise<void> {
  if (ctx.varianceLineCount <= 0) return;

  const dn = ctx.deliveryNoteNumber ?? ctx.deliveryNoteId;
  const po = ctx.purchaseOrderNumber ? ` (PO ${ctx.purchaseOrderNumber})` : "";

  await logActivityFromRequestWithNotification(
    ctx.request,
    ctx.actorUserId,
    "RECEIPT_QUANTITY_VARIANCE",
    `Onboard receipt for DN ${dn}${po} has ${ctx.varianceLineCount} line(s) with quantity variance vs ordered qty`,
    {
      module: "Purchase",
      page: "/purchase/purchase-orders",
      requisitionNumber: ctx.requisitionNumber,
      purchaseOrderNumber: ctx.purchaseOrderNumber,
      vesselId: ctx.vesselId ?? undefined,
      companyId: ctx.companyId ?? undefined,
      metadata: {
        deliveryNoteId: ctx.deliveryNoteId,
        deliveryNoteNumber: ctx.deliveryNoteNumber,
        varianceLineCount: ctx.varianceLineCount,
        dedupeKey: resolveTaskDedupeKey("RECEIPT_QUANTITY_VARIANCE", {
          deliveryNoteId: ctx.deliveryNoteId,
        }),
        ...ctx.metadata,
      },
      createNotification: true,
      notificationType: "TASK_ASSIGNED",
      actionUrl: `${baseUrl()}/purchase/purchase-orders?tab=variance&from=notification`,
      targetAccessLevels: [...PURCHASER_ACCESS_LEVELS],
    }
  );
}

/** Notify tier approvers when PO budget classification change is requested (post-invoice). */
export async function notifyPoBudgetChangePending(
  ctx: NotifyContext & {
    requestId: string;
    purchaseOrderId: string;
    currentIsBudgeted: boolean;
    requestedIsBudgeted: boolean;
  }
): Promise<void> {
  const fromLabel = formatBudgetClassificationLabel(ctx.currentIsBudgeted);
  const toLabel = formatBudgetClassificationLabel(ctx.requestedIsBudgeted);
  const po = ctx.purchaseOrderNumber ?? ctx.purchaseOrderId;

  await logActivityFromRequestWithNotification(
    ctx.request,
    ctx.actorUserId,
    "PO_BUDGET_CHANGE_PENDING",
    `PO ${po}: budget change requested (${fromLabel} → ${toLabel})`,
    {
      module: "Purchase",
      page: "/purchase/po-budget-change",
      requisitionNumber: ctx.requisitionNumber,
      purchaseOrderNumber: ctx.purchaseOrderNumber,
      vesselId: ctx.vesselId ?? undefined,
      companyId: ctx.companyId ?? undefined,
      metadata: {
        requestId: ctx.requestId,
        purchaseOrderId: ctx.purchaseOrderId,
        currentIsBudgeted: ctx.currentIsBudgeted,
        requestedIsBudgeted: ctx.requestedIsBudgeted,
        dedupeKey: resolveTaskDedupeKey("PO_BUDGET_CHANGE_PENDING", {
          requestId: ctx.requestId,
        }),
        ...ctx.metadata,
      },
      createNotification: true,
      notificationType: "TASK_ASSIGNED",
      actionUrl: `${baseUrl()}/purchase/po-budget-change?from=notification`,
      targetAccessLevels: [...PO_BUDGET_CHANGE_APPROVER_LEVELS, 50, 99, 100],
    }
  );
}

export async function notifyPoBudgetChangeResolved(
  ctx: NotifyContext & {
    requestId: string;
    purchaseOrderId: string;
    requestedById: string;
    approved: boolean;
    requestedIsBudgeted: boolean;
  }
): Promise<void> {
  const po = ctx.purchaseOrderNumber ?? ctx.purchaseOrderId;
  const label = formatBudgetClassificationLabel(ctx.requestedIsBudgeted);
  const message = ctx.approved
    ? `PO ${po}: budget change approved (${label})`
    : `PO ${po}: budget change request rejected`;

  await logActivityFromRequestWithNotification(
    ctx.request,
    ctx.actorUserId,
    ctx.approved ? "PO_BUDGET_CHANGE_APPROVED" : "PO_BUDGET_CHANGE_REJECTED",
    message,
    {
      module: "Purchase",
      page: "/purchase/po-budget-change",
      requisitionNumber: ctx.requisitionNumber,
      purchaseOrderNumber: ctx.purchaseOrderNumber,
      vesselId: ctx.vesselId ?? undefined,
      companyId: ctx.companyId ?? undefined,
      metadata: {
        requestId: ctx.requestId,
        purchaseOrderId: ctx.purchaseOrderId,
        approved: ctx.approved,
        dedupeKey: resolveTaskDedupeKey(
          ctx.approved ? "PO_BUDGET_CHANGE_APPROVED" : "PO_BUDGET_CHANGE_REJECTED",
          { requestId: ctx.requestId }
        ),
        ...ctx.metadata,
      },
      createNotification: true,
      notificationType: "TASK_ASSIGNED",
      actionUrl: `${baseUrl()}/purchase/po-budget-change?from=notification`,
      targetUserIds: [ctx.requestedById],
    }
  );

  if (ctx.approved) {
    await markUnreadTasksReadByDedupeKey(
      resolveTaskDedupeKey("PO_BUDGET_CHANGE_PENDING", { requestId: ctx.requestId })
    );
  }
}
