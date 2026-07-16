import { isAllowedInvoiceFile } from "@/lib/invoice-file-upload";
import { readPurchaseUploadJsonResponse } from "@/lib/purchase/purchase-upload-response-client";

export type InvoiceUploadInput = {
  file: File;
  ownerApprovalFile?: File | null;
  purchaseOrderId?: string;
  contractId?: string;
  vesselId?: string;
  requisitionNumber?: string;
  poNumber?: string;
  invoiceNumber: string;
  invoiceAmount: string;
  invoiceCurrency: string;
  invoiceDate: string;
  accountType: string;
  remarks?: string;
};

export type InvoiceUploadResult = {
  success?: boolean;
  invoice: Record<string, unknown>;
  autoCreatedPurchaseOrder?: { id: string; poNumber: string };
};

export type InvoiceFileUploadResult = {
  fileUrl: string;
  gcsPath: string;
  fileName: string;
  mimeType: string;
};

async function uploadInvoiceInline(input: InvoiceUploadInput): Promise<InvoiceUploadResult> {
  const formData = new FormData();
  if (input.contractId) {
    formData.append("contractId", input.contractId);
    if (input.vesselId) formData.append("vesselId", input.vesselId);
  } else if (input.purchaseOrderId) {
    formData.append("purchaseOrderId", input.purchaseOrderId);
  }
  if (input.requisitionNumber) formData.append("requisitionNumber", input.requisitionNumber);
  if (input.poNumber) formData.append("poNumber", input.poNumber);
  formData.append("invoiceNumber", input.invoiceNumber);
  formData.append("invoiceAmount", input.invoiceAmount);
  formData.append("invoiceCurrency", input.invoiceCurrency);
  formData.append("invoiceDate", input.invoiceDate);
  formData.append("accountType", input.accountType);
  if (input.remarks?.trim()) {
    formData.append("remarks", input.remarks.trim());
  }
  formData.append("invoiceFile", input.file);
  if (input.ownerApprovalFile) {
    formData.append("ownerApprovalFile", input.ownerApprovalFile);
  }

  const response = await fetch("/api/invoices/upload", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const data = await readPurchaseUploadJsonResponse(response);
  if (!response.ok) {
    throw new Error(String(data.error || data.details || "Failed to upload invoice"));
  }
  return data as InvoiceUploadResult;
}

async function uploadAttachmentToStorage(params: {
  file: File;
  purchaseOrderId: string;
  invoiceNumber: string;
  endpoint: "/api/invoices/file-upload-url" | "/api/invoices/owner-approval-upload-url";
}): Promise<InvoiceFileUploadResult> {
  const fileCheck = isAllowedInvoiceFile(params.file);
  if (!fileCheck.ok) {
    throw new Error(fileCheck.error || "Invalid file");
  }

  const urlResponse = await fetch(params.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      purchaseOrderId: params.purchaseOrderId,
      invoiceNumber: params.invoiceNumber,
      fileName: params.file.name,
      fileSize: params.file.size,
    }),
  });

  const urlData = await readPurchaseUploadJsonResponse(urlResponse);
  if (!urlResponse.ok) {
    throw new Error(String(urlData.error || "Failed to prepare file upload"));
  }

  if (urlData.useInlineUpload === true) {
    throw new Error("Direct file upload is not available in this environment");
  }

  const uploadUrl = String(urlData.uploadUrl || "");
  const mimeType = String(urlData.mimeType || params.file.type || "application/octet-stream");
  const fileUrl = String(urlData.fileUrl || "");
  const fileName = String(urlData.fileName || params.file.name);
  const gcsPath = String(urlData.gcsPath || "");

  if (!uploadUrl || !fileUrl || !gcsPath) {
    throw new Error("Invalid upload URL response from server");
  }

  const putResponse = await fetch(uploadUrl, {
    method: "PUT",
    body: params.file,
    headers: { "Content-Type": mimeType },
  });
  if (!putResponse.ok) {
    throw new Error("Failed to upload file to cloud storage");
  }

  return { fileUrl, gcsPath, fileName, mimeType };
}

/** Upload only the invoice file to GCS (for edit flows). */
export async function uploadInvoiceFileToStorage(params: {
  file: File;
  purchaseOrderId: string;
  invoiceNumber: string;
}): Promise<InvoiceFileUploadResult> {
  return uploadAttachmentToStorage({
    ...params,
    endpoint: "/api/invoices/file-upload-url",
  });
}

/** Upload owner approval attachment to GCS (upload or edit flows). */
export async function uploadOwnerApprovalFileToStorage(params: {
  file: File;
  purchaseOrderId: string;
  invoiceNumber: string;
}): Promise<InvoiceFileUploadResult> {
  return uploadAttachmentToStorage({
    ...params,
    endpoint: "/api/invoices/owner-approval-upload-url",
  });
}

/** Upload invoice with attachment (direct to GCS on office, inline on ship/local). */
export async function uploadInvoice(input: InvoiceUploadInput): Promise<InvoiceUploadResult> {
  const fileCheck = isAllowedInvoiceFile(input.file);
  if (!fileCheck.ok) {
    throw new Error(fileCheck.error || "Invalid invoice file");
  }

  if (input.ownerApprovalFile) {
    const ownerCheck = isAllowedInvoiceFile(input.ownerApprovalFile);
    if (!ownerCheck.ok) {
      throw new Error(ownerCheck.error || "Invalid owner approval file");
    }
  }

  const urlResponse = await fetch("/api/invoices/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      purchaseOrderId: input.purchaseOrderId,
      contractId: input.contractId,
      vesselId: input.vesselId,
      requisitionNumber: input.requisitionNumber,
      poNumber: input.poNumber,
      invoiceNumber: input.invoiceNumber,
      invoiceAmount: input.invoiceAmount,
      invoiceCurrency: input.invoiceCurrency,
      accountType: input.accountType,
      remarks: input.remarks?.trim() || undefined,
      fileName: input.file.name,
      fileSize: input.file.size,
    }),
  });

  const urlData = await readPurchaseUploadJsonResponse(urlResponse);
  if (!urlResponse.ok) {
    throw new Error(String(urlData.error || urlData.details || "Failed to prepare invoice upload"));
  }

  if (urlData.useInlineUpload === true) {
    return uploadInvoiceInline({
      ...input,
      purchaseOrderId:
        input.purchaseOrderId || String(urlData.purchaseOrderId || ""),
    });
  }

  const uploadUrl = String(urlData.uploadUrl || "");
  const mimeType = String(urlData.mimeType || input.file.type || "application/octet-stream");
  const fileUrl = String(urlData.fileUrl || "");
  const gcsPath = String(urlData.gcsPath || "");
  const purchaseOrderId = String(urlData.purchaseOrderId || input.purchaseOrderId || "");

  if (!uploadUrl || !fileUrl || !gcsPath || !purchaseOrderId) {
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

  let ownerApprovalFileUrl: string | undefined;
  let ownerApprovalFileName: string | undefined;
  if (input.ownerApprovalFile) {
    try {
      const ownerUploaded = await uploadOwnerApprovalFileToStorage({
        file: input.ownerApprovalFile,
        purchaseOrderId,
        invoiceNumber: input.invoiceNumber,
      });
      ownerApprovalFileUrl = ownerUploaded.fileUrl;
      ownerApprovalFileName = input.ownerApprovalFile.name;
    } catch (ownerError) {
      const message =
        ownerError instanceof Error ? ownerError.message : "Failed to upload owner approval";
      if (!message.includes("not available in this environment")) {
        throw ownerError;
      }
      return uploadInvoiceInline({
        ...input,
        purchaseOrderId,
      });
    }
  }

  const finalizeResponse = await fetch("/api/invoices/finalize-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      purchaseOrderId,
      contractId: input.contractId,
      invoiceNumber: input.invoiceNumber,
      invoiceAmount: input.invoiceAmount,
      invoiceCurrency: input.invoiceCurrency,
      invoiceDate: input.invoiceDate,
      accountType: input.accountType,
      remarks: input.remarks?.trim() || undefined,
      ownerApprovalFileUrl,
      ownerApprovalFileName,
      fileUrl,
      gcsPath,
      autoCreatedPurchaseOrder: urlData.autoCreatedPurchaseOrder,
    }),
  });

  const finalizeData = await readPurchaseUploadJsonResponse(finalizeResponse);
  if (!finalizeResponse.ok) {
    throw new Error(
      String(finalizeData.error || finalizeData.details || "Failed to finalize invoice upload")
    );
  }

  return finalizeData as InvoiceUploadResult;
}
