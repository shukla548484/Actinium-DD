/**
 * Outbound Purchase Order emails via Resend (po@actinium-sm.com).
 * Separate from Gmail two-way requisition/quote flow.
 */

import { Resend } from "resend";

export const PURCHASE_ORDER_FROM_EMAIL =
  process.env.PURCHASE_ORDER_FROM_EMAIL?.trim() || "po@actinium-sm.com";
export const PURCHASE_ORDER_FROM_NAME =
  process.env.PURCHASE_ORDER_FROM_NAME?.trim() || "Actinium Purchase Orders";

export type PurchaseOrderAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type PurchaseOrderSendResult = {
  messageId: string;
};

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured. Purchase Order emails require Resend."
    );
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export function isPurchaseOrderResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function purchaseOrderFromAddress(): string {
  return `${PURCHASE_ORDER_FROM_NAME} <${PURCHASE_ORDER_FROM_EMAIL}>`;
}

function parseAdditionalCc(additionalCc?: string | string[] | null): string[] {
  if (!additionalCc) return [];
  if (Array.isArray(additionalCc)) {
    return additionalCc.map((e) => e.trim()).filter(Boolean);
  }
  return additionalCc
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

/** Sender email is always included in CC (mandatory). */
export function buildPurchaseOrderEmailCc(opts: {
  senderEmail: string;
  additionalCc?: string | string[] | null;
  vendorSecondaryEmail?: string | null;
}): string[] {
  const sender = opts.senderEmail?.trim();
  if (!sender) {
    throw new Error(
      "Your account email is required. Every PO email CCs the user who sends it."
    );
  }

  const extras = [
    ...parseAdditionalCc(opts.additionalCc),
    ...(opts.vendorSecondaryEmail?.trim() ? [opts.vendorSecondaryEmail.trim()] : []),
  ];

  return Array.from(new Set([sender, ...extras]));
}

export async function sendPurchaseOrderEmail(opts: {
  to: string;
  cc: string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: PurchaseOrderAttachment[];
}): Promise<PurchaseOrderSendResult> {
  const to = opts.to.trim();
  if (!to) {
    throw new Error("Vendor email (to) is required");
  }

  const ccList = opts.cc.map((e) => e.trim()).filter(Boolean);
  if (ccList.length === 0) {
    throw new Error("CC list must include the sender email");
  }

  const attachments = opts.attachments?.map((a) => ({
    filename: a.filename,
    content: a.content,
    contentType: a.contentType ?? "application/pdf",
  }));

  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: purchaseOrderFromAddress(),
    to,
    cc: ccList,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    attachments,
  });

  if (error) {
    throw new Error(error.message || "Resend send failed");
  }
  if (!data?.id) {
    throw new Error("Resend send returned no message id");
  }

  return { messageId: data.id };
}
