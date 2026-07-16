import { NextRequest, NextResponse } from "next/server";
import { verifyQuoteAttachmentToken } from "@/lib/quote-attachment-token";
import { serveQuoteAttachmentDownload } from "@/lib/quote-attachment-download-serve";

/**
 * GET /api/requisitions/quote-attachment-download?token=xxx
 * Legacy JWT token links (kept for older quote request Excel files).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const download = searchParams.get("download") === "1";

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const payload = verifyQuoteAttachmentToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 403 });
    }

    return serveQuoteAttachmentDownload({
      quoteId: payload.quoteId,
      type: payload.type,
      attachmentId: payload.id,
      download,
    });
  } catch (error) {
    console.error("Error in quote-attachment-download:", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
