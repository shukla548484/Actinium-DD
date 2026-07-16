import type { Prisma } from "@prisma/client";
import {
  RequisitionStatus,
  getIsEditableFromStatus,
} from "@/lib/types/requisition";
import {
  dedupeVendorQuotesByLatest,
  countComparableVendorQuotes,
  isVendorQuoteStatusSent,
} from "@/lib/procurement/vendor-quote-receipt";

export type RequisitionQuoteRow = {
  status: string;
  vendorId?: string;
  receivedAt?: Date | string | null;
  createdAt?: Date | string | null;
  quotedItems?: Array<{ unitPrice?: unknown | null; totalPrice?: unknown | null }> | null;
};

export type RequisitionReconcileInput = {
  id: string;
  requisitionNumber: string;
  status: string;
  vendorQuotes: RequisitionQuoteRow[];
  purchaseOrders?: Array<{ status: string }>;
  purchaseHistory?: Array<{ actionType: string; newStatus: string | null }>;
};

export type RequisitionReconcileResult = {
  requisitionId: string;
  requisitionNumber: string;
  currentStatus: string;
  expectedStatus: string;
  reason: string;
};

const TERMINAL_STATUSES = new Set<string>([
  RequisitionStatus.REQ_RECEIVED_DELIVERED,
  RequisitionStatus.INVOICE_RECEIVED,
  RequisitionStatus.CANCELLED,
  RequisitionStatus.REQ_RETURNED,
]);

const STATUS_RANK: Record<string, number> = {
  [RequisitionStatus.NOT_READY]: 0,
  [RequisitionStatus.NEW_REQ]: 1,
  [RequisitionStatus.REQ_APPROVED]: 2,
  [RequisitionStatus.SENT_FOR_QUOTE]: 3,
  [RequisitionStatus.PARTIAL_QUOTE_RECEIVED]: 4,
  [RequisitionStatus.QUOTE_RECEIVED]: 5,
  [RequisitionStatus.QUOTE_APPROVED]: 6,
  [RequisitionStatus.SPLIT]: 6,
  [RequisitionStatus.QUOTE_CONFIRMED_PO_SENT]: 7,
  [RequisitionStatus.REQ_RECEIVED_DELIVERED]: 8,
  [RequisitionStatus.INVOICE_RECEIVED]: 9,
  [RequisitionStatus.REQ_RETURNED]: 10,
  [RequisitionStatus.CANCELLED]: 10,
};

function rank(status: string): number {
  return STATUS_RANK[status] ?? -1;
}

/** Derive procurement-stage status from vendor quotes (matches quote-parser / submit-quote rules). */
export function deriveStatusFromVendorQuotes(
  quotes: RequisitionQuoteRow[],
  currentStatus: string
): RequisitionStatus | null {
  if (quotes.length === 0) return null;

  const approvedQuotes = quotes.filter((q) => q.status === "APPROVED");
  if (approvedQuotes.length > 1) {
    return RequisitionStatus.SPLIT;
  }
  if (approvedQuotes.length > 0) {
    return RequisitionStatus.QUOTE_APPROVED;
  }

  const withVendorId = quotes.filter(
    (q): q is RequisitionQuoteRow & { vendorId: string } => !!q.vendorId
  );
  const uniqueQuotes =
    withVendorId.length > 0 ? dedupeVendorQuotesByLatest(withVendorId) : quotes;

  const sentQuotes = uniqueQuotes.filter((q) => isVendorQuoteStatusSent(q.status));
  if (sentQuotes.length === 0) {
    return null;
  }

  const receivedQuotes = countComparableVendorQuotes(uniqueQuotes);
  const declinedQuotes = uniqueQuotes.filter(
    (q) => q.status === "REJECTED" || q.status === "DECLINED"
  ).length;
  const respondedQuotes = receivedQuotes + declinedQuotes;
  const totalSentQuotes = sentQuotes.length;

  if (respondedQuotes === totalSentQuotes && totalSentQuotes > 0) {
    return RequisitionStatus.QUOTE_RECEIVED;
  }
  if (receivedQuotes > 0 || declinedQuotes > 0) {
    return RequisitionStatus.PARTIAL_QUOTE_RECEIVED;
  }
  return RequisitionStatus.SENT_FOR_QUOTE;
}

function latestHistoryNewStatus(
  history: Array<{ actionType: string; newStatus: string | null }> | undefined,
  actionType: string
): string | null {
  if (!history?.length) return null;
  const row = history.find((h) => h.actionType === actionType && h.newStatus);
  return row?.newStatus ?? null;
}

/** Whether this requisition should appear in the shore "pending approval" queue. */
export function isRequisitionPendingApproval(input: RequisitionReconcileInput): boolean {
  const { status } = input;
  if (status !== RequisitionStatus.NEW_REQ && status !== RequisitionStatus.NOT_READY) {
    return false;
  }
  if (input.purchaseOrders?.some((po) => po.status !== "CANCELLED")) {
    return false;
  }
  if (input.vendorQuotes.some((q) => isVendorQuoteStatusSent(q.status))) {
    return false;
  }
  const shoreApproved = latestHistoryNewStatus(
    input.purchaseHistory,
    "APPROVED"
  );
  if (shoreApproved === RequisitionStatus.REQ_APPROVED) {
    return false;
  }
  if (
    latestHistoryNewStatus(input.purchaseHistory, "SENT_FOR_QUOTE") ===
    RequisitionStatus.SENT_FOR_QUOTE
  ) {
    return false;
  }
  return true;
}

/** Compute the status a requisition should have based on quotes, POs, and history. */
export function computeExpectedRequisitionStatus(
  input: RequisitionReconcileInput
): { expected: RequisitionStatus; reason: string } | null {
  const current = input.status;

  if (TERMINAL_STATUSES.has(current)) {
    return null;
  }

  /** Split approval is explicit — do not downgrade to QUOTE_APPROVED on read-path repair. */
  if (current === RequisitionStatus.SPLIT) {
    return null;
  }

  const activePos =
    input.purchaseOrders?.filter((po) => po.status !== "CANCELLED") ?? [];
  if (
    activePos.length > 0 &&
    rank(current) < rank(RequisitionStatus.QUOTE_CONFIRMED_PO_SENT)
  ) {
    return {
      expected: RequisitionStatus.QUOTE_CONFIRMED_PO_SENT,
      reason: "Active purchase order exists",
    };
  }

  const fromQuotes = deriveStatusFromVendorQuotes(
    input.vendorQuotes,
    current
  );
  if (fromQuotes && fromQuotes !== current) {
    if (rank(fromQuotes) >= rank(current)) {
      return {
        expected: fromQuotes,
        reason: `Vendor quote state implies ${fromQuotes}`,
      };
    }
    if (
      current === RequisitionStatus.SENT_FOR_QUOTE &&
      fromQuotes === RequisitionStatus.REQ_APPROVED
    ) {
      return {
        expected: fromQuotes,
        reason: "No vendor quotes were actually sent",
      };
    }
    if (
      (current === RequisitionStatus.REQ_APPROVED ||
        current === RequisitionStatus.NEW_REQ) &&
      rank(fromQuotes) > rank(current)
    ) {
      return {
        expected: fromQuotes,
        reason: `Vendor quotes sent/responded but header status is ${current}`,
      };
    }
  }

  if (
    current === RequisitionStatus.SENT_FOR_QUOTE &&
    !input.vendorQuotes.some((q) => isVendorQuoteStatusSent(q.status))
  ) {
    return {
      expected: RequisitionStatus.REQ_APPROVED,
      reason: "Marked sent for quote but no vendor quotes in sent state",
    };
  }

  const historyApproved = latestHistoryNewStatus(
    input.purchaseHistory,
    "APPROVED"
  );
  if (
    historyApproved === RequisitionStatus.REQ_APPROVED &&
    (current === RequisitionStatus.NEW_REQ ||
      current === RequisitionStatus.NOT_READY)
  ) {
    return {
      expected: RequisitionStatus.REQ_APPROVED,
      reason: "Purchase history shows shore approval to REQ_APPROVED",
    };
  }

  const historySent = latestHistoryNewStatus(
    input.purchaseHistory,
    "SENT_FOR_QUOTE"
  );
  if (
    historySent === RequisitionStatus.SENT_FOR_QUOTE &&
    rank(current) < rank(RequisitionStatus.SENT_FOR_QUOTE) &&
    input.vendorQuotes.some((q) => isVendorQuoteStatusSent(q.status))
  ) {
    return {
      expected: RequisitionStatus.SENT_FOR_QUOTE,
      reason: "Purchase history shows sent for quote with active vendor quotes",
    };
  }

  return null;
}

export function reconcileRequisitionStatus(
  input: RequisitionReconcileInput
): RequisitionReconcileResult | null {
  const computed = computeExpectedRequisitionStatus(input);
  if (!computed || computed.expected === input.status) {
    return null;
  }
  return {
    requisitionId: input.id,
    requisitionNumber: input.requisitionNumber,
    currentStatus: input.status,
    expectedStatus: computed.expected,
    reason: computed.reason,
  };
}

export async function applyRequisitionStatusFix(
  db: Pick<Prisma.TransactionClient, "requisition">,
  requisitionId: string,
  expectedStatus: RequisitionStatus
): Promise<void> {
  await db.requisition.update({
    where: { id: requisitionId },
    data: {
      status: expectedStatus,
      isEditable: getIsEditableFromStatus(expectedStatus),
    },
  });
}

/** Fix header status when vendor quotes / PO imply a later stage (safe to call on read paths). */
export async function repairRequisitionStatusIfDrifted(
  db: Pick<Prisma.TransactionClient, "requisition">,
  input: RequisitionReconcileInput
): Promise<RequisitionStatus> {
  const fix = reconcileRequisitionStatus(input);
  if (!fix) {
    return input.status as RequisitionStatus;
  }
  await applyRequisitionStatusFix(
    db,
    fix.requisitionId,
    fix.expectedStatus as RequisitionStatus
  );
  return fix.expectedStatus as RequisitionStatus;
}

export function toRequisitionReconcileInput(req: {
  id: string;
  requisitionNumber: string;
  status: string;
  vendorQuotes?: RequisitionQuoteRow[] | null;
  purchaseOrders?: Array<{ status: string }> | null;
  purchaseHistory?: Array<{ actionType: string; newStatus: string | null }> | null;
}): RequisitionReconcileInput {
  return {
    id: req.id,
    requisitionNumber: req.requisitionNumber,
    status: req.status,
    vendorQuotes: req.vendorQuotes ?? [],
    purchaseOrders: req.purchaseOrders ?? [],
    purchaseHistory: req.purchaseHistory,
  };
}

type RequisitionRepairDb = Pick<Prisma.TransactionClient, "requisition">;

/** Load quotes/PO and repair a single requisition by id. */
export async function repairRequisitionStatusById(
  db: RequisitionRepairDb,
  requisitionId: string
): Promise<RequisitionStatus | null> {
  const req = await db.requisition.findUnique({
    where: { id: requisitionId },
    select: {
      id: true,
      requisitionNumber: true,
      status: true,
      vendorQuotes: {
        select: {
          status: true,
          vendorId: true,
          receivedAt: true,
          createdAt: true,
          quotedItems: { select: { unitPrice: true, totalPrice: true } },
        },
      },
      purchaseOrders: { select: { status: true } },
      purchaseHistory: {
        select: { actionType: true, newStatus: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
  if (!req) return null;
  return repairRequisitionStatusIfDrifted(db, toRequisitionReconcileInput(req));
}
