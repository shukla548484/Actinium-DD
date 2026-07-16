import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import {
  MAX_DN_FILE_SIZE_BYTES,
  buildDeliveryNoteStorageFileName,
  buildPurchaseDeliveryNoteGcsPath,
  loadPurchaseOrderForDeliveryNoteUpload,
  shouldUseDirectGcsDeliveryNoteUpload,
} from "@/lib/purchase/delivery-note-upload";
import {
  canUserUploadDeliveryNote,
  DN_UPLOAD_ACCESS_DENIED_MESSAGE,
} from "@/lib/purchase/delivery-note-upload-access";
import { getGoogleCloudStorageService } from "@/lib/google-cloud-storage";

export const maxDuration = 30;

/**
 * POST /api/delivery-notes/upload-url
 * Phase 1: signed GCS URL so the PDF bypasses the serverless body limit (Vercel ~4.5 MB).
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userAccessLevel = currentUser.designationAccessLevel || 0;
    if (!canUserUploadDeliveryNote(userAccessLevel)) {
      return NextResponse.json({ error: DN_UPLOAD_ACCESS_DENIED_MESSAGE }, { status: 403 });
    }

    const body = await request.json();
    const purchaseOrderId = String(body.purchaseOrderId || "").trim();
    const quoteId = String(body.quoteId || "").trim();
    const deliveryNoteNumber = String(body.deliveryNoteNumber || "").trim();
    const deliveryDate = String(body.deliveryDate || "").trim();
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;
    const fileName = String(body.fileName || "").trim();

    if (!purchaseOrderId || !quoteId || !deliveryNoteNumber || !deliveryDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!fileName.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
    }

    if (fileSize <= 0) {
      return NextResponse.json({ error: "Invalid file size" }, { status: 400 });
    }

    if (fileSize > MAX_DN_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `File size must be less than ${MAX_DN_FILE_SIZE_BYTES / 1024 / 1024}MB`,
        },
        { status: 413 }
      );
    }

    const loaded = await loadPurchaseOrderForDeliveryNoteUpload(
      purchaseOrderId,
      quoteId
    );
    if ("error" in loaded) {
      return NextResponse.json({ error: loaded.error }, { status: 404 });
    }

    if (!shouldUseDirectGcsDeliveryNoteUpload()) {
      return NextResponse.json({ useInlineUpload: true });
    }

    const { purchaseOrder } = loaded;
    const storageFileName = buildDeliveryNoteStorageFileName(
      purchaseOrder.poNumber,
      deliveryNoteNumber
    );
    const { gcsPath, fileUrl } = buildPurchaseDeliveryNoteGcsPath({
      vesselId: purchaseOrder.requisition.vesselId,
      requisitionId: purchaseOrder.requisitionId,
      purchaseOrderId: purchaseOrder.id,
      storageFileName,
    });

    const gcs = getGoogleCloudStorageService();
    const uploadUrl = await gcs.getSignedUploadUrl(gcsPath, "application/pdf", 15);

    return NextResponse.json({
      uploadUrl,
      gcsPath,
      fileUrl,
      fileName: storageFileName,
      mimeType: "application/pdf",
      expiresIn: 15,
    });
  } catch (error: unknown) {
    console.error("Error getting delivery note upload URL:", error);
    return NextResponse.json(
      {
        error: "Failed to get upload URL",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
