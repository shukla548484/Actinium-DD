import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { canUploadPurchaseInvoice } from "@/lib/purchase/invoice-access";
import { getGoogleCloudStorageService } from "@/lib/google-cloud-storage";
import { resolveInvoiceFileContentType } from "@/lib/invoice-file-upload";
import {
  buildInvoiceStorageFileName,
  buildPurchaseInvoiceGcsPath,
  loadPurchaseOrderForInvoiceUpload,
  resolvePurchaseOrderIdForInvoiceUpload,
  shouldUseDirectGcsInvoiceUpload,
  validateInvoiceFileMeta,
  validateInvoiceUploadPreconditions,
} from "@/lib/purchase/invoice-upload";

export const maxDuration = 30;

/**
 * POST /api/invoices/upload-url
 * Phase 1: signed GCS URL so invoice files bypass the serverless body limit.
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canUploadPurchaseInvoice(currentUser.designationAccessLevel)) {
      return NextResponse.json(
        {
          error: "Insufficient permissions",
          message: "Only purchase uploaders (levels 32–33) may upload invoices.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const purchaseOrderIdInput = String(body.purchaseOrderId || "").trim();
    const contractId = String(body.contractId || "").trim();
    const vesselId = String(body.vesselId || "").trim();
    const requisitionNumber = String(body.requisitionNumber || "").trim();
    const poNumber = String(body.poNumber || "").trim();
    const invoiceNumber = String(body.invoiceNumber || "").trim();
    const invoiceAmount = String(body.invoiceAmount || "").trim();
    const invoiceCurrency = String(body.invoiceCurrency || "").trim().toUpperCase();
    const accountType = String(body.accountType || "").trim();
    const fileName = String(body.fileName || "").trim();
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;

    if (
      !invoiceNumber ||
      !invoiceAmount ||
      !invoiceCurrency ||
      !accountType ||
      !fileName
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const fileMetaError = validateInvoiceFileMeta(fileName, fileSize);
    if (fileMetaError) {
      return NextResponse.json({ error: fileMetaError }, { status: 400 });
    }

    const resolved = await resolvePurchaseOrderIdForInvoiceUpload({
      purchaseOrderId: purchaseOrderIdInput,
      contractId: contractId || undefined,
      vesselId: vesselId || undefined,
      requisitionNumber: requisitionNumber || undefined,
      poNumber: poNumber || undefined,
      invoiceNumber,
      invoiceAmount,
      invoiceCurrency,
      accountType,
      performedById: currentUser.id,
    });

    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const purchaseOrder = await loadPurchaseOrderForInvoiceUpload(resolved.purchaseOrderId);
    if (!purchaseOrder) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    const preconditionError = await validateInvoiceUploadPreconditions({
      purchaseOrder,
      invoiceNumber,
      isContractInvoiceUpload: resolved.isContractInvoiceUpload,
    });
    if (preconditionError) {
      return NextResponse.json(
        { error: preconditionError.error, details: preconditionError.details },
        { status: preconditionError.status }
      );
    }

    if (!shouldUseDirectGcsInvoiceUpload()) {
      return NextResponse.json({
        useInlineUpload: true,
        purchaseOrderId: resolved.purchaseOrderId,
        autoCreatedPurchaseOrder: resolved.autoCreatedPo,
      });
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
      purchaseOrderId: resolved.purchaseOrderId,
      autoCreatedPurchaseOrder: resolved.autoCreatedPo,
      expiresIn: 15,
    });
  } catch (error: unknown) {
    console.error("Error getting invoice upload URL:", error);
    return NextResponse.json(
      {
        error: "Failed to get upload URL",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
