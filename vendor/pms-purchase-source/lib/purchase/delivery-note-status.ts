/** Statuses that count as a delivery note uploaded (invoice upload, receipt, etc.). */
export const DELIVERY_NOTE_UPLOADED_STATUSES = ["UPLOADED", "VERIFIED"] as const;

export type DeliveryNoteUploadedStatus = (typeof DELIVERY_NOTE_UPLOADED_STATUSES)[number];

export function isDeliveryNoteUploaded(status: string | null | undefined): boolean {
  return (
    status != null &&
    (DELIVERY_NOTE_UPLOADED_STATUSES as readonly string[]).includes(status)
  );
}

export const DELIVERY_NOTE_UPLOADED_STATUS_FILTER = {
  status: { in: [...DELIVERY_NOTE_UPLOADED_STATUSES] },
} as const;
