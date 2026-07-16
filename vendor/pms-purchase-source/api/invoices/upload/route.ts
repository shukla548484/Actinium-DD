import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { canUploadPurchaseInvoice } from "@/lib/purchase/invoice-access";
import {
  purchaseFileInputFromUpload,
  uploadPurchaseFileToStorage,
} from "@/lib/purchase/purchase-attachment-storage";
import {
  buildInvoiceStorageFileName,
  buildOwnerApprovalStorageFileName,
  createInvoiceAfterUpload,
  loadPurchaseOrderForInvoiceUpload,
  resolvePurchaseOrderIdForInvoiceUpload,
  serializeInvoiceForUploadResponse,
  validateInvoiceUploadPreconditions,
  validateOwnerApprovalForUpload,
} from "@/lib/purchase/invoice-upload";
import { isAllowedInvoiceFile } from "@/lib/invoice-file-upload";

export const maxDuration = 120;

/**
 * POST /api/invoices/upload
 * Inline upload for ship/local deployments (file passes through the server).
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

    const formData = await request.formData();
    let purchaseOrderId = (formData.get("purchaseOrderId") as string) || "";
    const contractId = (formData.get("contractId") as string) || "";
    const vesselIdForContract = (formData.get("vesselId") as string) || "";
    const requisitionNumber = (formData.get("requisitionNumber") as string) || "";
    const poNumber = (formData.get("poNumber") as string) || "";
    const invoiceNumber = (formData.get("invoiceNumber") as string) || "";
    const invoiceAmount = (formData.get("invoiceAmount") as string) || "";
    const invoiceCurrency = (formData.get("invoiceCurrency") as string)?.trim().toUpperCase() || "";
    const invoiceDate = (formData.get("invoiceDate") as string) || "";
    const accountType = (formData.get("accountType") as string) || "";
    const remarks = ((formData.get("remarks") as string) || "").trim();
    const invoiceFile = formData.get("invoiceFile") as File;
    const ownerApprovalFile = formData.get("ownerApprovalFile") as File | null;

    if (
      !invoiceNumber ||
      !invoiceAmount ||
      !invoiceDate ||
      !accountType ||
      !invoiceCurrency ||
      !invoiceFile
    ) {
      return NextResponse.json(
        {
          error:
            "All fields are required, including invoice currency and attachment (PDF, Word, Excel, or image)",
        },
        { status: 400 }
      );
    }

    const fileCheck = isAllowedInvoiceFile(invoiceFile);
    if (!fileCheck.ok) {
      return NextResponse.json({ error: fileCheck.error }, { status: 400 });
    }

    if (ownerApprovalFile?.size) {
      const ownerCheck = isAllowedInvoiceFile(ownerApprovalFile);
      if (!ownerCheck.ok) {
        return NextResponse.json({ error: ownerCheck.error }, { status: 400 });
      }
    }

    const resolved = await resolvePurchaseOrderIdForInvoiceUpload({
      purchaseOrderId,
      contractId: contractId || undefined,
      vesselId: vesselIdForContract || undefined,
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

    purchaseOrderId = resolved.purchaseOrderId;

    const purchaseOrder = await loadPurchaseOrderForInvoiceUpload(purchaseOrderId);
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

    const fileInput = await purchaseFileInputFromUpload(invoiceFile);
    const storageFileName = buildInvoiceStorageFileName(invoiceNumber, invoiceFile.name);

    const uploadResult = await uploadPurchaseFileToStorage({
      file: fileInput,
      vesselId: purchaseOrder.requisition.vesselId,
      category: "invoices",
      subfolder: `purchase-orders/${purchaseOrderId}`,
      storageFileName,
    });

    let ownerApprovalFileUrl: string | undefined;
    let ownerApprovalFileName: string | undefined;
    if (ownerApprovalFile?.size) {
      const ownerInput = await purchaseFileInputFromUpload(ownerApprovalFile);
      const ownerStorageName = buildOwnerApprovalStorageFileName(
        invoiceNumber,
        ownerApprovalFile.name
      );
      const ownerUpload = await uploadPurchaseFileToStorage({
        file: ownerInput,
        vesselId: purchaseOrder.requisition.vesselId,
        category: "invoices",
        subfolder: `purchase-orders/${purchaseOrderId}/owner-approval`,
        storageFileName: ownerStorageName,
      });
      ownerApprovalFileUrl = ownerUpload.fileUrl;
      ownerApprovalFileName = ownerApprovalFile.name;
    }

    const ownerApprovalError = validateOwnerApprovalForUpload({
      purchaseOrder,
      ownerApprovalFileUrl,
    });
    if (ownerApprovalError) {
      return NextResponse.json({ error: ownerApprovalError.error }, { status: ownerApprovalError.status });
    }

    const { invoice, autoCreatedPurchaseOrder } = await createInvoiceAfterUpload({
      request,
      currentUserId: currentUser.id,
      metadata: {
        purchaseOrderId,
        invoiceNumber,
        invoiceAmount,
        invoiceCurrency,
        invoiceDate,
        accountType,
        contractId: contractId || undefined,
        remarks: remarks || undefined,
        ownerApprovalFileUrl,
        ownerApprovalFileName,
      },
      purchaseOrder,
      isContractInvoiceUpload: resolved.isContractInvoiceUpload,
      fileUrl: uploadResult.fileUrl,
      autoCreatedPurchaseOrder: resolved.autoCreatedPo,
    });

    return NextResponse.json({
      success: true,
      invoice: serializeInvoiceForUploadResponse(invoice),
      autoCreatedPurchaseOrder,
    });
  } catch (error: unknown) {
    console.error("Error uploading invoice:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const isPayloadError =
      message.toLowerCase().includes("payload") ||
      message.toLowerCase().includes("too large") ||
      message.includes("FUNCTION_PAYLOAD");

    return NextResponse.json(
      {
        error: isPayloadError
          ? "File is too large for server upload. Use direct cloud upload instead."
          : "Failed to upload invoice",
        details: message,
      },
      { status: isPayloadError ? 413 : 500 }
    );
  }
}
