import { NextResponse } from "next/server";

const MIME_TYPE_MAP: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function mimeTypeFromInvoiceFileName(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return MIME_TYPE_MAP[ext] || "application/octet-stream";
}

export function invoiceFileDownloadResponse(
  buffer: Buffer,
  fileName: string,
  options?: { inline?: boolean }
): NextResponse {
  const safeName = fileName.replace(/"/g, "") || "invoice";
  const contentType = mimeTypeFromInvoiceFileName(safeName);
  const body = new Uint8Array(buffer);
  const disposition = options?.inline === false ? "attachment" : "inline";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename="${safeName}"`,
      "Content-Length": body.byteLength.toString(),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
