import { readPurchaseUploadJsonResponse } from "@/lib/purchase/purchase-upload-response-client";

export type DeliveryNoteUploadInput = {
  file: File;
  purchaseOrderId: string;
  quoteId: string;
  deliveryNoteNumber: string;
  deliveryDate: string;
  notes?: string;
};

export type DeliveryNoteUploadResult = {
  deliveryNote: {
    id: string;
    deliveryNoteNumber: string;
    fileUrl: string;
    fileName: string;
  };
};

async function uploadDeliveryNoteInline(
  input: DeliveryNoteUploadInput
): Promise<DeliveryNoteUploadResult> {
  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("purchaseOrderId", input.purchaseOrderId);
  formData.append("quoteId", input.quoteId);
  formData.append("deliveryNoteNumber", input.deliveryNoteNumber);
  formData.append("deliveryDate", input.deliveryDate);
  if (input.notes?.trim()) {
    formData.append("notes", input.notes.trim());
  }

  const response = await fetch("/api/delivery-notes/upload", {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const data = await readPurchaseUploadJsonResponse(response);
  if (!response.ok) {
    throw new Error(String(data.error || "Failed to upload delivery note"));
  }

  return data as DeliveryNoteUploadResult;
}

/** Upload a delivery note PDF (direct to GCS on office, inline on ship/local). */
export async function uploadDeliveryNote(
  input: DeliveryNoteUploadInput
): Promise<DeliveryNoteUploadResult> {
  if (input.file.type !== "application/pdf") {
    throw new Error("Only PDF files are allowed");
  }

  const urlResponse = await fetch("/api/delivery-notes/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      purchaseOrderId: input.purchaseOrderId,
      quoteId: input.quoteId,
      deliveryNoteNumber: input.deliveryNoteNumber,
      deliveryDate: input.deliveryDate,
      notes: input.notes?.trim() || undefined,
      fileName: input.file.name,
      fileSize: input.file.size,
    }),
  });

  const urlData = await readPurchaseUploadJsonResponse(urlResponse);
  if (!urlResponse.ok) {
    throw new Error(String(urlData.error || "Failed to prepare delivery note upload"));
  }

  if (urlData.useInlineUpload === true) {
    return uploadDeliveryNoteInline(input);
  }

  const uploadUrl = String(urlData.uploadUrl || "");
  const mimeType = String(urlData.mimeType || "application/pdf");
  const fileUrl = String(urlData.fileUrl || "");
  const fileName = String(urlData.fileName || input.file.name);
  const gcsPath = String(urlData.gcsPath || "");

  if (!uploadUrl || !fileUrl || !gcsPath) {
    throw new Error("Invalid upload URL response from server");
  }

  const putResponse = await fetch(uploadUrl, {
    method: "PUT",
    body: input.file,
    headers: { "Content-Type": mimeType },
  });

  if (!putResponse.ok) {
    throw new Error("Failed to upload file to cloud storage");
  }

  const finalizeResponse = await fetch("/api/delivery-notes/finalize-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      purchaseOrderId: input.purchaseOrderId,
      quoteId: input.quoteId,
      deliveryNoteNumber: input.deliveryNoteNumber,
      deliveryDate: input.deliveryDate,
      notes: input.notes?.trim() || undefined,
      fileUrl,
      fileName,
      gcsPath,
      fileSize: input.file.size,
    }),
  });

  const finalizeData = await readPurchaseUploadJsonResponse(finalizeResponse);
  if (!finalizeResponse.ok) {
    throw new Error(
      String(finalizeData.error || finalizeData.details || "Failed to finalize delivery note upload")
    );
  }

  return finalizeData as DeliveryNoteUploadResult;
}
