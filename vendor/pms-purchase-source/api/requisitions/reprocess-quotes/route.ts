import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import { prisma } from "@/lib/prisma";
import { EmailProcessingStatus } from "@/lib/emails/email-processing-status";
import { EXCEL_ATTACHMENT_FILTER } from "@/lib/emails/quote-email-discovery";
import {
  loadEmailAttachmentBufferFromDb,
  reimportVendorQuoteFromExcelBuffer,
} from "@/lib/procurement/reimport-vendor-quote-excel";
import { readEmailAttachmentBytes } from "@/lib/emails/read-email-attachment-bytes";

export const maxDuration = 300;

/**
 * POST /api/requisitions/reprocess-quotes
 * Body: { requisitionNumbers: string[] } or { requisitionId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser || !isAdminEquivalentAccessLevel(currentUser.designationAccessLevel)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const requisitionNumbers: string[] = body.requisitionNumbers ?? [];
    const requisitionId: string | undefined = body.requisitionId;

    const requisitions = await prisma.requisition.findMany({
      where: requisitionId
        ? { id: requisitionId }
        : requisitionNumbers.length > 0
          ? { requisitionNumber: { in: requisitionNumbers } }
          : undefined,
      select: {
        id: true,
        requisitionNumber: true,
        vendorQuotes: {
          select: {
            id: true,
            vendor: { select: { name: true } },
          },
        },
      },
    });

    if (requisitions.length === 0) {
      return NextResponse.json({ error: "No requisitions found" }, { status: 404 });
    }

    const results: Array<{
      requisitionNumber: string;
      vendor: string;
      success: boolean;
      error?: string;
      itemsCreated?: number;
    }> = [];

    for (const requisition of requisitions) {
      for (const quote of requisition.vendorQuotes) {
        const email = await prisma.emailMessage.findFirst({
          where: {
            relatedQuoteId: quote.id,
            hasAttachment: true,
            attachments: { some: EXCEL_ATTACHMENT_FILTER },
          },
          orderBy: { receivedAt: "desc" },
          include: {
            attachments: {
              where: EXCEL_ATTACHMENT_FILTER,
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        });

        const attachment = email?.attachments[0];
        if (!email || !attachment) {
          results.push({
            requisitionNumber: requisition.requisitionNumber,
            vendor: quote.vendor.name,
            success: false,
            error: "No Excel email attachment found",
          });
          continue;
        }

        await prisma.$transaction([
          prisma.vendorQuoteItem.deleteMany({ where: { quoteId: quote.id } }),
          prisma.quoteItemStaging.deleteMany({ where: { quoteId: quote.id } }),
          prisma.emailMessage.update({
            where: { id: email.id },
            data: {
              processed: false,
              processedAt: null,
              processingStatus: EmailProcessingStatus.MATCHED,
              lastProcessingError: null,
            },
          }),
        ]);

        let buffer = await loadEmailAttachmentBufferFromDb(attachment.id);
        if (!buffer) {
          const bytes = await readEmailAttachmentBytes(
            {
              id: attachment.id,
              filename: attachment.filename,
              mimeType: attachment.mimeType,
              fileData: attachment.fileData,
              fileUrl: attachment.fileUrl,
              gcsObjectPath: attachment.gcsObjectPath,
              storageType: attachment.storageType,
              attachmentId: attachment.attachmentId,
            },
            { gmailMessageId: email.messageId }
          );
          if (!bytes.ok) {
            results.push({
              requisitionNumber: requisition.requisitionNumber,
              vendor: quote.vendor.name,
              success: false,
              error: bytes.error,
            });
            continue;
          }
          buffer = bytes.buffer;
        }

        const reimport = await reimportVendorQuoteFromExcelBuffer(
          quote.id,
          email.id,
          attachment.id,
          buffer
        );

        results.push({
          requisitionNumber: requisition.requisitionNumber,
          vendor: quote.vendor.name,
          success: reimport.success,
          error: reimport.error,
          itemsCreated: reimport.itemsCreated,
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      reprocessed: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Reprocess failed", details: message },
      { status: 500 }
    );
  }
}
