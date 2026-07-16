import type { PrismaClient } from "@prisma/client";
import { DELIVERY_NOTE_UPLOADED_STATUSES } from "@/lib/purchase/delivery-note-status";

type Db = Pick<PrismaClient, "deliveryNote">;

export type PendingReceiptDeliveryNoteRow = {
  id: string;
  deliveryNoteNumber: string;
  deliveryDate: Date;
  status: string;
  purchaseOrder: { id: string; poNumber: string } | null;
  vendorQuote: {
    id: string;
    requisition: {
      id: string;
      requisitionNumber: string;
      heading: string;
      vessel: { id: string; name: string; code: string | null };
    };
    vendor: { id: string; name: string; vendorId: string };
  };
};

export async function listPendingReceiptDeliveryNotes(
  db: Db,
  vesselId: string
): Promise<PendingReceiptDeliveryNoteRow[]> {
  const rows = await db.deliveryNote.findMany({
    where: {
      status: { in: [...DELIVERY_NOTE_UPLOADED_STATUSES] },
      receiptConfirmations: { none: {} },
      vendorQuote: {
        requisition: { vesselId },
      },
    },
    select: {
      id: true,
      deliveryNoteNumber: true,
      deliveryDate: true,
      status: true,
      vendorQuote: {
        select: {
          id: true,
          purchaseOrders: {
            take: 1,
            orderBy: { dateOfIssue: "desc" },
            select: { id: true, poNumber: true },
          },
          requisition: {
            select: {
              id: true,
              requisitionNumber: true,
              heading: true,
              vessel: {
                select: { id: true, name: true, code: true },
              },
            },
          },
          vendor: {
            select: { id: true, name: true, vendorId: true },
          },
        },
      },
    },
    orderBy: { deliveryDate: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    deliveryNoteNumber: row.deliveryNoteNumber,
    deliveryDate: row.deliveryDate,
    status: row.status,
    purchaseOrder: row.vendorQuote.purchaseOrders[0] ?? null,
    vendorQuote: {
      id: row.vendorQuote.id,
      requisition: row.vendorQuote.requisition,
      vendor: row.vendorQuote.vendor,
    },
  }));
}

export function serializePendingReceiptDeliveryNote(row: PendingReceiptDeliveryNoteRow) {
  return {
    id: row.id,
    deliveryNoteNumber: row.deliveryNoteNumber,
    deliveryDate: row.deliveryDate.toISOString(),
    status: row.status,
    purchaseOrder: row.purchaseOrder,
    vendorQuote: row.vendorQuote,
  };
}
