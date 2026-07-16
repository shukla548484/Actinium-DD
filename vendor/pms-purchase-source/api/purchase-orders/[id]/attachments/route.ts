import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import {
  purchaseFileInputFromUpload,
  uploadPurchaseFileToStorage,
} from '@/lib/purchase/purchase-attachment-storage';

/**
 * POST /api/purchase-orders/[id]/attachments
 * Upload an attachment for a purchase order
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

    // Check if purchase order exists
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const fileType = formData.get('fileType') as string || 'APPROVAL';
    const description = formData.get('description') as string || null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, DOC, DOCX, JPG, PNG are allowed' },
        { status: 400 }
      );
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 50MB' },
        { status: 400 }
      );
    }

    const fileInput = await purchaseFileInputFromUpload(file);
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageFileName = `PO_${purchaseOrder.poNumber}_${fileType}_${timestamp}_${sanitizedFileName}`;

    const uploadResult = await uploadPurchaseFileToStorage({
      file: fileInput,
      vesselId: purchaseOrder.requisition.vesselId,
      subfolder: `purchase-orders/${purchaseOrder.id}/attachments`,
      storageFileName,
    });

    console.log(`✅ Attachment uploaded: ${uploadResult.fileUrl}`);

    // Save attachment record
    const attachment = await prisma.purchaseOrderAttachment.create({
      data: {
        purchaseOrderId: id,
        fileName: file.name,
        fileUrl: uploadResult.fileUrl,
        fileType: fileType,
        description: description,
        uploadedById: currentUser.id,
      },
    });

    // Record attachment addition in history
    try {
      await prisma.purchaseOrderHistory.create({
        data: {
          purchaseOrderId: id,
          actionType: 'ATTACHMENT_ADDED',
          actionDescription: `Attachment "${file.name}" (${fileType}) added to Purchase Order ${purchaseOrder.poNumber}`,
          newStatus: purchaseOrder.status,
          newValue: JSON.stringify({
            attachmentId: attachment.id,
            fileName: file.name,
            fileType: fileType,
            description: description,
          }),
          comments: description || undefined,
          performedById: currentUser.id,
        },
      });
      console.log(`✅ Attachment addition recorded in PO history`);
    } catch (historyError: any) {
      console.error('⚠️  Error recording attachment history (non-critical):', historyError);
    }

    return NextResponse.json({
      success: true,
      attachment: {
        id: attachment.id,
        fileName: attachment.fileName,
        fileUrl: attachment.fileUrl,
        fileType: attachment.fileType,
        description: attachment.description,
        createdAt: attachment.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error uploading attachment:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload attachment',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

