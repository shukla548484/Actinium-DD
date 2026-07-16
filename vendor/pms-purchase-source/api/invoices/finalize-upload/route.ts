import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { canUploadPurchaseInvoice } from "@/lib/purchase/invoice-access";
import {
  createInvoiceAfterUpload,
  loadPurchaseOrderForInvoiceUpload,
  serializeInvoiceForUploadResponse,
  validateInvoiceUploadPreconditions,
  validateOwnerApprovalForUpload,
  verifyInvoiceGcsUpload,
} from "@/lib/purchase/invoice-upload";

export const maxDuration = 60;

/**
 * POST /api/invoices/finalize-upload
 * Phase 2: create invoice record after client uploads file directly to GCS.
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
    const purchaseOrderId = String(body.purchaseOrderId || "").trim();
    const invoiceNumber = String(body.invoiceNumber || "").trim();
    const invoiceAmount = String(body.invoiceAmount || "").trim();
    const invoiceCurrency = String(body.invoiceCurrency || "").trim().toUpperCase();
    const invoiceDate = String(body.invoiceDate || "").trim();
    const accountType = String(body.accountType || "").trim();
    const contractId = String(body.contractId || "").trim();
    const remarks = String(body.remarks || "").trim();
    const ownerApprovalFileUrl = String(body.ownerApprovalFileUrl || "").trim();
    const ownerApprovalFileName = String(body.ownerApprovalFileName || "").trim();
    const fileUrl = String(body.fileUrl || "").trim();
    const gcsPath = String(body.gcsPath || "").trim();
    const autoCreatedPurchaseOrder = body.autoCreatedPurchaseOrder as
      | { id: string; poNumber: string }
      | undefined;

    if (
      !purchaseOrderId ||
      !invoiceNumber ||
      !invoiceAmount ||
      !invoiceCurrency ||
      !invoiceDate ||
      !accountType ||
      !fileUrl ||
      !gcsPath
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const exists = await verifyInvoiceGcsUpload(gcsPath);
    if (!exists) {
      return NextResponse.json(
        { error: "Uploaded file not found in storage. Please retry the upload." },
        { status: 400 }
      );
    }

    const purchaseOrder = await loadPurchaseOrderForInvoiceUpload(purchaseOrderId);
    if (!purchaseOrder) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    const isContractInvoiceUpload = Boolean(contractId);
    const preconditionError = await validateInvoiceUploadPreconditions({
      purchaseOrder,
      invoiceNumber,
      isContractInvoiceUpload,
    });
    if (preconditionError) {
      return NextResponse.json(
        { error: preconditionError.error, details: preconditionError.details },
        { status: preconditionError.status }
      );
    }

    const ownerApprovalError = validateOwnerApprovalForUpload({
      purchaseOrder,
      ownerApprovalFileUrl: ownerApprovalFileUrl || undefined,
    });
    if (ownerApprovalError) {
      return NextResponse.json({ error: ownerApprovalError.error }, { status: ownerApprovalError.status });
    }

    const { invoice, autoCreatedPurchaseOrder: autoPo } = await createInvoiceAfterUpload({
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
        ownerApprovalFileUrl: ownerApprovalFileUrl || undefined,
        ownerApprovalFileName: ownerApprovalFileName || undefined,
      },
      purchaseOrder,
      isContractInvoiceUpload,
      fileUrl,
      autoCreatedPurchaseOrder,
    });

    return NextResponse.json({
      success: true,
      invoice: serializeInvoiceForUploadResponse(invoice),
      autoCreatedPurchaseOrder: autoPo,
    });
  } catch (error: unknown) {
    console.error("Error finalizing invoice upload:", error);
    return NextResponse.json(
      {
        error: "Failed to finalize invoice upload",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
