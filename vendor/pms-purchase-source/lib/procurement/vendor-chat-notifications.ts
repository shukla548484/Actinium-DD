import "server-only";

import prisma from "@/lib/prisma";
import { getNotificationRecipientIds } from "@/lib/notification-recipient-policy";
import {
  INVOICE_UPLOADER_ACCESS_LEVELS,
  INVOICE_VERIFIER_ACCESS_LEVELS,
} from "@/lib/purchase/invoice-access";

export const VENDOR_CHAT_REPLY_OPERATION = "VENDOR_CHAT_REPLY";

const OFFICE_CHAT_ACCESS_LEVELS = [
  ...INVOICE_UPLOADER_ACCESS_LEVELS,
  ...INVOICE_VERIFIER_ACCESS_LEVELS,
  50,
  99,
  100,
];

function messagePreview(text: string, max = 120): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 3)}...`;
}

function invoiceVendorReplyActionUrl(purchaseOrderId: string): string {
  const params = new URLSearchParams({ openVendorReply: purchaseOrderId });
  return `/purchase/invoices?${params.toString()}`;
}

export async function notifyOfficeVendorChatReply(params: {
  purchaseOrderId: string;
  poNumber: string;
  messageId: string;
  messagePreview: string;
  vendorName: string;
  vesselId?: string | null;
  companyId?: string | null;
}): Promise<{ created: number }> {
  try {
    const recipientIds = await getNotificationRecipientIds({
      moduleNames: ["Purchase"],
      accessLevels: OFFICE_CHAT_ACCESS_LEVELS,
      vesselId: params.vesselId ?? null,
      companyId: params.companyId ?? null,
    });

    if (recipientIds.length === 0) return { created: 0 };

    const preview = messagePreview(params.messagePreview);
    const title = "Vendor reply received";
    const message = `${params.vendorName} replied on PO ${params.poNumber}${
      preview ? `: ${preview}` : "."
    }`;

    await prisma.operationNotification.createMany({
      data: recipientIds.map((userId) => ({
        title,
        message,
        type: "COMMENT_ADDED",
        operation: VENDOR_CHAT_REPLY_OPERATION,
        entityType: "PurchaseOrder",
        entityId: params.purchaseOrderId,
        userId,
        isRead: false,
        metadata: {
          actionUrl: invoiceVendorReplyActionUrl(params.purchaseOrderId),
          poId: params.purchaseOrderId,
          poNumber: params.poNumber,
          messageId: params.messageId,
          vendorName: params.vendorName,
          vesselId: params.vesselId ?? undefined,
          dedupeKey: `vendor-chat:${params.messageId}`,
        },
      })),
    });

    return { created: recipientIds.length };
  } catch (error) {
    console.error(`[${VENDOR_CHAT_REPLY_OPERATION}]`, error);
    return { created: 0 };
  }
}
