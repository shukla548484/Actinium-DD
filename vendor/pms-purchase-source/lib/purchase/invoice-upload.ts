import "server-only";

import type { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  getGoogleCloudStorageService,
  isGoogleCloudStorageConfigured,
  prefixGcsPath,
} from "@/lib/google-cloud-storage";
import { isLocalDeployment } from "@/lib/vessel-sync/local-access";
import {
  invoiceFileExtension,
  isAllowedInvoiceFile,
} from "@/lib/invoice-file-upload";
import { MAX_PURCHASE_ATTACHMENT_BYTES } from "@/lib/purchase/purchase-file-limits";
import {
  ContractInvoicePoError,
  createPurchaseOrderForContractInvoice,
} from "@/lib/services/contract-invoice-po.service";
import { recordInvoiceHistory, InvoiceHistoryActionType } from "@/lib/services/invoice-history.service";
import { getInvoiceApprovalLevels } from "@/lib/services/invoice-approval-config.service";
import { notifyInvoiceApprovalPending } from "@/lib/procurement/approval-notifications";
import { CONTRACT_INVOICE_APPROVAL_MIN_ACCESS } from "@/lib/contract-invoice-based";
import { buildAutoLevelOneApprovalFields } from "@/lib/purchase/invoice-access";
import { convertInvoiceAmountToUsd } from "@/lib/purchase-invoice-currency-server";
import { getDefaultFreightAccountCodeId } from "@/lib/freight/freight-account-config";
import { BASE_CURRENCY, convertCurrency } from "@/lib/utils/currency";
import {
  DELIVERY_NOTE_UPLOADED_STATUS_FILTER,
  isDeliveryNoteUploaded,
} from "@/lib/purchase/delivery-note-status";
import { isUnbudgetedPurchase, resolveEffectiveIsBudgeted } from "@/lib/purchase/po-budget-classification";

function isPrismaMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  return (
    e.code === "P2022" ||
    /column [`"]?[\w.]+[`"]? does not exist/i.test(e.message ?? "")
  );
}

export { MAX_PURCHASE_ATTACHMENT_BYTES as MAX_INVOICE_FILE_SIZE_BYTES };

export function shouldUseDirectGcsInvoiceUpload(): boolean {
  return !isLocalDeployment() && isGoogleCloudStorageConfigured();
}

export function buildInvoiceStorageFileName(
  invoiceNumber: string,
  originalFileName: string
): string {
  const ext = invoiceFileExtension(originalFileName) || "pdf";
  const timestamp = Date.now();
  return `invoice_${invoiceNumber.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}.${ext}`;
}

export function buildOwnerApprovalStorageFileName(
  invoiceNumber: string,
  originalFileName: string
): string {
  const ext = invoiceFileExtension(originalFileName) || "pdf";
  const timestamp = Date.now();
  return `owner_approval_${invoiceNumber.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}.${ext}`;
}

export function buildPurchaseOwnerApprovalGcsPath(params: {
  vesselId: string;
  purchaseOrderId: string;
  storageFileName: string;
}): { gcsPath: string; fileUrl: string; bucketName: string } {
  const timestamp = Date.now();
  const sanitized = params.storageFileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const folderPath = `vessels/${params.vesselId}/invoices/purchase-orders/${params.purchaseOrderId}/owner-approval`;
  const gcsPath = prefixGcsPath(`${folderPath}/${timestamp}-${sanitized}`);
  const bucketName = process.env.GCS_BUCKET_NAME || "actinium_sm";
  const fileUrl = `https://storage.googleapis.com/${bucketName}/${gcsPath}`;
  return { gcsPath, fileUrl, bucketName };
}

export function buildPurchaseInvoiceGcsPath(params: {
  vesselId: string;
  purchaseOrderId: string;
  storageFileName: string;
}): { gcsPath: string; fileUrl: string; bucketName: string } {
  const timestamp = Date.now();
  const sanitized = params.storageFileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const folderPath = `vessels/${params.vesselId}/invoices/purchase-orders/${params.purchaseOrderId}`;
  const gcsPath = prefixGcsPath(`${folderPath}/${timestamp}-${sanitized}`);
  const bucketName = process.env.GCS_BUCKET_NAME || "actinium_sm";
  const fileUrl = `https://storage.googleapis.com/${bucketName}/${gcsPath}`;
  return { gcsPath, fileUrl, bucketName };
}

export type InvoiceUploadMetadata = {
  purchaseOrderId: string;
  invoiceNumber: string;
  invoiceAmount: string;
  invoiceCurrency: string;
  invoiceDate: string;
  accountType: string;
  contractId?: string;
  remarks?: string;
  ownerApprovalFileUrl?: string;
  ownerApprovalFileName?: string;
};

export async function resolvePurchaseOrderIdForInvoiceUpload(params: {
  purchaseOrderId?: string;
  contractId?: string;
  vesselId?: string;
  requisitionNumber?: string;
  poNumber?: string;
  invoiceNumber: string;
  invoiceAmount: string;
  invoiceCurrency: string;
  accountType: string;
  performedById: string;
}): Promise<
  | { purchaseOrderId: string; isContractInvoiceUpload: boolean; autoCreatedPo?: { id: string; poNumber: string } }
  | { error: string; status: number }
> {
  let purchaseOrderId = params.purchaseOrderId?.trim() || "";
  const contractId = params.contractId?.trim() || "";
  const isContractInvoiceUpload = Boolean(contractId);

  if (contractId) {
    if (!params.vesselId?.trim()) {
      return { error: "vesselId is required when uploading against a contract", status: 400 };
    }
    const amount = parseFloat(params.invoiceAmount);
    if (Number.isNaN(amount) || amount < 0) {
      return { error: "Invalid invoice amount", status: 400 };
    }
    try {
      const created = await createPurchaseOrderForContractInvoice({
        contractId,
        vesselId: params.vesselId.trim(),
        invoiceAmount: amount,
        currency: params.invoiceCurrency,
        invoiceNumber: params.invoiceNumber,
        performedById: params.performedById,
        accountType: params.accountType,
      });
      purchaseOrderId = created.purchaseOrderId;
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        select: { id: true, poNumber: true },
      });
      return {
        purchaseOrderId,
        isContractInvoiceUpload: true,
        autoCreatedPo: po ? { id: po.id, poNumber: po.poNumber } : undefined,
      };
    } catch (err) {
      if (err instanceof ContractInvoicePoError) {
        return { error: err.message, status: err.statusCode };
      }
      throw err;
    }
  }

  if (!purchaseOrderId && (params.requisitionNumber || params.poNumber)) {
    const where: Record<string, unknown> = {};
    if (params.poNumber) {
      where.poNumber = params.poNumber;
    } else if (params.requisitionNumber) {
      where.requisition = { requisitionNumber: params.requisitionNumber };
    }

    const foundPO = await prisma.purchaseOrder.findFirst({
      where,
      select: { id: true },
    });

    if (!foundPO) {
      return {
        error: "Purchase order not found for the provided requisition number or PO number",
        status: 404,
      };
    }
    purchaseOrderId = foundPO.id;
  }

  if (!purchaseOrderId) {
    return { error: "Purchase order is required", status: 400 };
  }

  return { purchaseOrderId, isContractInvoiceUpload };
}

export function parseInvoiceDate(invoiceDate: string): Date | null {
  try {
    const ddmmyyyyMatch = invoiceDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch;
      const parsed = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(invoiceDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

export async function loadPurchaseOrderForInvoiceUpload(purchaseOrderId: string) {
  return prisma.purchaseOrder.findUnique({
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
          deliveryNotes: {
            where: DELIVERY_NOTE_UPLOADED_STATUS_FILTER,
            orderBy: { uploadedAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });
}

export async function validateInvoiceUploadPreconditions(params: {
  purchaseOrder: NonNullable<Awaited<ReturnType<typeof loadPurchaseOrderForInvoiceUpload>>>;
  invoiceNumber: string;
  isContractInvoiceUpload: boolean;
}): Promise<{ error: string; details?: string; status: number } | null> {
  const { purchaseOrder, invoiceNumber, isContractInvoiceUpload } = params;

  if (!purchaseOrder.quote) {
    return { error: "Quote not found for this purchase order", status: 400 };
  }

  const isFreightPo = purchaseOrder.poType === "FREIGHT";
  const DN_NOT_MANDATORY_TYPES = ["SER", "REP", "CTM", "OTR"];
  const requisitionType = purchaseOrder.requisition.requisitionType || "";
  const isDNMandatory =
    !isContractInvoiceUpload &&
    !isFreightPo &&
    !DN_NOT_MANDATORY_TYPES.includes(requisitionType);

  if (isDNMandatory) {
    const uploadedDN = purchaseOrder.quote.deliveryNotes?.[0];
    if (!uploadedDN || !isDeliveryNoteUploaded(uploadedDN.status)) {
      return {
        error: "Delivery note upload required before invoice processing",
        details:
          "A delivery note must be uploaded for this requisition type before an invoice can be processed.",
        status: 400,
      };
    }
  }

  const existingInvoice = await prisma.invoice.findUnique({
    where: { invoiceNumber: invoiceNumber.trim() },
    select: { id: true },
  });
  if (existingInvoice) {
    return { error: "Invoice number already exists", status: 400 };
  }

  if (!purchaseOrder.quote.vendorId) {
    return { error: "Vendor not found for this quote", status: 400 };
  }

  return null;
}

export function validateOwnerApprovalForUpload(params: {
  purchaseOrder: NonNullable<Awaited<ReturnType<typeof loadPurchaseOrderForInvoiceUpload>>>;
  ownerApprovalFileUrl?: string | null;
}): { error: string; status: number } | null {
  const unbudgeted = isUnbudgetedPurchase({
    poIsBudgeted: params.purchaseOrder.isBudgeted,
    requisitionIsBudgeted: params.purchaseOrder.requisition.isBudgeted,
  });
  if (unbudgeted && !params.ownerApprovalFileUrl?.trim()) {
    return {
      error: "Owner's approval attachment is required for un-budgeted requisitions",
      status: 400,
    };
  }
  return null;
}

export async function verifyInvoiceGcsUpload(gcsPath: string): Promise<boolean> {
  const gcs = getGoogleCloudStorageService();
  return gcs.fileExists(gcsPath);
}

export async function createInvoiceAfterUpload(params: {
  request: NextRequest;
  currentUserId: string;
  metadata: InvoiceUploadMetadata;
  purchaseOrder: NonNullable<Awaited<ReturnType<typeof loadPurchaseOrderForInvoiceUpload>>>;
  isContractInvoiceUpload: boolean;
  fileUrl: string;
  autoCreatedPurchaseOrder?: { id: string; poNumber: string };
}) {
  const { metadata, purchaseOrder, isContractInvoiceUpload, fileUrl, currentUserId, request } =
    params;

  const parsedInvoiceDate = parseInvoiceDate(metadata.invoiceDate);
  if (!parsedInvoiceDate) {
    throw new Error(`Invalid invoice date format: ${metadata.invoiceDate}`);
  }

  const originalAmountParsed = parseFloat(metadata.invoiceAmount);
  if (Number.isNaN(originalAmountParsed) || originalAmountParsed < 0) {
    throw new Error("Invalid invoice amount");
  }

  const usdConversion = await convertInvoiceAmountToUsd(
    originalAmountParsed,
    metadata.invoiceCurrency,
    parsedInvoiceDate
  );

  const quoteAmountRaw = purchaseOrder.quote!.totalAmount
    ? parseFloat(purchaseOrder.quote!.totalAmount.toString())
    : 0;
  const quoteCurrency = purchaseOrder.quote!.currency || BASE_CURRENCY;
  const quoteAmountUsd =
    quoteAmountRaw > 0
      ? await convertCurrency(
          quoteAmountRaw,
          quoteCurrency,
          BASE_CURRENCY,
          parsedInvoiceDate
        )
      : 0;
  const differenceAmount = usdConversion.usdAmount - quoteAmountUsd;
  const differencePercent =
    quoteAmountUsd > 0 ? (differenceAmount / quoteAmountUsd) * 100 : 0;

  const isFreightPo = purchaseOrder.poType === "FREIGHT";
  let accountCodeId: string | null = null;
  if (isFreightPo && purchaseOrder.requisition.vessel) {
    accountCodeId = await getDefaultFreightAccountCodeId(
      purchaseOrder.requisition.vessel.companyId,
      purchaseOrder.requisition.vessel.id
    );
  }

  const ownerApprovalError = validateOwnerApprovalForUpload({
    purchaseOrder,
    ownerApprovalFileUrl: metadata.ownerApprovalFileUrl,
  });
  if (ownerApprovalError) {
    throw new Error(ownerApprovalError.error);
  }

  const effectiveIsBudgeted = resolveEffectiveIsBudgeted(
    purchaseOrder.isBudgeted,
    purchaseOrder.requisition.isBudgeted
  );

  const invoiceInclude = {
    requisition: {
      include: {
        vessel: {
          select: {
            id: true,
            name: true,
            code: true,
            companyId: true,
          },
        },
      },
    },
    purchaseOrder: {
      select: {
        id: true,
        poNumber: true,
      },
    },
    vendor: {
      select: {
        id: true,
        name: true,
      },
    },
  } as const;

  const autoL1 = buildAutoLevelOneApprovalFields(currentUserId);

  const invoiceBaseData = {
    invoiceNumber: metadata.invoiceNumber,
    requisitionId: purchaseOrder.requisitionId,
    purchaseOrderId: purchaseOrder.id,
    quoteId: purchaseOrder.quoteId,
    vendorId: purchaseOrder.quote!.vendorId,
    invoiceDate: parsedInvoiceDate,
    invoiceAmount: usdConversion.usdAmount,
    originalInvoiceAmount: usdConversion.originalAmount,
    fxRateToUsd: usdConversion.fxRateToUsd,
    fxRateSource: usdConversion.fxRateSource,
    currency: usdConversion.originalCurrency,
    invoiceFileUrl: fileUrl,
    accountType: metadata.accountType,
    accountCodeId: accountCodeId ?? undefined,
    quoteAmount: quoteAmountUsd,
    differenceAmount,
    differencePercent,
    ...autoL1,
    shipStaffRemarks: metadata.remarks?.trim() || null,
  };

  const invoiceExtendedData = {
    ...invoiceBaseData,
    ownerApprovalFileUrl: metadata.ownerApprovalFileUrl?.trim() || null,
    ownerApprovalFileName: metadata.ownerApprovalFileName?.trim() || null,
    isBudgeted: effectiveIsBudgeted,
  };

  let invoice;
  try {
    invoice = await prisma.invoice.create({
      data: invoiceExtendedData,
      include: invoiceInclude,
    });
  } catch (createError) {
    if (!isPrismaMissingColumnError(createError)) {
      throw createError;
    }
    console.warn(
      "invoice create: optional columns missing (run invoice migrations); saving without owner approval / isBudgeted fields"
    );
    invoice = await prisma.invoice.create({
      data: invoiceBaseData,
      include: invoiceInclude,
    });
  }

  try {
    await recordInvoiceHistory({
      invoiceId: invoice.id,
      actionType: InvoiceHistoryActionType.LEVEL_ONE_APPROVED,
      actionDescription: `Invoice ${metadata.invoiceNumber} uploaded — L1 auto-approved on upload`,
      performedById: currentUserId,
      previousStatus: null,
      newStatus: "LEVEL_ONE_APPROVED",
      comments: metadata.remarks?.trim() || undefined,
    });
  } catch (historyError) {
    console.error("Error recording invoice history:", historyError);
  }

  const companyId = purchaseOrder.requisition.vessel?.companyId ?? null;
  const vesselId = purchaseOrder.requisition.vesselId;
  const levels = await getInvoiceApprovalLevels(companyId, vesselId);

  try {
    await notifyInvoiceApprovalPending({
      request,
      actorUserId: currentUserId,
      vesselId,
      companyId,
      requisitionNumber: purchaseOrder.requisition.requisitionNumber,
      purchaseOrderNumber: purchaseOrder.poNumber,
      invoiceId: invoice.id,
      invoiceNumber: metadata.invoiceNumber,
      approvalLevel: 2,
      targetAccessLevels: isContractInvoiceUpload
        ? levels.level2AccessLevels.length
          ? levels.level2AccessLevels
          : [CONTRACT_INVOICE_APPROVAL_MIN_ACCESS]
        : levels.level2AccessLevels,
      metadata: isContractInvoiceUpload ? { contractUpload: true } : undefined,
    });
  } catch (notifyErr) {
    console.error("[INVOICE UPLOAD] Notification failed:", notifyErr);
  }

  return {
    invoice,
    autoCreatedPurchaseOrder: isContractInvoiceUpload
      ? params.autoCreatedPurchaseOrder ??
        (purchaseOrder
          ? { id: purchaseOrder.id, poNumber: purchaseOrder.poNumber }
          : undefined)
      : undefined,
  };
}

export function serializeInvoiceForUploadResponse(
  invoice: Awaited<ReturnType<typeof createInvoiceAfterUpload>>["invoice"]
) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    requisitionId: invoice.requisitionId,
    purchaseOrderId: invoice.purchaseOrderId,
    quoteId: invoice.quoteId,
    vendorId: invoice.vendorId,
    invoiceDate: invoice.invoiceDate.toISOString(),
    invoiceAmount: invoice.invoiceAmount.toString(),
    originalInvoiceAmount: invoice.originalInvoiceAmount?.toString() ?? null,
    fxRateToUsd: invoice.fxRateToUsd?.toString() ?? null,
    fxRateSource: invoice.fxRateSource ?? null,
    currency: invoice.currency,
    invoiceFileUrl: invoice.invoiceFileUrl,
    accountType: invoice.accountType,
    quoteAmount: invoice.quoteAmount.toString(),
    differenceAmount: invoice.differenceAmount.toString(),
    differencePercent: invoice.differencePercent ? invoice.differencePercent.toString() : null,
    status: invoice.status,
    requisition: invoice.requisition
      ? {
          id: invoice.requisition.id,
          vessel: invoice.requisition.vessel,
        }
      : null,
    purchaseOrder: invoice.purchaseOrder,
    vendor: invoice.vendor,
  };
}

export function validateInvoiceFileMeta(fileName: string, fileSize: number): string | null {
  if (!fileName.trim()) return "File name is required";
  if (fileSize <= 0) return "Invalid file size";
  if (fileSize > MAX_PURCHASE_ATTACHMENT_BYTES) {
    return `File must be ${MAX_PURCHASE_ATTACHMENT_BYTES / 1024 / 1024} MB or smaller`;
  }
  return null;
}
