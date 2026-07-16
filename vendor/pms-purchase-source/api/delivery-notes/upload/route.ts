import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import {
  purchaseFileInputFromUpload,
  uploadPurchaseFileToStorage,
} from "@/lib/purchase/purchase-attachment-storage";
import {
  canUserUploadDeliveryNote,
  DN_UPLOAD_ACCESS_DENIED_MESSAGE,
} from "@/lib/purchase/delivery-note-upload-access";
import {
  buildDeliveryNoteStorageFileName,
  loadPurchaseOrderForDeliveryNoteUpload,
  upsertDeliveryNoteAfterUpload,
} from "@/lib/purchase/delivery-note-upload";

export const maxDuration = 120;

/**
 * POST /api/delivery-notes/upload
 * Inline upload for ship/local deployments (file passes through the server).
 * Office uses upload-url + direct GCS PUT + finalize-upload to avoid Vercel body limits.
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userAccessLevel = currentUser.designationAccessLevel || 0;
    if (!canUserUploadDeliveryNote(userAccessLevel)) {
      return NextResponse.json(
        { error: DN_UPLOAD_ACCESS_DENIED_MESSAGE },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const purchaseOrderId = formData.get("purchaseOrderId") as string;
    const quoteId = formData.get("quoteId") as string;
    const deliveryNoteNumber = formData.get("deliveryNoteNumber") as string;
    const deliveryDate = formData.get("deliveryDate") as string;
    const notes = formData.get("notes") as string | null;

    if (!file || !purchaseOrderId || !quoteId || !deliveryNoteNumber || !deliveryDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
    }

    const loaded = await loadPurchaseOrderForDeliveryNoteUpload(
      purchaseOrderId,
      quoteId
    );
    if ("error" in loaded) {
      return NextResponse.json({ error: loaded.error }, { status: 404 });
    }

    const { purchaseOrder } = loaded;
    const fileInput = await purchaseFileInputFromUpload(file);
    const fileName = buildDeliveryNoteStorageFileName(
      purchaseOrder.poNumber,
      deliveryNoteNumber
    );

    const uploadResult = await uploadPurchaseFileToStorage({
      file: fileInput,
      vesselId: purchaseOrder.requisition.vesselId,
      subfolder: `delivery-notes/${purchaseOrder.requisitionId}/${purchaseOrder.id}`,
      storageFileName: fileName,
    });

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
      fileUrl: uploadResult.fileUrl,
      fileName,
      fileSize: fileInput.size,
    });

    return NextResponse.json({
      success: true,
      message: "Delivery note uploaded successfully",
      deliveryNote: {
        id: deliveryNote.id,
        deliveryNoteNumber: deliveryNote.deliveryNoteNumber,
        fileUrl: uploadResult.fileUrl,
        fileName,
      },
    });
  } catch (error: unknown) {
    console.error("Error uploading delivery note:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const isPayloadError =
      message.toLowerCase().includes("payload") ||
      message.toLowerCase().includes("too large") ||
      message.includes("FUNCTION_PAYLOAD");

    return NextResponse.json(
      {
        error: isPayloadError
          ? "File is too large for server upload. Use direct cloud upload instead."
          : "Failed to upload delivery note",
        details: message,
      },
      { status: isPayloadError ? 413 : 500 }
    );
  }
}
