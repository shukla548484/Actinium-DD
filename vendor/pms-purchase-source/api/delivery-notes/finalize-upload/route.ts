import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import {
  MAX_DN_FILE_SIZE_BYTES,
  loadPurchaseOrderForDeliveryNoteUpload,
  upsertDeliveryNoteAfterUpload,
  verifyDeliveryNoteGcsUpload,
} from "@/lib/purchase/delivery-note-upload";
import {
  canUserUploadDeliveryNote,
  DN_UPLOAD_ACCESS_DENIED_MESSAGE,
} from "@/lib/purchase/delivery-note-upload-access";

export const maxDuration = 60;

/**
 * POST /api/delivery-notes/finalize-upload
 * Phase 2: after the client PUTs the PDF to GCS, create/update the delivery note row.
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
    const notes = body.notes != null ? String(body.notes) : null;
    const fileUrl = String(body.fileUrl || "").trim();
    const fileName = String(body.fileName || "").trim();
    const gcsPath = String(body.gcsPath || "").trim();
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;

    if (
      !purchaseOrderId ||
      !quoteId ||
      !deliveryNoteNumber ||
      !deliveryDate ||
      !fileUrl ||
      !fileName ||
      !gcsPath
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (fileSize <= 0 || fileSize > MAX_DN_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "Invalid file size" }, { status: 400 });
    }

    const exists = await verifyDeliveryNoteGcsUpload(gcsPath);
    if (!exists) {
      return NextResponse.json(
        { error: "Uploaded file not found in storage. Please retry the upload." },
        { status: 400 }
      );
    }

    const loaded = await loadPurchaseOrderForDeliveryNoteUpload(
      purchaseOrderId,
      quoteId
    );
    if ("error" in loaded) {
      return NextResponse.json({ error: loaded.error }, { status: 404 });
    }

    const { purchaseOrder } = loaded;
    const deliveryNote = await upsertDeliveryNoteAfterUpload({
      request,
      actorUserId: currentUser.id,
      quoteId,
      vendorId: purchaseOrder.quote.vendorId,
      purchaseOrder,
      input: {
        purchaseOrderId,
        quoteId,
        deliveryNoteNumber,
        deliveryDate,
        notes,
      },
      fileUrl,
      fileName,
      fileSize,
    });

    return NextResponse.json({
      success: true,
      message: "Delivery note uploaded successfully",
      deliveryNote: {
        id: deliveryNote.id,
        deliveryNoteNumber: deliveryNote.deliveryNoteNumber,
        fileUrl,
        fileName,
      },
    });
  } catch (error: unknown) {
    console.error("Error finalizing delivery note upload:", error);
    return NextResponse.json(
      {
        error: "Failed to finalize delivery note upload",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
