import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { buildRequisitionAttachmentResponse } from "@/lib/requisitions/serve-requisition-attachment";
import { deleteRequisitionAttachmentFromStorage } from "@/lib/requisitions/requisition-attachment-storage";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/requisitions/drawing-attachments/[id]
 * Download/view a drawing attachment.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const attachment = await prisma.requisitionDrawingAttachment.findUnique({
      where: { id },
      select: { fileName: true, mimeType: true, fileUrl: true, fileData: true },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const inline = request.nextUrl.searchParams.get("download") !== "1";
    return buildRequisitionAttachmentResponse(
      {
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        fileUrl: attachment.fileUrl,
        fileData: attachment.fileData,
      },
      { inline }
    );
  } catch (error) {
    console.error("Error downloading requisition drawing attachment:", error);
    return NextResponse.json(
      { error: "Failed to download attachment" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/requisitions/drawing-attachments/[id]
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const attachment = await prisma.requisitionDrawingAttachment.findUnique({
      where: { id },
      select: { id: true, requisitionId: true, uploadedById: true, fileUrl: true },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const userId = (currentUser as { id?: string }).id;
    if (attachment.requisitionId) {
      return NextResponse.json(
        { error: "Attachment is already linked to a requisition and cannot be deleted" },
        { status: 400 }
      );
    }
    if (attachment.uploadedById !== userId) {
      return NextResponse.json(
        { error: "You can only delete your own attachments" },
        { status: 403 }
      );
    }

    await deleteRequisitionAttachmentFromStorage(attachment.fileUrl);
    await prisma.requisitionDrawingAttachment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting requisition drawing attachment:", error);
    return NextResponse.json(
      { error: "Failed to delete attachment" },
      { status: 500 }
    );
  }
}
