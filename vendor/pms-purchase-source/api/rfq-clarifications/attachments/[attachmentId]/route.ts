import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { canManagePurchaseClarifications } from "@/lib/procurement/clarification-notifications";
import { buildRequisitionAttachmentResponse } from "@/lib/requisitions/serve-requisition-attachment";

interface RouteContext {
  params: Promise<{ attachmentId: string }>;
}

/**
 * GET /api/rfq-clarifications/attachments/[attachmentId]?download=1
 * Proxies clarification attachments from GCS without exposing storage URLs.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { attachmentId } = await context.params;
    const download = request.nextUrl.searchParams.get("download") === "1";

    const attachment = await prisma.rfqClarificationAttachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileUrl: true,
        clarificationRequest: {
          select: { id: true, vesselId: true },
        },
      },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const accessLevel = user.designationAccessLevel || 0;
    const isOffice = canManagePurchaseClarifications(accessLevel);
    const isVessel = accessLevel >= 6 && accessLevel <= 25;

    if (isVessel && user.vesselId) {
      if (attachment.clarificationRequest.vesselId !== user.vesselId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    } else if (!isOffice) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return buildRequisitionAttachmentResponse(
      {
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        fileUrl: attachment.fileUrl,
      },
      { inline: !download }
    );
  } catch (error) {
    console.error("[rfq-clarification attachment GET]", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
