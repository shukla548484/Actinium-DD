import prisma from "@/lib/prisma";
import {
  getGoogleCloudStorageService,
  isGoogleCloudStorageConfigured,
} from "@/lib/google-cloud-storage";
import { isLocalDeployment } from "@/lib/vessel-sync/local-access";
import {
  assertAllowedRequisitionAttachmentMime,
} from "@/lib/requisitions/requisition-attachment-storage";
import { toServableClarificationAttachmentUrl } from "@/lib/procurement/clarification-attachment-url";
import { storeLocalAttachmentFromUpload } from "@/lib/attachments/save-local-attachment";
import type { ClarificationAttachmentRole } from "@prisma/client";

const MAX_SIZE_BYTES = 150 * 1024 * 1024;

export async function uploadClarificationAttachment(params: {
  clarificationRequestId: string;
  requisitionId: string;
  vesselId: string;
  role: ClarificationAttachmentRole;
  uploadedByType: "VENDOR" | "VESSEL" | "OFFICE";
  uploadedById?: string | null;
  file: File;
}) {
  if (params.file.size > MAX_SIZE_BYTES) {
    throw new Error("File size must be less than 150MB");
  }
  const effectiveMime = assertAllowedRequisitionAttachmentMime(
    params.file.name,
    params.file.type
  );

  let fileUrl: string;

  if (isLocalDeployment() || !isGoogleCloudStorageConfigured()) {
    const local = await storeLocalAttachmentFromUpload({
      file: params.file,
      module: "purchase",
      vesselId: params.vesselId,
      entityId: params.clarificationRequestId,
      subKind: `clarification-${params.role.toLowerCase()}`,
    });
    fileUrl = local.fileUrl;
  } else {
    const arrayBuffer = await params.file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const gcs = getGoogleCloudStorageService();
    const timestamp = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const sanitized = params.file.name.replace(/[^a-zA-Z0-9.-]/g, "_") || "attachment";
    const storageName = `CLAR_${params.role}_${timestamp}_${sanitized}`;
    const uploadResult = await gcs.uploadFile(fileBuffer, storageName, effectiveMime, {
      vesselId: params.vesselId,
      category: "purchase",
      subfolder: `requisitions/${params.requisitionId}/clarifications/${params.clarificationRequestId}`,
    });
    fileUrl = uploadResult.publicUrl;
  }

  const attachment = await prisma.rfqClarificationAttachment.create({
    data: {
      clarificationRequestId: params.clarificationRequestId,
      role: params.role,
      fileName: params.file.name || "attachment",
      mimeType: effectiveMime,
      fileSize: params.file.size,
      fileUrl,
      uploadedByType: params.uploadedByType,
      uploadedById: params.uploadedById ?? null,
    },
  });

  return {
    ...attachment,
    fileUrl: toServableClarificationAttachmentUrl({
      attachmentId: attachment.id,
      fileUrl,
      view: "office",
    }),
  };
}
