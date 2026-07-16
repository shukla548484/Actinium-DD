import * as fs from "fs/promises";
import * as path from "path";
import {
  getGoogleCloudStorageService,
  isGoogleCloudStorageConfigured,
} from "@/lib/google-cloud-storage";
import { isLocalDeployment } from "@/lib/vessel-sync/local-access";
import { getLocalStorageBaseDir } from "@/lib/local-file-resolver";
import {
  newLocalAttachmentId,
  storeLocalAttachmentBuffer,
} from "@/lib/attachments/save-local-attachment";
import { sanitizePathSegment } from "@/lib/attachments/local-attachment-layout";
import { resolveInvoiceFileContentType } from "@/lib/invoice-file-upload";

import { MAX_PURCHASE_ATTACHMENT_BYTES } from "@/lib/purchase/purchase-file-limits";

const MAX_SIZE_BYTES = MAX_PURCHASE_ATTACHMENT_BYTES;
const LOCAL_UPLOAD_DIR = getLocalStorageBaseDir();

export type PurchaseFileInput = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  size: number;
};

export async function purchaseFileInputFromUpload(file: File): Promise<PurchaseFileInput> {
  const arrayBuffer = await file.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    fileName: file.name,
    mimeType: resolveInvoiceFileContentType(file),
    size: file.size,
  };
}

function useLocalPurchaseStorage(): boolean {
  return isLocalDeployment() || !isGoogleCloudStorageConfigured();
}

export async function uploadPurchaseFileToStorage(params: {
  file: PurchaseFileInput;
  vesselId?: string | null;
  category?: "purchase" | "invoices";
  subfolder: string;
  storageFileName?: string;
  entityId?: string;
  attachmentId?: string;
  uploadedByUserId?: string | null;
  subKind?: string | null;
}): Promise<{ fileUrl: string; mimeType: string; fileName: string; attachmentId?: string }> {
  if (params.file.size > MAX_SIZE_BYTES) {
    throw new Error(`File size must be less than ${MAX_SIZE_BYTES / 1024 / 1024}MB`);
  }

  const mimeType = params.file.mimeType;
  const entityId =
    params.entityId?.trim() ||
    sanitizePathSegment(params.subfolder.replace(/\//g, "_"));
  const subKind =
    params.subKind?.trim() ||
    params.category ||
    "purchase";

  if (useLocalPurchaseStorage()) {
    const attachmentId = params.attachmentId ?? newLocalAttachmentId();
    const stored = await storeLocalAttachmentBuffer({
      buffer: params.file.buffer,
      pathParams: {
        module: "purchase",
        vesselId: params.vesselId || "",
        entityId,
        attachmentId,
        originalFileName: params.file.fileName,
        uploadedByUserId: params.uploadedByUserId,
        subKind,
      },
    });
    return {
      fileUrl: stored.fileUrl,
      mimeType,
      fileName: params.file.fileName,
      attachmentId: stored.attachmentId,
    };
  }

  const timestamp = Date.now();
  const sanitized = params.file.fileName.replace(/[^a-zA-Z0-9.-]/g, "_") || "document";
  const storageName = params.storageFileName || `${timestamp}-${sanitized}`;
  const category = params.category || "purchase";
  const gcs = getGoogleCloudStorageService();
  const uploadResult = await gcs.uploadFile(
    params.file.buffer,
    storageName,
    mimeType,
    {
      vesselId: params.vesselId || undefined,
      category,
      subfolder: params.subfolder,
    }
  );

  return {
    fileUrl: uploadResult.fileUrl,
    mimeType,
    fileName: params.file.fileName,
  };
}
