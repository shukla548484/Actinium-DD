import prisma from "@/lib/prisma";
import { listEntityAuditTimeline } from "@/lib/procurement/platform-audit";
import { getPurchaseHistory } from "@/lib/services/purchase-history.service";
import { getInvoiceHistory } from "@/lib/services/invoice-history.service";

export type HistoryPerformer = {
  id?: string;
  firstName: string;
  lastName: string;
  designation?: string | null;
  email?: string | null;
};

export type PurchaseEntityHistoryEntry = {
  id: string;
  actionType: string;
  actionLabel: string;
  actionDescription?: string | null;
  previousStatus?: string | null;
  newStatus?: string | null;
  comments?: string | null;
  performedBy: HistoryPerformer;
  createdAt: string;
  source: "purchase_history" | "po_history" | "invoice_history" | "entity_snapshot" | "platform_audit" | "receipt_confirmation";
};

const ACTION_LABELS: Record<string, string> = {
  CREATED: "Created",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RETURNED: "Sent for update",
  CANCELLED: "Cancelled",
  SENT_FOR_QUOTE: "Sent for quote",
  QUOTE_RECEIVED: "Quote received",
  QUOTE_APPROVED: "Quote approved",
  COMMENT_ADDED: "Comment added",
  STATUS_CHANGED: "Status changed",
  UPDATED: "Updated",
  DELETED: "Deleted",
  MODIFIED: "Modified",
  ATTACHMENT_ADDED: "Attachment added",
  PDF_MERGED: "PDF merged",
  CANCELLATION_REQUESTED: "Cancellation requested",
  CANCELLATION_ACCEPTED: "Cancellation accepted",
  CANCELLATION_REJECTED: "Cancellation rejected",
  LEVEL_ONE_APPROVED: "Level 1 approved",
  LEVEL_TWO_APPROVED: "Level 2 approved",
  LEVEL_THREE_APPROVED: "Level 3 approved",
  LEVEL_FOUR_APPROVED: "Level 4 approved",
  PAID: "Marked as paid",
  UPLOADED: "Delivery note uploaded",
  VERIFIED: "Delivery note verified",
  RECEIPT_CONFIRMED: "Receipt confirmed",
};

function actionLabel(actionType: string): string {
  return ACTION_LABELS[actionType] ?? actionType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function emp(
  e?: {
    id?: string;
    firstName?: string | null;
    lastName?: string | null;
    designation?: string | null;
    email?: string | null;
  } | null
): HistoryPerformer {
  if (!e?.firstName && !e?.lastName) {
    return { firstName: "System", lastName: "" };
  }
  return {
    id: e.id,
    firstName: e.firstName ?? "",
    lastName: e.lastName ?? "",
    designation: e.designation ?? null,
    email: e.email ?? null,
  };
}

function performerName(p: HistoryPerformer): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || "System";
}

function dedupeKey(entry: Pick<PurchaseEntityHistoryEntry, "actionType" | "createdAt" | "performedBy">): string {
  const minute = entry.createdAt.slice(0, 16);
  return `${entry.actionType}|${minute}|${performerName(entry.performedBy)}`;
}

function sortAndDedupe(entries: PurchaseEntityHistoryEntry[]): PurchaseEntityHistoryEntry[] {
  const seen = new Set<string>();
  const out: PurchaseEntityHistoryEntry[] = [];
  const sorted = [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  for (const e of sorted) {
    const key = dedupeKey(e);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

function hasSimilarAction(
  entries: PurchaseEntityHistoryEntry[],
  actionType: string,
  at: Date,
  windowMs = 120_000
): boolean {
  const t = at.getTime();
  return entries.some(
    (e) =>
      e.actionType === actionType &&
      Math.abs(new Date(e.createdAt).getTime() - t) <= windowMs
  );
}

function mapPurchaseHistoryRow(
  h: Awaited<ReturnType<typeof getPurchaseHistory>>[number]
): PurchaseEntityHistoryEntry {
  return {
    id: h.id,
    actionType: h.actionType,
    actionLabel: actionLabel(h.actionType),
    actionDescription: h.actionDescription,
    previousStatus: h.previousStatus,
    newStatus: h.newStatus,
    comments: h.comments,
    performedBy: emp(h.performedBy),
    createdAt: h.createdAt.toISOString(),
    source: "purchase_history",
  };
}

function mapPoHistoryRow(
  h: {
    id: string;
    actionType: string;
    actionDescription: string | null;
    previousStatus: string | null;
    newStatus: string | null;
    comments: string | null;
    createdAt: Date;
    performedBy: {
      id: string;
      firstName: string;
      lastName: string;
      designation?: string | null;
    };
  }
): PurchaseEntityHistoryEntry {
  return {
    id: h.id,
    actionType: h.actionType,
    actionLabel: actionLabel(h.actionType),
    actionDescription: h.actionDescription,
    previousStatus: h.previousStatus,
    newStatus: h.newStatus,
    comments: h.comments,
    performedBy: emp(h.performedBy),
    createdAt: h.createdAt.toISOString(),
    source: "po_history",
  };
}

function mapInvoiceHistoryRow(
  h: Awaited<ReturnType<typeof getInvoiceHistory>>[number]
): PurchaseEntityHistoryEntry {
  return {
    id: h.id,
    actionType: h.actionType,
    actionLabel: actionLabel(h.actionType),
    actionDescription: h.actionDescription,
    previousStatus: h.previousStatus,
    newStatus: h.newStatus,
    comments: h.comments,
    performedBy: emp(h.performedBy),
    createdAt: h.createdAt.toISOString(),
    source: "invoice_history",
  };
}

function mapAuditEvent(ev: {
  id: string;
  action: string;
  occurredAt: Date;
  reason?: string | null;
  remarks?: string | null;
  actorEmployee?: {
    id: string;
    firstName: string;
    lastName: string;
    designation?: string | null;
  } | null;
}): PurchaseEntityHistoryEntry {
  const actionType = ev.action.toUpperCase().replace(/\s+/g, "_");
  return {
    id: `audit-${ev.id}`,
    actionType,
    actionLabel: actionLabel(actionType) !== actionType ? actionLabel(actionType) : ev.action,
    actionDescription: ev.remarks ?? ev.reason ?? null,
    comments: ev.reason ?? ev.remarks ?? null,
    performedBy: emp(ev.actorEmployee),
    createdAt: ev.occurredAt.toISOString(),
    source: "platform_audit",
  };
}

/** Full requisition timeline — DB history + entity snapshots + platform audit. */
export async function buildRequisitionTimeline(
  requisitionId: string
): Promise<PurchaseEntityHistoryEntry[]> {
  const [req, historyRows, auditTimeline] = await Promise.all([
    prisma.requisition.findUnique({
      where: { id: requisitionId },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, designation: true, email: true },
        },
        approvedBy: {
          select: { id: true, firstName: true, lastName: true, designation: true, email: true },
        },
        deletedBy: {
          select: { id: true, firstName: true, lastName: true, designation: true, email: true },
        },
      },
    }),
    getPurchaseHistory(requisitionId).catch(() => []),
    listEntityAuditTimeline("Requisition", requisitionId).catch(() => ({
      events: [],
      versions: [],
    })),
  ]);

  if (!req) return [];

  const entries: PurchaseEntityHistoryEntry[] = historyRows.map(mapPurchaseHistoryRow);

  if (req.createdBy && !hasSimilarAction(entries, "CREATED", req.dateOfCreation)) {
    entries.push({
      id: `snap-req-created-${req.id}`,
      actionType: "CREATED",
      actionLabel: actionLabel("CREATED"),
      actionDescription: `Requisition ${req.requisitionNumber} created`,
      newStatus: req.status,
      performedBy: emp(req.createdBy),
      createdAt: req.dateOfCreation.toISOString(),
      source: "entity_snapshot",
    });
  }

  if (req.approvedAt && req.approvedBy && !hasSimilarAction(entries, "APPROVED", req.approvedAt)) {
    entries.push({
      id: `snap-req-approved-${req.id}`,
      actionType: "APPROVED",
      actionLabel: actionLabel("APPROVED"),
      actionDescription: `Requisition ${req.requisitionNumber} approved`,
      performedBy: emp(req.approvedBy),
      createdAt: req.approvedAt.toISOString(),
      source: "entity_snapshot",
    });
  }

  if (req.returnComments?.trim()) {
    const returned = entries.find((e) => e.actionType === "RETURNED");
    if (!returned) {
      entries.push({
        id: `snap-req-returned-${req.id}`,
        actionType: "RETURNED",
        actionLabel: actionLabel("RETURNED"),
        actionDescription: `Requisition ${req.requisitionNumber} sent back for update`,
        comments: req.returnComments,
        performedBy: { firstName: "Unknown", lastName: "" },
        createdAt: (req.updatedAt ?? req.dateOfCreation).toISOString(),
        source: "entity_snapshot",
      });
    }
  }

  if (req.deletedAt && req.deletedBy) {
    entries.push({
      id: `snap-req-deleted-${req.id}`,
      actionType: "DELETED",
      actionLabel: actionLabel("DELETED"),
      actionDescription: `Requisition ${req.requisitionNumber} deleted`,
      performedBy: emp(req.deletedBy),
      createdAt: req.deletedAt.toISOString(),
      source: "entity_snapshot",
    });
  }

  for (const ev of auditTimeline.events) {
    entries.push(mapAuditEvent(ev));
  }

  return sortAndDedupe(entries);
}

/** Full purchase order timeline. */
export async function buildPurchaseOrderTimeline(
  purchaseOrderId: string
): Promise<PurchaseEntityHistoryEntry[]> {
  const [po, historyRows, cancellations, auditTimeline] = await Promise.all([
    prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        levelOneApprover: {
          select: { id: true, firstName: true, lastName: true, designation: true },
        },
        levelTwoApprover: {
          select: { id: true, firstName: true, lastName: true, designation: true },
        },
        levelThreeApprover: {
          select: { id: true, firstName: true, lastName: true, designation: true },
        },
        requisition: { select: { id: true, requisitionNumber: true } },
      },
    }),
    prisma.purchaseOrderHistory.findMany({
      where: { purchaseOrderId },
      include: {
        performedBy: {
          select: { id: true, firstName: true, lastName: true, designation: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.purchaseOrderCancellationRequest.findMany({
      where: { purchaseOrderId },
      include: {
        requestedBy: {
          select: { id: true, firstName: true, lastName: true, designation: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    listEntityAuditTimeline("PurchaseOrder", purchaseOrderId).catch(() => ({
      events: [],
      versions: [],
    })),
  ]);

  if (!po) return [];

  const entries: PurchaseEntityHistoryEntry[] = historyRows.map(mapPoHistoryRow);

  if (!hasSimilarAction(entries, "CREATED", po.dateOfIssue)) {
    entries.push({
      id: `snap-po-created-${po.id}`,
      actionType: "CREATED",
      actionLabel: actionLabel("CREATED"),
      actionDescription: `Purchase Order ${po.poNumber} issued`,
      newStatus: po.status,
      performedBy: { firstName: "System", lastName: "" },
      createdAt: po.dateOfIssue.toISOString(),
      source: "entity_snapshot",
    });
  }

  if (po.levelOneApprovedAt && po.levelOneApprover) {
    if (!hasSimilarAction(entries, "LEVEL_ONE_APPROVED", po.levelOneApprovedAt)) {
      entries.push({
        id: `snap-po-l1-${po.id}`,
        actionType: "LEVEL_ONE_APPROVED",
        actionLabel: actionLabel("LEVEL_ONE_APPROVED"),
        actionDescription: `PO ${po.poNumber} — Level 1 approval`,
        performedBy: emp(po.levelOneApprover),
        createdAt: po.levelOneApprovedAt.toISOString(),
        source: "entity_snapshot",
      });
    }
  }

  if (po.levelTwoApprovedAt && po.levelTwoApprover) {
    if (!hasSimilarAction(entries, "LEVEL_TWO_APPROVED", po.levelTwoApprovedAt)) {
      entries.push({
        id: `snap-po-l2-${po.id}`,
        actionType: "LEVEL_TWO_APPROVED",
        actionLabel: actionLabel("LEVEL_TWO_APPROVED"),
        actionDescription: `PO ${po.poNumber} — Level 2 approval`,
        performedBy: emp(po.levelTwoApprover),
        createdAt: po.levelTwoApprovedAt.toISOString(),
        source: "entity_snapshot",
      });
    }
  }

  if (po.levelThreeApprovedAt && po.levelThreeApprover) {
    if (!hasSimilarAction(entries, "LEVEL_THREE_APPROVED", po.levelThreeApprovedAt)) {
      entries.push({
        id: `snap-po-l3-${po.id}`,
        actionType: "LEVEL_THREE_APPROVED",
        actionLabel: actionLabel("LEVEL_THREE_APPROVED"),
        actionDescription: `PO ${po.poNumber} — Level 3 approval`,
        performedBy: emp(po.levelThreeApprover),
        createdAt: po.levelThreeApprovedAt.toISOString(),
        source: "entity_snapshot",
      });
    }
  }

  for (const cr of cancellations) {
    entries.push({
      id: `snap-po-cancel-req-${cr.id}`,
      actionType: "CANCELLATION_REQUESTED",
      actionLabel: actionLabel("CANCELLATION_REQUESTED"),
      actionDescription: `Cancellation requested for PO ${po.poNumber}`,
      comments: cr.reason ?? undefined,
      performedBy: emp(cr.requestedBy),
      createdAt: cr.createdAt.toISOString(),
      source: "entity_snapshot",
    });
    if (cr.acceptedAt) {
      entries.push({
        id: `snap-po-cancel-accept-${cr.id}`,
        actionType: "CANCELLATION_ACCEPTED",
        actionLabel: actionLabel("CANCELLATION_ACCEPTED"),
        actionDescription: `Cancellation accepted for PO ${po.poNumber}`,
        comments: cr.rejectionReason ?? undefined,
        performedBy: emp(cr.requestedBy),
        createdAt: cr.acceptedAt.toISOString(),
        source: "entity_snapshot",
      });
    }
    if (cr.rejectedAt) {
      entries.push({
        id: `snap-po-cancel-reject-${cr.id}`,
        actionType: "CANCELLATION_REJECTED",
        actionLabel: actionLabel("CANCELLATION_REJECTED"),
        actionDescription: `Cancellation rejected for PO ${po.poNumber}`,
        comments: cr.rejectionReason ?? undefined,
        performedBy: emp(cr.requestedBy),
        createdAt: cr.rejectedAt.toISOString(),
        source: "entity_snapshot",
      });
    }
  }

  for (const ev of auditTimeline.events) {
    entries.push(mapAuditEvent(ev));
  }

  return sortAndDedupe(entries);
}

/** Full invoice timeline. */
export async function buildInvoiceTimeline(invoiceId: string): Promise<PurchaseEntityHistoryEntry[]> {
  const [invoice, historyRows, auditTimeline] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        levelOneApprover: {
          select: { id: true, firstName: true, lastName: true, designation: true },
        },
        levelTwoApprover: {
          select: { id: true, firstName: true, lastName: true, designation: true },
        },
        levelThreeApprover: {
          select: { id: true, firstName: true, lastName: true, designation: true },
        },
        levelFourApprover: {
          select: { id: true, firstName: true, lastName: true, designation: true },
        },
        lastReturner: {
          select: { id: true, firstName: true, lastName: true, designation: true },
        },
        payer: {
          select: { id: true, firstName: true, lastName: true, designation: true },
        },
      },
    }),
    getInvoiceHistory(invoiceId),
    listEntityAuditTimeline("Invoice", invoiceId).catch(() => ({ events: [], versions: [] })),
  ]);

  if (!invoice) return [];

  const entries: PurchaseEntityHistoryEntry[] = historyRows.map(mapInvoiceHistoryRow);

  if (!hasSimilarAction(entries, "CREATED", invoice.createdAt)) {
    entries.push({
      id: `snap-inv-created-${invoice.id}`,
      actionType: "CREATED",
      actionLabel: actionLabel("CREATED"),
      actionDescription: `Invoice ${invoice.invoiceNumber} created`,
      newStatus: invoice.status,
      performedBy: { firstName: "System", lastName: "" },
      createdAt: invoice.createdAt.toISOString(),
      source: "entity_snapshot",
    });
  }

  const approvalSnapshots: Array<{
    at: Date | null | undefined;
    by: typeof invoice.levelOneApprover;
    type: string;
    label: string;
  }> = [
    {
      at: invoice.levelOneApprovedAt,
      by: invoice.levelOneApprover,
      type: "LEVEL_ONE_APPROVED",
      label: "Level 1 approved",
    },
    {
      at: invoice.levelTwoApprovedAt,
      by: invoice.levelTwoApprover,
      type: "LEVEL_TWO_APPROVED",
      label: "Level 2 approved",
    },
    {
      at: invoice.levelThreeApprovedAt,
      by: invoice.levelThreeApprover,
      type: "LEVEL_THREE_APPROVED",
      label: "Level 3 approved",
    },
    {
      at: invoice.levelFourApprovedAt,
      by: invoice.levelFourApprover,
      type: "LEVEL_FOUR_APPROVED",
      label: "Level 4 approved",
    },
  ];

  for (const snap of approvalSnapshots) {
    if (snap.at && snap.by && !hasSimilarAction(entries, snap.type, snap.at)) {
      entries.push({
        id: `snap-inv-${snap.type}-${invoice.id}`,
        actionType: snap.type,
        actionLabel: snap.label,
        actionDescription: `Invoice ${invoice.invoiceNumber} — ${snap.label}`,
        performedBy: emp(snap.by),
        createdAt: snap.at.toISOString(),
        source: "entity_snapshot",
      });
    }
  }

  if (invoice.lastReturnedAt && invoice.lastReturner) {
    if (!hasSimilarAction(entries, "RETURNED", invoice.lastReturnedAt)) {
      entries.push({
        id: `snap-inv-returned-${invoice.id}`,
        actionType: "RETURNED",
        actionLabel: actionLabel("RETURNED"),
        actionDescription: `Invoice ${invoice.invoiceNumber} returned for reconsideration`,
        comments: invoice.lastReturnRemarks ?? undefined,
        performedBy: emp(invoice.lastReturner),
        createdAt: invoice.lastReturnedAt.toISOString(),
        source: "entity_snapshot",
      });
    }
  }

  if (invoice.paidAt && invoice.payer) {
    if (!hasSimilarAction(entries, "PAID", invoice.paidAt)) {
      entries.push({
        id: `snap-inv-paid-${invoice.id}`,
        actionType: "PAID",
        actionLabel: actionLabel("PAID"),
        actionDescription: `Invoice ${invoice.invoiceNumber} marked as paid`,
        comments: invoice.paymentReference ?? undefined,
        performedBy: emp(invoice.payer),
        createdAt: invoice.paidAt.toISOString(),
        source: "entity_snapshot",
      });
    }
  }

  for (const ev of auditTimeline.events) {
    entries.push(mapAuditEvent(ev));
  }

  return sortAndDedupe(entries);
}

/** Delivery note timeline from upload, verification, and receipt confirmations. */
export async function buildDeliveryNoteTimeline(
  deliveryNoteId: string
): Promise<PurchaseEntityHistoryEntry[]> {
  const [dn, confirmations, auditTimeline] = await Promise.all([
    prisma.deliveryNote.findUnique({
      where: { id: deliveryNoteId },
      include: {
        vendor: { select: { name: true } },
      },
    }),
    prisma.requisitionReceiptConfirmation.findMany({
      where: { deliveryNoteId },
      include: {
        confirmedByUser: {
          select: { id: true, firstName: true, lastName: true, designation: true },
        },
        requisition: { select: { requisitionNumber: true } },
      },
      orderBy: { confirmedAt: "desc" },
    }),
    listEntityAuditTimeline("DeliveryNote", deliveryNoteId).catch(() => ({
      events: [],
      versions: [],
    })),
  ]);

  if (!dn) return [];

  const entries: PurchaseEntityHistoryEntry[] = [];

  entries.push({
    id: `snap-dn-uploaded-${dn.id}`,
    actionType: "UPLOADED",
    actionLabel: actionLabel("UPLOADED"),
    actionDescription: `Delivery note ${dn.deliveryNoteNumber} uploaded${dn.vendor?.name ? ` (${dn.vendor.name})` : ""}`,
    newStatus: dn.status,
    performedBy: { firstName: "Vendor", lastName: "" },
    createdAt: dn.uploadedAt.toISOString(),
    source: "entity_snapshot",
  });

  if (dn.verifiedAt) {
    let verifier: HistoryPerformer = { firstName: "Office", lastName: "" };
    if (dn.verifiedBy) {
      const empRow = await prisma.employee.findUnique({
        where: { id: dn.verifiedBy },
        select: { id: true, firstName: true, lastName: true, designation: true },
      });
      if (empRow) verifier = emp(empRow);
    }
    entries.push({
      id: `snap-dn-verified-${dn.id}`,
      actionType: "VERIFIED",
      actionLabel: actionLabel("VERIFIED"),
      actionDescription: `Delivery note ${dn.deliveryNoteNumber} verified`,
      newStatus: dn.status,
      comments: dn.notes ?? undefined,
      performedBy: verifier,
      createdAt: dn.verifiedAt.toISOString(),
      source: "entity_snapshot",
    });
  }

  for (const rc of confirmations) {
    entries.push({
      id: `snap-dn-receipt-${rc.id}`,
      actionType: "RECEIPT_CONFIRMED",
      actionLabel: actionLabel("RECEIPT_CONFIRMED"),
      actionDescription: `Receipt confirmed for requisition ${rc.requisition.requisitionNumber}`,
      comments: rc.notes ?? undefined,
      newStatus: rc.overallStatus,
      performedBy: emp(rc.confirmedByUser),
      createdAt: rc.confirmedAt.toISOString(),
      source: "receipt_confirmation",
    });
  }

  for (const ev of auditTimeline.events) {
    entries.push(mapAuditEvent(ev));
  }

  return sortAndDedupe(entries);
}
