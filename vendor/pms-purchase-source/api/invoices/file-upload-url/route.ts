import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { getGoogleCloudStorageService } from "@/lib/google-cloud-storage";
import { resolveInvoiceFileContentType } from "@/lib/invoice-file-upload";
import {
  buildInvoiceStorageFileName,
  buildPurchaseInvoiceGcsPath,
  loadPurchaseOrderForInvoiceUpload,
  shouldUseDirectGcsInvoiceUpload,
  validateInvoiceFileMeta,
} from "@/lib/purchase/invoice-upload";

export const maxDuration = 30;

/**
 * POST /api/invoices/file-upload-url
 * Signed GCS URL for replacing an invoice attachment (edit flow) without creating a record.
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const purchaseOrderId = String(body.purchaseOrderId || "").trim();
    const invoiceNumber = String(body.invoiceNumber || "invoice").trim();
    const fileName = String(body.fileName || "").trim();
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;

    if (!purchaseOrderId || !fileName) {
      return NextResponse.json({ error: "purchaseOrderId and fileName are required" }, { status: 400 });
    }

    const fileMetaError = validateInvoiceFileMeta(fileName, fileSize);
    if (fileMetaError) {
      return NextResponse.json({ error: fileMetaError }, { status: 400 });
    }

    const purchaseOrder = await loadPurchaseOrderForInvoiceUpload(purchaseOrderId);
    if (!purchaseOrder) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    if (!shouldUseDirectGcsInvoiceUpload()) {
      return NextResponse.json({ useInlineUpload: true });
    }

    const storageFileName = buildInvoiceStorageFileName(invoiceNumber, fileName);
    const { gcsPath, fileUrl } = buildPurchaseInvoiceGcsPath({
      vesselId: purchaseOrder.requisition.vesselId,
      purchaseOrderId: purchaseOrder.id,
      storageFileName,
    });

    const mimeType = resolveInvoiceFileContentType({
      name: fileName,
      type: "",
      size: fileSize,
    } as File);

    const gcs = getGoogleCloudStorageService();
    const uploadUrl = await gcs.getSignedUploadUrl(gcsPath, mimeType, 15);

    return NextResponse.json({
      uploadUrl,
      gcsPath,
      fileUrl,
      fileName: storageFileName,
      mimeType,
      expiresIn: 15,
    });
  } catch (error: unknown) {
    console.error("Error getting invoice file upload URL:", error);
    return NextResponse.json(
      {
        error: "Failed to get upload URL",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
