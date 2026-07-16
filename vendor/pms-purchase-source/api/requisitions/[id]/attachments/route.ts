import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { isGcsUrl } from "@/lib/local-file-resolver";
import { toServableRequisitionAttachmentUrl } from "@/lib/requisitions/requisition-attachment-storage";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/requisitions/[id]/attachments - Get requisition attachments
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = (await context.params);
    
    // Check if requisition exists
    const requisition = await prisma.requisition.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!requisition) {
      return NextResponse.json(
        { error: "Requisition not found" },
        { status: 404 }
      );
    }

    // Get email attachments related to this requisition
    const emailAttachments = await prisma.emailAttachment.findMany({
      where: {
        emailMessage: {
          requisitionId: id,
        },
      },
      select: {
        id: true,
        filename: true,
        fileUrl: true,
        mimeType: true,
        size: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Line-item attachments stored on requisition items
    const itemAttachments = await prisma.requisitionItemAttachment.findMany({
      where: {
        requisitionItem: {
          requisitionId: id,
        },
      },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        fileUrl: true,
        requisitionItemId: true,
        requisitionItem: {
          select: {
            itemName: true,
            partName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const attachments = [
      ...emailAttachments.map((att) => ({
        id: att.id,
        filename: att.filename,
        fileUrl: att.fileUrl,
        mimeType: att.mimeType,
        size: att.size,
        type: "attachment" as const,
      })),
      ...itemAttachments.map((att) => ({
        id: att.id,
        filename: att.fileName,
        mimeType: att.mimeType,
        size: att.fileSize ?? undefined,
        type: "item_attachment" as const,
        requisitionItemId: att.requisitionItemId,
        itemName: att.requisitionItem.partName || att.requisitionItem.itemName,
        fileUrl: att.fileUrl && isGcsUrl(att.fileUrl) ? att.fileUrl : undefined,
        downloadUrl:
          att.fileUrl && !isGcsUrl(att.fileUrl)
            ? toServableRequisitionAttachmentUrl(att.fileUrl)
            : `/api/requisitions/${id}/items/${att.requisitionItemId}/attachments/${att.id}`,
      })),
    ];

    return NextResponse.json({
      attachments,
    });
  } catch (error) {
    console.error("Error fetching requisition attachments:", error);
    return NextResponse.json(
      { error: "Failed to fetch requisition attachments" },
      { status: 500 }
    );
  }
}

















