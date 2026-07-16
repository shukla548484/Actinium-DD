import { prisma } from "@/lib/prisma";
import { QuoteStatus } from "@prisma/client";
import type { ParsedQuoteMetadata } from "@/lib/excel-quote-locked";
import {
  logToFile,
  moveStagingToProduction,
  verifyProductionAgainstSnapshot,
  verifyStagingData,
  writeToStagingTable,
  type QuoteStagingLineItem,
} from "@/lib/services/quote-staging.service";

export const QUOTE_IMPORT_CHUNK_SIZE = 10;

export type QuoteImportLineItem = QuoteStagingLineItem;

export type QuoteJsonSnapshot = {
  version: 1;
  importedAt: string;
  lineCount: number;
  pricedLineCount: number;
  metadata: ParsedQuoteMetadata | null;
  items: QuoteImportLineItem[];
};

export function normalizeQuoteImportLines(
  parsed: Array<{
    itemName: string;
    description?: string;
    quantity?: number;
    unit?: string;
    unitPrice?: number | null;
    totalPrice?: number | null;
    deliveryTime?: string | null;
    remarks?: string;
    lineNumber?: number;
    partNumber?: string | null;
  }>
): QuoteImportLineItem[] {
  return parsed
    .filter((item) => item.itemName && item.itemName.trim() !== "")
    .map((item, index) => ({
      itemName: item.itemName.trim(),
      description: item.description || "",
      quantity: item.quantity || 0,
      unit: item.unit || "",
      unitPrice: item.unitPrice ?? null,
      totalPrice: item.totalPrice ?? null,
      deliveryTime: item.deliveryTime ?? null,
      remarks: item.remarks || "",
      lineNumber: item.lineNumber && item.lineNumber > 0 ? item.lineNumber : index + 1,
      partNumber: item.partNumber ?? null,
    }));
}

export function countPricedImportLines(items: QuoteImportLineItem[]): number {
  return items.filter(
    (item) =>
      (item.unitPrice != null && Number(item.unitPrice) > 0) ||
      (item.totalPrice != null && Number(item.totalPrice) > 0)
  ).length;
}

export function buildQuoteJsonSnapshot(
  items: QuoteImportLineItem[],
  metadata: ParsedQuoteMetadata | null | undefined
): QuoteJsonSnapshot {
  return {
    version: 1,
    importedAt: new Date().toISOString(),
    lineCount: items.length,
    pricedLineCount: countPricedImportLines(items),
    metadata: metadata ?? null,
    items,
  };
}

export async function saveQuoteJsonSnapshot(
  attachmentId: string | null,
  snapshot: QuoteJsonSnapshot
): Promise<void> {
  if (!attachmentId) return;
  await prisma.emailAttachment.update({
    where: { id: attachmentId },
    data: { parsedData: snapshot as unknown as object },
  });
}

export function sumLineTotals(items: QuoteImportLineItem[]): number {
  return items.reduce((sum, item) => {
    const total = item.totalPrice != null ? Number(item.totalPrice) : 0;
    return sum + (Number.isFinite(total) ? total : 0);
  }, 0);
}

export type QuoteImportPipelineInput = {
  quoteId: string;
  emailMessageId: string | null;
  attachmentId: string | null;
  items: QuoteImportLineItem[];
  metadata?: ParsedQuoteMetadata | null;
  /** Fail when no line has a vendor price (default true for vendor replies). */
  requirePricedLines?: boolean;
};

export type QuoteImportPipelineResult = {
  success: boolean;
  itemsCreated?: number;
  totalAmount?: number;
  pricedLineCount?: number;
  snapshot?: QuoteJsonSnapshot;
  error?: string;
};

/**
 * JSON-first import: snapshot → staging (10-row chunks) → verify → production (10-row chunks) → verify.
 */
export async function runQuoteImportPipeline(
  input: QuoteImportPipelineInput
): Promise<QuoteImportPipelineResult> {
  const {
    quoteId,
    emailMessageId,
    attachmentId,
    items,
    metadata,
    requirePricedLines = true,
  } = input;

  if (items.length === 0) {
    return { success: false, error: "No valid quote lines to import" };
  }

  const pricedLineCount = countPricedImportLines(items);
  if (requirePricedLines && pricedLineCount === 0) {
    return {
      success: false,
      error:
        "Excel has no vendor prices — fill unit/total price columns before import",
      pricedLineCount: 0,
    };
  }

  const snapshot = buildQuoteJsonSnapshot(items, metadata ?? null);
  await saveQuoteJsonSnapshot(attachmentId, snapshot);
  await logToFile(quoteId, "PIPELINE: JSON snapshot saved", {
    lineCount: snapshot.lineCount,
    pricedLineCount: snapshot.pricedLineCount,
    attachmentId,
  });

  const stagingResult = await writeToStagingTable(
    quoteId,
    emailMessageId,
    attachmentId,
    items
  );
  if (!stagingResult.success) {
    return {
      success: false,
      error: stagingResult.error || "Staging write failed",
      snapshot,
    };
  }

  const stagingVerify = await verifyStagingData(quoteId, items.length, {
    strictCount: true,
    expectedPricedLines: requirePricedLines ? pricedLineCount : undefined,
  });
  if (!stagingVerify.success) {
    return {
      success: false,
      error: stagingVerify.error || "Staging verification failed",
      snapshot,
    };
  }

  const moveResult = await moveStagingToProduction(quoteId);
  if (!moveResult.success || moveResult.itemsCreated === 0) {
    return {
      success: false,
      error: moveResult.error || "Move to production failed",
      snapshot,
    };
  }

  const productionVerify = await verifyProductionAgainstSnapshot(quoteId, snapshot);
  if (!productionVerify.success) {
    return {
      success: false,
      error: productionVerify.error || "Production verification failed",
      snapshot,
      itemsCreated: moveResult.itemsCreated,
    };
  }

  const totalAmount = sumLineTotals(stagingVerify.items as QuoteImportLineItem[]);

  await logToFile(quoteId, "PIPELINE: Import complete", {
    itemsCreated: moveResult.itemsCreated,
    totalAmount,
    pricedLineCount,
  });

  return {
    success: true,
    itemsCreated: moveResult.itemsCreated,
    totalAmount,
    pricedLineCount,
    snapshot,
  };
}

export async function applyVendorQuoteHeaderFromImport(
  quoteId: string,
  totalAmount: number,
  metadata: ParsedQuoteMetadata | null | undefined
): Promise<void> {
  const existing = await prisma.vendorQuote.findUnique({
    where: { id: quoteId },
    select: {
      quotationReference: true,
      leadTime: true,
      deliveryTerms: true,
      paymentTerms: true,
      grossAmountBeforeDiscount: true,
      netAmountAfterDiscount: true,
      totalAmount: true,
    },
  });
  if (!existing) return;

  await prisma.vendorQuote.update({
    where: { id: quoteId },
    data: {
      status: QuoteStatus.RECEIVED,
      receivedAt: new Date(),
      totalAmount,
      grossAmountBeforeDiscount:
        metadata?.grossTotalBeforeDiscount ?? existing.grossAmountBeforeDiscount,
      netAmountAfterDiscount: metadata?.netTotalAfterDiscount ?? totalAmount,
      ...(metadata?.quotationReference != null && {
        quotationReference: metadata.quotationReference,
      }),
      ...(metadata?.vendorRfqNumber != null && {
        quotationReference: metadata.vendorRfqNumber,
      }),
      ...(metadata?.leadTime != null && { leadTime: metadata.leadTime }),
      ...(metadata?.validityPeriod != null && {
        validityPeriod: metadata.validityPeriod,
      }),
      ...(metadata?.deliveryPortExWork != null && {
        deliveryPort: metadata.deliveryPortExWork,
      }),
      ...(metadata?.generalRemarks != null && {
        termsAndConditions: metadata.generalRemarks,
      }),
      ...(metadata?.paymentTerms != null && { paymentTerms: metadata.paymentTerms }),
      ...(metadata?.supplyTerms != null &&
        metadata?.deliveryPortExWork == null && {
          deliveryPort: metadata.supplyTerms,
          deliveryTerms: metadata.supplyTerms,
        }),
    },
  });
}

/** Re-import from stored JSON snapshot (no Excel re-parse). */
export async function reimportVendorQuoteFromJsonSnapshot(
  quoteId: string,
  emailMessageId: string,
  attachmentId: string
): Promise<QuoteImportPipelineResult> {
  const attachment = await prisma.emailAttachment.findUnique({
    where: { id: attachmentId },
    select: { parsedData: true },
  });
  if (!attachment?.parsedData) {
    return { success: false, error: "No JSON snapshot on attachment" };
  }

  const raw = attachment.parsedData as QuoteJsonSnapshot | QuoteImportLineItem[];
  let items: QuoteImportLineItem[];
  let metadata: ParsedQuoteMetadata | null = null;

  if (Array.isArray(raw)) {
    items = normalizeQuoteImportLines(raw);
  } else if (raw && typeof raw === "object" && Array.isArray(raw.items)) {
    items = raw.items;
    metadata = raw.metadata ?? null;
  } else {
    return { success: false, error: "Invalid JSON snapshot format on attachment" };
  }

  return runQuoteImportPipeline({
    quoteId,
    emailMessageId,
    attachmentId,
    items,
    metadata,
    requirePricedLines: true,
  });
}
