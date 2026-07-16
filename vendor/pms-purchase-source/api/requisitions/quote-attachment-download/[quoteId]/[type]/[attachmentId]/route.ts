import { NextRequest, NextResponse } from "next/server";
import {
  verifyQuoteAttachmentDownloadSig,
  type QuoteAttachmentDownloadType,
} from "@/lib/quote-attachment-download-url";
import { serveQuoteAttachmentDownload } from "@/lib/quote-attachment-download-serve";

interface RouteContext {
  params: Promise<{ quoteId: string; type: string; attachmentId: string }>;
}

/**
 * GET /api/requisitions/quote-attachment-download/[quoteId]/[type]/[attachmentId]?exp=&sig=
 * Short signed URLs for Excel hyperlinks — proxies GCS without auth or long JWT tokens.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { quoteId, type, attachmentId } = await context.params;
    const download = request.nextUrl.searchParams.get("download") === "1";
    const exp = Number(request.nextUrl.searchParams.get("exp"));
    const sig = request.nextUrl.searchParams.get("sig") || "";

    if (type !== "drawing" && type !== "item") {
      return NextResponse.json({ error: "Invalid attachment type" }, { status: 400 });
    }

    const valid = verifyQuoteAttachmentDownloadSig({
      quoteId,
      type: type as QuoteAttachmentDownloadType,
      attachmentId,
      exp,
      sig,
    });
    if (!valid) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 403 });
    }

    return serveQuoteAttachmentDownload({
      quoteId,
      type: type as QuoteAttachmentDownloadType,
      attachmentId,
      download,
    });
  } catch (error) {
    console.error("Error in quote-attachment-download (path):", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
