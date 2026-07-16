/** Canonical dedupe keys for TASK_ASSIGNED notifications (live events, sync backfill, cron). */

/** Parse `:levelN` / `:lN` suffix from a dedupe key when metadata tier is wrong. */
export function parseTierLevelFromDedupeKey(dedupeKey: string): number | null {
  const match = dedupeKey.match(/:level(\d+)$/i) ?? dedupeKey.match(/:l(\d+)$/i);
  if (!match) return null;
  const level = Number(match[1]);
  return Number.isFinite(level) && level > 0 ? level : null;
}

export function resolveTaskDedupeKey(
  operation: string,
  meta: Record<string, unknown>
): string | null {
  if (typeof meta.dedupeKey === "string" && meta.dedupeKey.trim()) {
    return meta.dedupeKey.trim();
  }

  const requisitionId =
    typeof meta.requisitionId === "string" ? meta.requisitionId : null;
  const quoteId = typeof meta.quoteId === "string" ? meta.quoteId : null;
  const poId = typeof meta.poId === "string" ? meta.poId : null;
  const invoiceId = typeof meta.invoiceId === "string" ? meta.invoiceId : null;
  const deliveryNoteId =
    typeof meta.deliveryNoteId === "string" ? meta.deliveryNoteId : null;
  const approvalLevel =
    typeof meta.approvalLevel === "number" ? meta.approvalLevel : null;
  const stage = typeof meta.stage === "string" ? meta.stage : null;
  const clarificationId =
    typeof meta.clarificationId === "string"
      ? meta.clarificationId
      : typeof meta.entityId === "string" && operation.startsWith("RFQ_CLARIFICATION")
        ? meta.entityId
        : null;
  const onboardCrewId =
    typeof meta.onboardCrewId === "string" ? meta.onboardCrewId : null;
  const reportId =
    typeof meta.reportId === "string" ? meta.reportId : null;
  const alertId = typeof meta.alertId === "string" ? meta.alertId : null;
  const jobAssignmentId =
    typeof meta.jobAssignmentId === "string" ? meta.jobAssignmentId : null;
  const parentRequisitionId =
    typeof meta.parentRequisitionId === "string" ? meta.parentRequisitionId : null;

  switch (operation) {
    case "REQ_APPROVAL_PENDING":
      if (!requisitionId) return null;
      if (stage === "NEW_REQ") return `req:${requisitionId}:new_req`;
      return `req:${requisitionId}:not_ready`;
    case "APPROVE_REQUISITION":
      return requisitionId ? `req:${requisitionId}:send_quote` : null;
    case "APPROVE_SPLIT_QUOTES":
      return parentRequisitionId
        ? `req:${parentRequisitionId}:split_po`
        : requisitionId
          ? `req:${requisitionId}:split_po`
          : null;
    case "CREATE_QUOTE":
      return quoteId ? `quote:${quoteId}:approve` : null;
    case "APPROVE_QUOTE":
      return quoteId ? `quote:${quoteId}:confirm_po` : null;
    case "PO_APPROVAL_PENDING":
      return poId && approvalLevel != null
        ? `po:${poId}:level${approvalLevel}`
        : null;
    case "PO_READY_TO_SEND":
      return poId ? `po:${poId}:ready_send` : null;
    case "PO_RETURNED_FOR_REVISION":
      return quoteId ? `quote:${quoteId}:po_revision` : null;
    case "INVOICE_RETURNED_FOR_REVISION":
      return invoiceId ? `invoice:${invoiceId}:returned` : null;
    case "DELIVERY_NOTE_REJECTED":
      return deliveryNoteId ? `dn:${deliveryNoteId}:rejected` : null;
    case "REQUISITION_REJECTED":
      return requisitionId ? `req:${requisitionId}:rejected` : null;
    case "REJECT_QUOTE":
      return quoteId ? `quote:${quoteId}:rejected` : null;
    case "RETURN_REQUISITION":
      return requisitionId ? `req:${requisitionId}:returned` : null;
    case "DELIVERY_NOTE_VERIFICATION":
      return deliveryNoteId ? `dn:${deliveryNoteId}:verify` : null;
    case "ONBOARD_RECEIPT_PENDING":
      return deliveryNoteId ? `dn:${deliveryNoteId}:receipt` : null;
    case "RECEIPT_QUANTITY_VARIANCE":
      return deliveryNoteId ? `dn:${deliveryNoteId}:variance` : null;
    case "CREATE_INVOICE":
    case "INVOICE_APPROVAL_PENDING":
      return invoiceId
        ? `invoice:${invoiceId}:level${approvalLevel ?? 1}`
        : null;
    case "INVOICE_READY_FOR_PAYMENT":
      return invoiceId ? `invoice:${invoiceId}:payment` : null;
    case "RFQ_CLARIFICATION_REQUESTED":
      return clarificationId
        ? `clarification:${clarificationId}:requested`
        : requisitionId
          ? `req:${requisitionId}:clarification_requested`
          : null;
    case "RFQ_CLARIFICATION_ESCALATED":
      return clarificationId ? `clarification:${clarificationId}:escalated` : null;
    case "CREW_SHORE_L1_APPROVAL":
      return onboardCrewId ? `crew-shore:${onboardCrewId}:l1` : null;
    case "NOON_REPORT_V2_RETURNED":
      return reportId ? `noon:${reportId}:returned` : null;
    case "REORDER_ALERT":
      return alertId ? `reorder:${alertId}` : null;
    case "EXTENSION_REQUESTED":
      return jobAssignmentId ? `job-ext:${jobAssignmentId}` : null;
    case "VENDOR_CHAT_REPLY": {
      const messageId =
        typeof meta.messageId === "string" ? meta.messageId : null;
      return messageId ? `vendor-chat:${messageId}` : null;
    }
    default:
      return null;
  }
}

/** Keep the newest unread inbox row per canonical task key. */
export function dedupeInboxRowsByTaskKey<
  T extends { id: string; operation: string; metadata: unknown },
>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const key =
      resolveTaskDedupeKey(row.operation, meta) ?? `${row.operation}:${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
