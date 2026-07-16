import "server-only";

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getGoogleCloudStorageService,
  isGoogleCloudStorageConfigured,
  prefixGcsPath,
} from "@/lib/google-cloud-storage";
import { isLocalDeployment } from "@/lib/vessel-sync/local-access";
import { notifyOnboardReceiptPending } from "@/lib/procurement/approval-notifications";

import { MAX_PURCHASE_ATTACHMENT_BYTES } from "@/lib/purchase/purchase-file-limits";

export const MAX_DN_FILE_SIZE_BYTES = MAX_PURCHASE_ATTACHMENT_BYTES;

export { canUserUploadDeliveryNote } from "@/lib/purchase/delivery-note-upload-access";

export function shouldUseDirectGcsDeliveryNoteUpload(): boolean {
  return !isLocalDeployment() && isGoogleCloudStorageConfigured();
}

export function buildDeliveryNoteStorageFileName(
  poNumber: string,
  deliveryNoteNumber: string
): string {
  return `DN_${poNumber}_${deliveryNoteNumber}_${Date.now()}.pdf`;
}

export function buildPurchaseDeliveryNoteGcsPath(params: {
  vesselId: string;
  requisitionId: string;
  purchaseOrderId: string;
  storageFileName: string;
}): { gcsPath: string; fileUrl: string; bucketName: string } {
  const timestamp = Date.now();
  const sanitized = params.storageFileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const folderPath = `vessels/${params.vesselId}/purchase/delivery-notes/${params.requisitionId}/${params.purchaseOrderId}`;
  const gcsPath = prefixGcsPath(`${folderPath}/${timestamp}-${sanitized}`);
  const bucketName = process.env.GCS_BUCKET_NAME || "actinium_sm";
  const fileUrl = `https://storage.googleapis.com/${bucketName}/${gcsPath}`;
  return { gcsPath, fileUrl, bucketName };
}

export type DeliveryNoteUploadContext = {
  purchaseOrderId: string;
  quoteId: string;
  deliveryNoteNumber: string;
  deliveryDate: string;
  notes?: string | null;
};

export async function loadPurchaseOrderForDeliveryNoteUpload(
  purchaseOrderId: string,
  quoteId: string
) {
  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: {
      requisition: {
        include: {
          vessel: true,
        },
      },
      quote: {
        include: {
          vendor: true,
        },
      },
    },
  });

  if (!purchaseOrder) {
    return { error: "Purchase order not found" as const };
  }

  if (purchaseOrder.quoteId !== quoteId) {
    return { error: "Quote ID does not match purchase order" as const };
  }

  return { purchaseOrder };
}

export async function upsertDeliveryNoteAfterUpload(params: {
  request: NextRequest;
  actorUserId: string;
  quoteId: string;
  vendorId: string;
  purchaseOrder: {
    poNumber: string;
    requisition: {
      id: string;
      vesselId: string;
      requisitionNumber: string;
      vessel?: { companyId: string | null } | null;
    };
  };
  input: DeliveryNoteUploadContext;
  fileUrl: string;
  fileName: string;
  fileSize: number;
}) {
  const { input, purchaseOrder, quoteId, vendorId, actorUserId, request } =
    params;

  const existingDN = await prisma.deliveryNote.findFirst({
    where: {
      vendorQuoteId: quoteId,
      deliveryNoteNumber: input.deliveryNoteNumber,
    },
  });

  const wasReUpload = Boolean(existingDN);
  const wasRejectedReUpload = existingDN?.status === "REJECTED";
  const acceptedAt = new Date();

  const deliveryNote = existingDN
    ? await prisma.deliveryNote.update({
        where: { id: existingDN.id },
        data: {
          deliveryDate: new Date(input.deliveryDate),
          googleDriveFileId: params.fileUrl,
          googleDriveFileName: params.fileName,
          fileMimeType: "application/pdf",
          fileSize: BigInt(params.fileSize),
          uploadedAt: acceptedAt,
          status: "VERIFIED",
          verifiedAt: acceptedAt,
          verifiedBy: actorUserId,
          notes: input.notes?.trim() || existingDN.notes,
        },
      })
    : await prisma.deliveryNote.create({
        data: {
          deliveryNoteNumber: input.deliveryNoteNumber,
          vendorQuoteId: quoteId,
          vendorId,
          deliveryDate: new Date(input.deliveryDate),
          googleDriveFileId: params.fileUrl,
          googleDriveFileName: params.fileName,
          fileMimeType: "application/pdf",
          fileSize: BigInt(params.fileSize),
          status: "VERIFIED",
          verifiedAt: acceptedAt,
          verifiedBy: actorUserId,
          notes: input.notes?.trim() || null,
        },
      });

  try {
    await notifyOnboardReceiptPending({
      request,
      actorUserId,
      vesselId: purchaseOrder.requisition.vesselId,
      companyId: purchaseOrder.requisition.vessel?.companyId ?? null,
      requisitionNumber: purchaseOrder.requisition.requisitionNumber,
      purchaseOrderNumber: purchaseOrder.poNumber,
      deliveryNoteId: deliveryNote.id,
      deliveryNoteNumber: deliveryNote.deliveryNoteNumber,
      metadata: {
        requisitionId: purchaseOrder.requisition.id,
        quoteId,
        reUploaded: wasRejectedReUpload || wasReUpload,
      },
    });
  } catch (notifyErr) {
    console.error("Onboard receipt pending notification failed:", notifyErr);
  }

  return deliveryNote;
}

export async function verifyDeliveryNoteGcsUpload(gcsPath: string): Promise<boolean> {
  const gcs = getGoogleCloudStorageService();
  return gcs.fileExists(gcsPath);
}
