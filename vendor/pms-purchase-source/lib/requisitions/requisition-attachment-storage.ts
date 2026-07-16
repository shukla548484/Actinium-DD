import prisma from "@/lib/prisma";
import {
  getGoogleCloudStorageService,
  isGoogleCloudStorageConfigured,
} from "@/lib/google-cloud-storage";
import { isLocalDeployment } from "@/lib/vessel-sync/local-access";
import { getLocalStorageBaseDir, resolveLocalFilePath } from "@/lib/local-file-resolver";
import {
  deleteLocalAttachmentAtUrl,
  newLocalAttachmentId,
  storeLocalAttachmentFromUpload,
} from "@/lib/attachments/save-local-attachment";
import { sanitizePathSegment } from "@/lib/attachments/local-attachment-layout";
import * as fs from "fs/promises";
import * as path from "path";

const MAX_SIZE_BYTES = 150 * 1024 * 1024;
const LOCAL_UPLOAD_DIR = getLocalStorageBaseDir();

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const EXT_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function assertAllowedRequisitionAttachmentMime(
  fileName: string,
  mimeType: string
): string {
  const normalized = mimeType?.trim() || "application/octet-stream";
  if (ALLOWED_MIME_TYPES.has(normalized)) return normalized;
  const lower = fileName.toLowerCase();
  const ext = lower.slice(lower.lastIndexOf("."));
  const mapped = EXT_TO_MIME[ext];
  if (mapped) return mapped;
  throw new Error(
    "Invalid file type. Allowed: PDF, images (JPEG, PNG, GIF, WEBP), Word (.doc, .docx), Excel (.xls, .xlsx)."
  );
}

export function isLocalRequisitionFileUrl(fileUrl: string | null | undefined): boolean {
  return !!fileUrl && (fileUrl.startsWith("local://") || fileUrl.startsWith("/api/files/"));
}

export function toServableRequisitionAttachmentUrl(fileUrl: string): string {
  if (fileUrl.startsWith("local://")) {
    return `/api/requisitions/attachments/local/${fileUrl.slice("local://".length)}`;
  }
  return fileUrl;
}

export async function deleteRequisitionAttachmentFromStorage(
  fileUrl: string | null | undefined
): Promise<void> {
  if (!fileUrl) return;
  if (isLocalRequisitionFileUrl(fileUrl)) {
    try {
      await deleteLocalAttachmentAtUrl(fileUrl);
    } catch (e) {
      console.warn("Local requisition attachment delete failed:", e);
    }
    return;
  }
  if (!fileUrl.includes("storage.googleapis.com") && !fileUrl.includes("storage.cloud.google.com")) {
    return;
  }
  try {
    const gcs = getGoogleCloudStorageService();
    const objectPath = gcs.getPathFromFileUrl(fileUrl);
    if (objectPath) await gcs.deleteFile(objectPath);
  } catch (e) {
    console.warn("GCS delete failed (requisition attachment DB row may still be removed):", e);
  }
}

async function saveRequisitionAttachmentLocally(params: {
  vesselId: string;
  entityId: string;
  subKind: string;
  file: File;
  uploadedByUserId?: string | null;
  attachmentId?: string;
}) {
  const effectiveMime = assertAllowedRequisitionAttachmentMime(params.file.name, params.file.type);
  if (params.file.size > MAX_SIZE_BYTES) {
    throw new Error(`File size must be less than ${MAX_SIZE_BYTES / 1024 / 1024}MB`);
  }

  const stored = await storeLocalAttachmentFromUpload({
    file: params.file,
    module: "requisitions",
    vesselId: params.vesselId,
    entityId: params.entityId,
    attachmentId: params.attachmentId ?? newLocalAttachmentId(),
    uploadedByUserId: params.uploadedByUserId,
    subKind: params.subKind,
  });

  return {
    fileUrl: stored.fileUrl,
    effectiveMime,
    fileSize: params.file.size,
    attachmentId: stored.attachmentId,
  };
}

async function uploadRequisitionAttachmentToGcsCore(params: {
  vesselId: string;
  subfolder: string;
  storagePrefix: string;
  file: File;
}) {
  const effectiveMime = assertAllowedRequisitionAttachmentMime(params.file.name, params.file.type);
  if (params.file.size > MAX_SIZE_BYTES) {
    throw new Error(`File size must be less than ${MAX_SIZE_BYTES / 1024 / 1024}MB`);
  }

  const arrayBuffer = await params.file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  const gcs = getGoogleCloudStorageService();
  const timestamp = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const sanitizedFileName = params.file.name.replace(/[^a-zA-Z0-9.-]/g, "_") || "attachment";
  const storageName = `${params.storagePrefix}_${timestamp}_${sanitizedFileName}`;

  const uploadResult = await gcs.uploadFile(fileBuffer, storageName, effectiveMime, {
    vesselId: params.vesselId,
    category: "purchase",
    subfolder: params.subfolder,
  });

  return {
    fileUrl: uploadResult.publicUrl,
    effectiveMime,
    fileSize: params.file.size,
  };
}

export async function uploadRequisitionItemAttachment(params: {
  requisitionId: string;
  requisitionItemId: string;
  vesselId: string;
  requisitionNumber: string;
  file: File;
}) {
  const subfolder = `requisitions/${params.requisitionId}/items/${params.requisitionItemId}/attachments`;
  const storagePrefix = `REQ_${params.requisitionNumber.replace(/[^a-zA-Z0-9.-]/g, "_")}_ITEM`;

  if (isLocalDeployment() || !isGoogleCloudStorageConfigured()) {
    const local = await saveRequisitionAttachmentLocally({
      vesselId: params.vesselId,
      entityId: params.requisitionItemId,
      subKind: "item",
      file: params.file,
    });
    const attachment = await prisma.requisitionItemAttachment.create({
      data: {
        id: local.attachmentId,
        requisitionItemId: params.requisitionItemId,
        fileName: params.file.name || "attachment",
        mimeType: local.effectiveMime,
        fileSize: local.fileSize,
        fileUrl: local.fileUrl,
        fileData: null,
      },
    });
    return { attachment, fileUrl: local.fileUrl };
  }

  const uploaded = await uploadRequisitionAttachmentToGcsCore({
    vesselId: params.vesselId,
    subfolder,
    storagePrefix,
    file: params.file,
  });

  const attachment = await prisma.requisitionItemAttachment.create({
    data: {
      requisitionItemId: params.requisitionItemId,
      fileName: params.file.name || "attachment",
      mimeType: uploaded.effectiveMime,
      fileSize: uploaded.fileSize,
      fileUrl: uploaded.fileUrl,
      fileData: null,
    },
  });

  return { attachment, fileUrl: uploaded.fileUrl };
}

export async function uploadRequisitionDrawingAttachment(params: {
  requisitionId?: string | null;
  vesselId?: string | null;
  requisitionNumber?: string | null;
  uploadedById: string;
  file: File;
}) {
  const reqSegment = params.requisitionId ?? "draft";
  const subfolder = `requisitions/${reqSegment}/drawings`;
  const storagePrefix = params.requisitionNumber
    ? `REQ_${params.requisitionNumber.replace(/[^a-zA-Z0-9.-]/g, "_")}_DRAWING`
    : "REQ_DRAFT_DRAWING";

  if (isLocalDeployment() || !isGoogleCloudStorageConfigured()) {
    const entityId = params.requisitionId ?? `draft_${sanitizePathSegment(params.uploadedById)}`;
    const local = await saveRequisitionAttachmentLocally({
      vesselId: params.vesselId || "",
      entityId,
      subKind: "drawing",
      file: params.file,
      uploadedByUserId: params.uploadedById,
    });
    const attachment = await prisma.requisitionDrawingAttachment.create({
      data: {
        id: local.attachmentId,
        requisitionId: params.requisitionId ?? null,
        fileName: params.file.name || "drawing",
        mimeType: local.effectiveMime,
        fileSize: local.fileSize,
        fileUrl: local.fileUrl,
        fileData: null,
        uploadedById: params.uploadedById,
      },
    });
    return { attachment, fileUrl: local.fileUrl };
  }

  const uploaded = await uploadRequisitionAttachmentToGcsCore({
    vesselId: params.vesselId || "",
    subfolder,
    storagePrefix,
    file: params.file,
  });

  const attachment = await prisma.requisitionDrawingAttachment.create({
    data: {
      requisitionId: params.requisitionId ?? null,
      fileName: params.file.name || "drawing",
      mimeType: uploaded.effectiveMime,
      fileSize: uploaded.fileSize,
      fileUrl: uploaded.fileUrl,
      fileData: null,
      uploadedById: params.uploadedById,
    },
  });

  return { attachment, fileUrl: uploaded.fileUrl };
}
