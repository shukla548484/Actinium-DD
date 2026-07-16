import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { getGoogleCloudStorageService } from '@/lib/google-cloud-storage';
import { PDFDocument } from 'pdf-lib';

/**
 * POST /api/purchase-orders/[id]/merge-pdf
 * Merge Purchase Order PDF with all attachments into a single PDF
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get purchase order with attachments
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        attachments: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        requisition: {
          include: {
            vessel: true,
          },
        },
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    if (!purchaseOrder.originalPdfUrl) {
      return NextResponse.json(
        { error: 'Original PO PDF not found' },
        { status: 400 }
      );
    }

    if (purchaseOrder.attachments.length === 0) {
      return NextResponse.json(
        { error: 'No attachments to merge' },
        { status: 400 }
      );
    }

    console.log(`📄 Starting PDF merge for PO ${purchaseOrder.poNumber} with ${purchaseOrder.attachments.length} attachment(s)`);

    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();

    // Download and add original PO PDF
    try {
      const originalPdfResponse = await fetch(purchaseOrder.originalPdfUrl);
      if (!originalPdfResponse.ok) {
        throw new Error(`Failed to fetch original PDF: ${originalPdfResponse.statusText}`);
      }
      const originalPdfBytes = await originalPdfResponse.arrayBuffer();
      const originalPdf = await PDFDocument.load(originalPdfBytes);
      const originalPages = await mergedPdf.copyPages(originalPdf, originalPdf.getPageIndices());
      originalPages.forEach((page) => mergedPdf.addPage(page));
      console.log(`✅ Added original PO PDF (${originalPdf.getPageCount()} pages)`);
    } catch (error: any) {
      console.error('Error loading original PDF:', error);
      throw new Error(`Failed to load original PDF: ${error.message}`);
    }

    // Add separator page
    const separatorPage = mergedPdf.addPage([595, 842]); // A4 size
    separatorPage.drawText('APPROVAL DOCUMENTS', {
      x: 50,
      y: 400,
      size: 20,
    });

    // Download and add each attachment
    for (const attachment of purchaseOrder.attachments) {
      try {
        // Only merge PDF attachments directly
        if (attachment.fileUrl.endsWith('.pdf') || attachment.fileType === 'application/pdf') {
          const attachmentResponse = await fetch(attachment.fileUrl);
          if (!attachmentResponse.ok) {
            console.warn(`⚠️  Failed to fetch attachment ${attachment.fileName}: ${attachmentResponse.statusText}`);
            continue;
          }
          const attachmentBytes = await attachmentResponse.arrayBuffer();
          const attachmentPdf = await PDFDocument.load(attachmentBytes);
          const attachmentPages = await mergedPdf.copyPages(attachmentPdf, attachmentPdf.getPageIndices());
          attachmentPages.forEach((page) => mergedPdf.addPage(page));
          console.log(`✅ Added attachment PDF: ${attachment.fileName} (${attachmentPdf.getPageCount()} pages)`);
        } else {
          // For non-PDF files (images, Word docs), we'll need to convert them
          // For now, skip them or add a placeholder
          console.log(`⚠️  Skipping non-PDF attachment: ${attachment.fileName} (type: ${attachment.fileType})`);
          // TODO: Convert images/Word docs to PDF pages
        }
      } catch (error: any) {
        console.error(`Error processing attachment ${attachment.fileName}:`, error);
        // Continue with other attachments
      }
    }

    // Generate merged PDF buffer
    const mergedPdfBytes = await mergedPdf.save();
    const mergedPdfBuffer = Buffer.from(mergedPdfBytes);

    console.log(`✅ Merged PDF created (${mergedPdfBuffer.length / 1024} KB)`);

    // Upload merged PDF to Google Cloud Storage
    const gcs = getGoogleCloudStorageService();
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const fileName = `PO_${purchaseOrder.poNumber}_MERGED_${timestamp}.pdf`;

    const uploadResult = await gcs.uploadFile(
      mergedPdfBuffer,
      fileName,
      'application/pdf',
      {
        vesselId: purchaseOrder.requisition.vesselId,
        category: 'purchase',
        subfolder: `purchase-orders/${purchaseOrder.id}`,
      }
    );

    console.log(`✅ Merged PDF uploaded to GCS: ${uploadResult.publicUrl}`);

    // Update purchase order with merged PDF URL
    await prisma.purchaseOrder.update({
      where: { id },
      data: {
        mergedPdfUrl: uploadResult.publicUrl,
      },
    });

    // Record PDF merge in history
    try {
      const currentUser = await getCurrentUserFromRequest(request);
      if (currentUser) {
        await prisma.purchaseOrderHistory.create({
          data: {
            purchaseOrderId: id,
            actionType: 'PDF_MERGED',
            actionDescription: `Purchase Order PDF merged with ${purchaseOrder.attachments.length} attachment(s)`,
            newStatus: purchaseOrder.status,
            newValue: JSON.stringify({
              mergedPdfUrl: uploadResult.publicUrl,
              attachmentCount: purchaseOrder.attachments.length,
            }),
            performedById: currentUser.id,
          },
        });
        console.log(`✅ PDF merge recorded in PO history`);
      }
    } catch (historyError: any) {
      console.error('⚠️  Error recording PDF merge history (non-critical):', historyError);
    }

    return NextResponse.json({
      success: true,
      mergedPdfUrl: uploadResult.publicUrl,
      message: 'PDF merged successfully',
    });
  } catch (error: any) {
    console.error('Error merging PDF:', error);
    return NextResponse.json(
      {
        error: 'Failed to merge PDF',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

