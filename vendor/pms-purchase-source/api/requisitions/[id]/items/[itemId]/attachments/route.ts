import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import {
  toServableRequisitionAttachmentUrl,
  uploadRequisitionItemAttachment,
} from "@/lib/requisitions/requisition-attachment-storage";

interface RouteContext {
  params: Promise<{ id: string; itemId: string }>;
}

/**
 * POST /api/requisitions/[id]/items/[itemId]/attachments
 * Upload one or more attachments for a requisition item.
 * Local ship: saves to disk (local://) then syncs to GCS via vessel attachment sync.
 * Office: saves directly to GCS.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: requisitionId, itemId } = await context.params;

    const requisitionItem = await prisma.requisitionItem.findFirst({
      where: {
        id: itemId,
        requisitionId,
      },
      include: {
        requisition: {
          select: { id: true, vesselId: true, requisitionNumber: true },
        },
      },
    });

    if (!requisitionItem?.requisition) {
      return NextResponse.json(
        { error: "Requisition or item not found" },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const singleFile = formData.get("file") as File | null;
    const multipleFiles = formData.getAll("files") as File[];
    const files: File[] = singleFile ? [singleFile] : multipleFiles.filter(Boolean);

    if (files.length === 0) {
      return NextResponse.json({ error: "No file(s) provided" }, { status: 400 });
    }

    const created: {
      id: string;
      fileName: string;
      mimeType: string;
      fileSize: number | null;
      fileUrl?: string;
    }[] = [];

    for (const file of files) {
      if (!file || typeof file.size !== "number") continue;

      const { attachment, fileUrl } = await uploadRequisitionItemAttachment({
        requisitionId,
        requisitionItemId: itemId,
        vesselId: requisitionItem.requisition.vesselId,
        requisitionNumber: requisitionItem.requisition.requisitionNumber,
        file,
      });

      created.push({
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
        fileUrl: toServableRequisitionAttachmentUrl(fileUrl),
      });
    }

    return NextResponse.json({ attachments: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload attachment";
    console.error("Error uploading requisition item attachment:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
