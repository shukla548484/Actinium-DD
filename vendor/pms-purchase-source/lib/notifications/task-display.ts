/** Human-readable copy for Notification Center task rows (server + client safe). */

import { remarksFromMetadata } from "@/lib/procurement/rejection-remark-text";

export const TASK_ARROW_CTA = "Click on Arrow button to approve.";
export const TASK_ARROW_REVISE_CTA =
  "Click the Arrow button to open and create a revised purchase order.";

const GENERIC_ACTOR_LABELS = new Set([
  "system",
  "user",
  "an approver",
  "a colleague",
]);

const DEDUPE_STAGE_LABELS: Record<string, string> = {
  send_quote: "Send for Quote",
  send_for_quote: "Send for Quote",
  confirm_po: "Create Purchase Order",
  not_ready: "Shore Approval",
  new_req: "Shore Approval",
  approve: "Quote Approval",
  payment: "Payment Processing",
};

export type TaskActorInfo = {
  name: string | null;
  designation: string | null;
};

export function actorDisplayLabel(actor: TaskActorInfo | null | undefined): string {
  if (!actor) return "An approver";
  const name = (actor.name ?? "").trim();
  if (name && !GENERIC_ACTOR_LABELS.has(name.toLowerCase())) return name;
  const designation = (actor.designation ?? "").trim();
  if (designation) return designation;
  return "An approver";
}

/** Pull a person name from legacy notification message text when present. */
export function parseActorNameFromMessage(message: string): string | null {
  const m = message.match(/^(.+?)\s+has\s+(?:approved|rejected|created|verified|uploaded|returned|cancelled|recorded)/i);
  if (!m?.[1]) return null;
  const name = m[1].trim();
  if (!name || GENERIC_ACTOR_LABELS.has(name.toLowerCase())) return null;
  return name;
}

function entityFromMetadata(meta: Record<string, unknown>): {
  requisitionNumber: string | null;
  purchaseOrderNumber: string | null;
  invoiceNumber: string | null;
} {
  return {
    requisitionNumber:
      typeof meta.requisitionNumber === "string" ? meta.requisitionNumber : null,
    purchaseOrderNumber:
      typeof meta.purchaseOrderNumber === "string"
        ? meta.purchaseOrderNumber
        : typeof meta.poNumber === "string"
          ? meta.poNumber
          : null,
    invoiceNumber:
      typeof meta.invoiceNumber === "string" ? meta.invoiceNumber : null,
  };
}

function stageFromDedupeKey(dedupeKey: string | null): string | null {
  if (!dedupeKey) return null;
  const parts = dedupeKey.split(":");
  const tail = parts[parts.length - 1];
  return tail ? DEDUPE_STAGE_LABELS[tail] ?? null : null;
}

function humanizeDedupeEntity(dedupeKey: string | null): string | null {
  if (!dedupeKey) return null;
  const stage = stageFromDedupeKey(dedupeKey);
  if (stage) return stage;
  if (dedupeKey.startsWith("req:")) return "Requisition";
  if (dedupeKey.startsWith("quote:")) return "Quote";
  if (dedupeKey.startsWith("po:")) return "Purchase Order";
  if (dedupeKey.startsWith("invoice:")) return "Invoice";
  return null;
}

function replaceLegacyClickHere(message: string): string {
  return message
    .replace(
      /please\s+click\s+here\s+to\s+create\s+purchase\s+order\.?/gi,
      TASK_ARROW_CTA
    )
    .replace(/please\s+click\s+here\s+to\s+approve[^.]*\.?/gi, TASK_ARROW_CTA)
    .replace(/please\s+click\s+here\s+to\s+verify[^.]*\.?/gi, TASK_ARROW_CTA)
    .replace(/please\s+click\s+here\s+to\s+review[^.]*\.?/gi, TASK_ARROW_CTA)
    .replace(/please\s+click\s+here[^.]*\.?/gi, TASK_ARROW_CTA)
    .replace(/\bhere\b/gi, "the Arrow button");
}

function ensureArrowCta(
  message: string,
  requiresAction = true,
  cta: string = TASK_ARROW_CTA
): string {
  const trimmed = message.trim().replace(/\s+/g, " ");
  if (!requiresAction) return trimmed;
  if (new RegExp(cta.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(trimmed)) {
    return trimmed;
  }
  const withoutTrailing = trimmed.replace(/[.!?]+$/, "");
  return `${withoutTrailing}. ${cta}`;
}

function remarksSuffix(meta: Record<string, unknown>): string {
  const remarks = remarksFromMetadata(meta);
  return remarks ? ` Remarks: "${remarks}"` : "";
}

export function formatTaskDisplayCopy(input: {
  operation: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  actorLabel: string;
}): { title: string; message: string } {
  const meta = input.metadata ?? {};
  const dedupeKey = typeof meta.dedupeKey === "string" ? meta.dedupeKey : null;
  const entities = entityFromMetadata(meta);
  const reqNum = entities.requisitionNumber;
  const poNum = entities.purchaseOrderNumber;
  const invNum = entities.invoiceNumber;
  const approvalLevel =
    typeof meta.approvalLevel === "number" ? meta.approvalLevel : null;
  const returned = meta.returned === true || meta.rejected === true;
  const remarkText = remarksSuffix(meta);
  const stage =
    typeof meta.stage === "string"
      ? DEDUPE_STAGE_LABELS[meta.stage.toLowerCase()] ?? meta.stage
      : stageFromDedupeKey(dedupeKey);
  const action =
    typeof meta.action === "string"
      ? DEDUPE_STAGE_LABELS[meta.action] ?? meta.action
      : null;
  const actor = input.actorLabel;

  switch (input.operation) {
    case "APPROVE_QUOTE":
      return {
        title: "Quote Approved",
        message: ensureArrowCta(
          reqNum
            ? `${actor} has approved the quote for requisition ${reqNum}.`
            : `${actor} has approved the quote.`
        ),
      };

    case "APPROVE_REQUISITION":
      return {
        title: "Requisition Approved",
        message: ensureArrowCta(
          reqNum
            ? `${actor} has approved requisition ${reqNum}. Next step: ${action ?? stage ?? "Send for Quote"}.`
            : `${actor} has approved the requisition. Next step: ${action ?? stage ?? "Send for Quote"}.`
        ),
      };

    case "CREATE_QUOTE":
      return {
        title: "Quote Received — Approval Required",
        message: ensureArrowCta(
          reqNum
            ? `Quote received for requisition ${reqNum} requires your approval.`
            : "A received quote requires your approval."
        ),
      };

    case "REQ_APPROVAL_PENDING":
      return {
        title: "Requisition — Approval Required",
        message: ensureArrowCta(
          reqNum
            ? `Requisition ${reqNum} requires your approval.`
            : "A requisition requires your approval."
        ),
      };

    case "PO_APPROVAL_PENDING":
      return {
        title: returned ? "Purchase Order — Returned for Re-approval" : "Purchase Order — Approval Required",
        message: ensureArrowCta(
          poNum
            ? returned
              ? `PO ${poNum} was returned${approvalLevel ? ` — Level ${approvalLevel} re-approval required` : " for re-approval"}.${remarkText}`
              : `PO ${poNum}${approvalLevel ? ` requires Level ${approvalLevel} approval` : " requires your approval"}.`
            : returned
              ? `A purchase order was returned for re-approval.${remarkText}`
              : "A purchase order requires your approval."
        ),
      };

    case "PO_READY_TO_SEND":
      return {
        title: "Purchase Order — Ready to Send",
        message: ensureArrowCta(
          poNum
            ? `PO ${poNum} is approved and ready to send to the vendor.`
            : "A purchase order is ready to send to the vendor."
        ),
      };

    case "PO_RETURNED_FOR_REVISION":
      return {
        title: "Purchase Order — Revision Required",
        message: ensureArrowCta(
          poNum
            ? `PO ${poNum} was rejected. Revise and re-create the purchase order.${remarkText}`
            : `A purchase order was rejected. Revise and re-create it.${remarkText}`,
          true,
          TASK_ARROW_REVISE_CTA
        ),
      };

    case "INVOICE_RETURNED_FOR_REVISION":
      return {
        title: "Invoice — Revision Required",
        message: ensureArrowCta(
          invNum
            ? `Invoice ${invNum} was returned for correction.${remarkText}`
            : `An invoice was returned for correction.${remarkText}`
        ),
      };

    case "DELIVERY_NOTE_REJECTED": {
      const dnNum =
        typeof meta.deliveryNoteNumber === "string" ? meta.deliveryNoteNumber : null;
      return {
        title: "Delivery Note — Rejected",
        message: ensureArrowCta(
          dnNum
            ? `Delivery note ${dnNum} was rejected.${remarkText}`
            : `A delivery note was rejected.${remarkText}`
        ),
      };
    }

    case "DELIVERY_NOTE_VERIFICATION": {
      const dnNum =
        typeof meta.deliveryNoteNumber === "string" ? meta.deliveryNoteNumber : null;
      const reUploaded = meta.reUploaded === true;
      return {
        title: reUploaded ? "Delivery Note — Re-uploaded" : "Delivery Note — Uploaded",
        message: ensureArrowCta(
          dnNum
            ? reUploaded
              ? `Delivery note ${dnNum} was re-uploaded.`
              : `Delivery note ${dnNum} was uploaded.`
            : reUploaded
              ? "A delivery note was re-uploaded."
              : "A delivery note was uploaded."
        ),
      };
    }

    case "ONBOARD_RECEIPT_PENDING": {
      const dnNum =
        typeof meta.deliveryNoteNumber === "string" ? meta.deliveryNoteNumber : null;
      return {
        title: "Onboard Receipt — Confirmation Required",
        message: ensureArrowCta(
          dnNum
            ? `Delivery note ${dnNum} is on file. Confirm received quantities vs ordered PO lines.`
            : "A delivery note requires onboard receipt confirmation (ordered vs received qty)."
        ),
      };
    }

    case "RECEIPT_QUANTITY_VARIANCE": {
      const dnNum =
        typeof meta.deliveryNoteNumber === "string" ? meta.deliveryNoteNumber : null;
      const varianceCount =
        typeof meta.varianceLineCount === "number" ? meta.varianceLineCount : null;
      return {
        title: "Onboard Receipt — Quantity Variance",
        message: ensureArrowCta(
          dnNum
            ? `Onboard receipt for DN ${dnNum} has ${varianceLineCount ?? "line"} quantity variance vs ordered qty.`
            : "An onboard receipt has quantity variance vs ordered PO lines."
        ),
      };
    }

    case "REQUISITION_REJECTED":
      return {
        title: "Requisition — Rejected",
        message: ensureArrowCta(
          reqNum
            ? `Requisition ${reqNum} was rejected.${remarkText}`
            : `A requisition was rejected.${remarkText}`
        ),
      };

    case "REJECT_QUOTE":
      return {
        title: "Quote — Rejected",
        message: ensureArrowCta(
          reqNum
            ? `A quote for requisition ${reqNum} was rejected.${remarkText}`
            : `A quote was rejected.${remarkText}`
        ),
      };

    case "INVOICE_APPROVAL_PENDING":
      return {
        title: returned ? "Invoice — Returned for Re-verification" : "Invoice — Verification Required",
        message: ensureArrowCta(
          invNum
            ? returned
              ? `Invoice ${invNum} was returned${approvalLevel ? ` — Level ${approvalLevel} re-verification required` : " for re-verification"}.${remarkText}`
              : `Invoice ${invNum}${approvalLevel ? ` requires Level ${approvalLevel} verification` : " requires your verification"}.`
            : returned
              ? `An invoice was returned for re-verification.${remarkText}`
              : "An invoice requires your verification."
        ),
      };

    case "INVOICE_READY_FOR_PAYMENT":
      return {
        title: "Invoice — Ready for Payment",
        message: ensureArrowCta(
          invNum
            ? `Invoice ${invNum} is fully verified and ready for payment.`
            : "An invoice is ready for payment."
        ),
      };

    case "CREATE_PURCHASE_ORDER":
      return {
        title: "Purchase Order Created — Approval Required",
        message: ensureArrowCta(
          poNum
            ? `${actor} has created PO ${poNum}.`
            : `${actor} has created a purchase order.`
        ),
      };

    case "CREATE_INVOICE":
      return {
        title: "Invoice Uploaded — Verification Required",
        message: ensureArrowCta(
          invNum
            ? `${actor} has uploaded invoice ${invNum}.`
            : `${actor} has uploaded an invoice.`
        ),
      };

    case "RETURN_REQUISITION":
      return {
        title: "Requisition Returned",
        message: ensureArrowCta(
          reqNum
            ? `${actor} has returned requisition ${reqNum} for editing.${remarkText}`
            : `${actor} has returned a requisition for editing.${remarkText}`
        ),
      };

    default: {
      let message = replaceLegacyClickHere(input.message);
      if (/^(system|user)\s+has/i.test(message)) {
        message = message.replace(/^(system|user)\s+has/i, `${actor} has`);
      }
      const humanEntity =
        reqNum ??
        poNum ??
        invNum ??
        humanizeDedupeEntity(dedupeKey);
      if (humanEntity && /quote:[0-9a-f-]{36}:confirm_po|req:[0-9a-f-]{36}:send_quote/i.test(message)) {
        message = message
          .replace(/quote:[0-9a-f-]{36}:confirm_po/gi, humanEntity)
          .replace(/req:[0-9a-f-]{36}:send_quote/gi, humanEntity)
          .replace(/send_quote/gi, "Send for Quote");
      }
      return {
        title: input.title,
        message: ensureArrowCta(message, /requires|please|click|approve|verify|review|send/i.test(message)),
      };
    }
  }
}
