/** Allowed invoice attachment types on Purchase → Invoices upload. */

import { MAX_PURCHASE_ATTACHMENT_BYTES } from "@/lib/purchase/purchase-file-limits";

export const INVOICE_FILE_MAX_BYTES = MAX_PURCHASE_ATTACHMENT_BYTES;

export const INVOICE_FILE_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif," +
  "application/pdf,application/msword," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "application/vnd.ms-excel," +
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet," +
  "image/jpeg,image/png,image/webp,image/gif";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const EXTENSION_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export function invoiceFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? (parts.pop()?.toLowerCase() ?? "") : "";
}

export function resolveInvoiceFileContentType(file: File): string {
  const ext = invoiceFileExtension(file.name);
  if (file.type && ALLOWED_MIME_TYPES.has(file.type)) {
    return file.type;
  }
  return EXTENSION_MIME[ext] ?? (file.type || "application/octet-stream");
}

export function isAllowedInvoiceFile(file: File): { ok: boolean; error?: string } {
  if (!file || file.size === 0) {
    return { ok: false, error: "Please select a file" };
  }
  if (file.size > INVOICE_FILE_MAX_BYTES) {
    return { ok: false, error: `File must be ${MAX_PURCHASE_ATTACHMENT_BYTES / 1024 / 1024} MB or smaller` };
  }
  const ext = invoiceFileExtension(file.name);
  const mime = resolveInvoiceFileContentType(file);
  const extOk = ext in EXTENSION_MIME;
  const mimeOk = ALLOWED_MIME_TYPES.has(mime);
  if (!extOk && !mimeOk) {
    return {
      ok: false,
      error: "Allowed formats: PDF, Word (.doc, .docx), Excel (.xls, .xlsx), and images (JPG, PNG, WEBP, GIF)",
    };
  }
  return { ok: true };
}
