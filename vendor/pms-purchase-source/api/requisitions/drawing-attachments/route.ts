import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import {
  toServableRequisitionAttachmentUrl,
  uploadRequisitionDrawingAttachment,
} from "@/lib/requisitions/requisition-attachment-storage";

/**
 * POST /api/requisitions/drawing-attachments
 * Upload a drawing file before or during requisition create.
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const employeeId = (currentUser as { id?: string }).id;
    if (!employeeId) {
      return NextResponse.json({ error: "User has no employee id" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || typeof file.size !== "number") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const { attachment, fileUrl } = await uploadRequisitionDrawingAttachment({
      uploadedById: employeeId,
      file,
    });

    return NextResponse.json(
      {
        attachment: {
          id: attachment.id,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          fileSize: attachment.fileSize,
          createdAt: attachment.createdAt,
          fileUrl: toServableRequisitionAttachmentUrl(fileUrl),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload attachment";
    console.error("Error uploading requisition drawing attachment:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
