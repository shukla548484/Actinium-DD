import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { buildRequisitionAttachmentResponse } from "@/lib/requisitions/serve-requisition-attachment";
import { checkRequisitionAttachmentGcsExists } from "@/lib/requisitions/check-requisition-attachment-gcs";
import {
  classifyRequisitionAttachmentSource,
  describeRequisitionAttachmentSyncStatus,
} from "@/lib/requisitions/read-requisition-attachment-bytes";

interface RouteContext {
  params: Promise<{ id: string; itemId: string; attachmentId: string }>;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * GET /api/requisitions/[id]/items/[itemId]/attachments/[attachmentId]
 * Download a single requisition item attachment.
 * ?status=1 — JSON sync/GCS diagnostic (no file bytes).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: requisitionId, itemId, attachmentId } = await context.params;
    const statusOnly = new URL(request.url).searchParams.get("status") === "1";

    if (
      !isValidUuid(requisitionId) ||
      !isValidUuid(itemId) ||
      !isValidUuid(attachmentId)
    ) {
      return NextResponse.json({ error: "Invalid attachment reference" }, { status: 400 });
    }

    const attachment = await prisma.requisitionItemAttachment.findFirst({
      where: {
        id: attachmentId,
        requisitionItemId: itemId,
        requisitionItem: { requisitionId },
      },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileUrl: true,
        fileData: true,
        fileSize: true,
      },
    });

    if (!attachment) {
      const orphan = await prisma.requisitionItemAttachment.findUnique({
        where: { id: attachmentId },
        select: { id: true, requisitionItemId: true },
      });
      if (orphan) {
        return NextResponse.json(
          {
            error: "Attachment exists but requisition/item path does not match",
            attachmentId,
            requisitionItemId: orphan.requisitionItemId,
          },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const gcsExists = await checkRequisitionAttachmentGcsExists(attachment.fileUrl);
    const syncStatus = await describeRequisitionAttachmentSyncStatus(attachment, {
      gcsObjectExists: gcsExists,
    });

    if (statusOnly) {
      return NextResponse.json({
        requisitionId,
        requisitionItemId: itemId,
        ...syncStatus,
      });
    }

    const source = classifyRequisitionAttachmentSource(attachment);
    if (source === "none") {
      return NextResponse.json(
        {
          error: "Attachment metadata is synced but the file is not on cloud storage yet",
          status: "pending_gcs_upload",
          syncHint: "On the vessel run: pnpm ship:sync-attachments (or pnpm ship:sync-attachments:full)",
          ...syncStatus,
        },
        { status: 404 }
      );
    }

    return buildRequisitionAttachmentResponse({
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      fileUrl: attachment.fileUrl,
      fileData: attachment.fileData,
    });
  } catch (error) {
    console.error("Error downloading requisition item attachment:", error);
    return NextResponse.json(
      { error: "Failed to download attachment" },
      { status: 500 }
    );
  }
}
