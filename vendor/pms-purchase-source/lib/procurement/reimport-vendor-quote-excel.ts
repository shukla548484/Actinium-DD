import { parseQuoteResponseExcel } from "@/lib/excel-quote-locked";
import { prisma } from "@/lib/prisma";
import {
  markEmailImported,
  markEmailImportFailed,
} from "@/lib/emails/email-processing-status";
import { logToFile } from "@/lib/services/quote-staging.service";
import {
  applyVendorQuoteHeaderFromImport,
  normalizeQuoteImportLines,
  runQuoteImportPipeline,
} from "@/lib/procurement/quote-import-pipeline";
import { QuoteStatus } from "@prisma/client";

export async function reimportVendorQuoteFromExcelBuffer(
  quoteId: string,
  emailMessageId: string,
  attachmentId: string,
  fileBuffer: Buffer
): Promise<{ success: boolean; error?: string; itemsCreated?: number }> {
  try {
    const existingQuote = await prisma.vendorQuote.findUnique({
      where: { id: quoteId },
      include: {
        requisition: true,
        vendor: true,
      },
    });

    if (!existingQuote) {
      return { success: false, error: "Quote not found" };
    }

    const parsed = await parseQuoteResponseExcel(fileBuffer);
    const metadata = parsed.metadata || null;
    const validItems = normalizeQuoteImportLines(parsed);

    if (validItems.length === 0) {
      return { success: false, error: "No valid items found in Excel file" };
    }

    const pipelineResult = await runQuoteImportPipeline({
      quoteId,
      emailMessageId,
      attachmentId,
      items: validItems,
      metadata,
      requirePricedLines: true,
    });

    if (!pipelineResult.success) {
      return {
        success: false,
        error: pipelineResult.error || "Quote import pipeline failed",
      };
    }

    const totalAmount = pipelineResult.totalAmount ?? 0;
    await applyVendorQuoteHeaderFromImport(quoteId, totalAmount, metadata);
    await markEmailImported(emailMessageId);

    const requisition = existingQuote.requisition;
    const allQuotes = await prisma.vendorQuote.findMany({
      where: { requisitionId: requisition.id },
    });
    const receivedQuotes = allQuotes.filter(
      (q) => q.status === QuoteStatus.RECEIVED
    );
    const rejectedQuotes = allQuotes.filter(
      (q) => q.status === QuoteStatus.REJECTED
    );
    const respondedQuotes = receivedQuotes.length + rejectedQuotes.length;
    const totalSentQuotes = allQuotes.filter(
      (q) =>
        q.status === QuoteStatus.SENT ||
        q.status === QuoteStatus.RECEIVED ||
        q.status === QuoteStatus.REJECTED
    ).length;

    let newStatus = requisition.status;
    if (respondedQuotes === totalSentQuotes && totalSentQuotes > 0) {
      newStatus = "QUOTE_RECEIVED" as typeof requisition.status;
    } else if (receivedQuotes.length > 0 || rejectedQuotes.length > 0) {
      newStatus = "PARTIAL_QUOTE_RECEIVED" as typeof requisition.status;
    }

    if (newStatus !== requisition.status) {
      await prisma.requisition.update({
        where: { id: requisition.id },
        data: { status: newStatus },
      });
    }

    await logToFile(quoteId, "Reimport from Excel buffer complete", {
      quoteId,
      itemsCreated: pipelineResult.itemsCreated,
      totalAmount,
    });

    return { success: true, itemsCreated: pipelineResult.itemsCreated };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await markEmailImportFailed(emailMessageId, message);
    } catch {
      /* ignore */
    }
    return { success: false, error: message };
  }
}

export async function loadEmailAttachmentBufferFromDb(
  attachmentId: string
): Promise<Buffer | null> {
  const attachment = await prisma.emailAttachment.findUnique({
    where: { id: attachmentId },
    select: { fileData: true },
  });
  if (!attachment?.fileData || attachment.fileData.length === 0) {
    return null;
  }
  return Buffer.from(attachment.fileData);
}
