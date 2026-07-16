/** Shared purchase attachment size limits (DN + invoice). */
export const MAX_PURCHASE_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export function formatPurchaseAttachmentMaxSizeMb(): string {
  return `${MAX_PURCHASE_ATTACHMENT_BYTES / 1024 / 1024} MB`;
}
