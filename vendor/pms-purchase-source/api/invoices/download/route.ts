import { NextRequest, NextResponse } from "next/server";
import { getGoogleCloudStorageService } from "@/lib/google-cloud-storage";
import { secureApiRoute, SecureRequestContext, sanitizeInput } from "@/lib/api-security";
import {
  resolveFileLocally,
  shouldServeLocally,
  extractGcsObjectPath,
  resolveLocalFilePath,
} from "@/lib/local-file-resolver";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { invoiceFileDownloadResponse } from "@/lib/purchase/invoice-file-download-server";

/**
 * GET /api/invoices/download?fileUrl=xxx
 * Stream invoice file through the app (keeps download on Actinium-sm.org).
 */
const handler = async (request: NextRequest, _context: SecureRequestContext) => {
  try {
    const { searchParams } = new URL(request.url);
    const fileUrl = sanitizeInput(searchParams.get("fileUrl"));

    if (!fileUrl) {
      return NextResponse.json({ error: "fileUrl parameter is required" }, { status: 400 });
    }

    if (fileUrl.startsWith("local://")) {
      const fullPath = resolveLocalFilePath(fileUrl);
      if (!existsSync(fullPath)) {
        return NextResponse.json(
          { error: "Local invoice file not found on disk" },
          { status: 404 }
        );
      }
      const localBuffer = await readFile(fullPath);
      const localFileName = fileUrl.split("/").pop() || "invoice";
      return invoiceFileDownloadResponse(localBuffer, localFileName);
    }

    if (shouldServeLocally() && fileUrl.includes("storage.googleapis.com")) {
      const localBuffer = await resolveFileLocally(fileUrl);
      if (localBuffer) {
        const objectPath = extractGcsObjectPath(fileUrl) || "file";
        const localFileName = objectPath.split("/").pop() || "invoice";
        return invoiceFileDownloadResponse(localBuffer, localFileName);
      }
      return NextResponse.json(
        { error: "File not yet available locally. It will be downloaded during the next sync." },
        { status: 404 }
      );
    }

    if (shouldServeLocally()) {
      return NextResponse.json(
        { error: "File not yet available locally. It will be downloaded during the next sync." },
        { status: 404 }
      );
    }

    if (fileUrl.includes("drive.google.com")) {
      const fileIdMatch = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (fileIdMatch) {
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
        return NextResponse.json({
          success: true,
          downloadUrl,
          fileUrl,
          source: "google-drive",
        });
      }
      return NextResponse.json({ error: "Invalid Google Drive URL format" }, { status: 400 });
    }

    const gcsObjectPath = extractGcsObjectPath(fileUrl);
    if (!gcsObjectPath) {
      return NextResponse.json(
        { error: "Invalid Google Cloud Storage URL format" },
        { status: 400 }
      );
    }

    const wantsJson =
      request.headers.get("accept")?.includes("application/json") &&
      searchParams.get("format") === "json";

    const gcs = getGoogleCloudStorageService();

    if (wantsJson) {
      const signedUrl = await gcs.getSignedUrl(gcsObjectPath, 60);
      return NextResponse.json({
        success: true,
        downloadUrl: signedUrl,
        fileUrl,
        fileName: gcsObjectPath,
        source: "google-cloud-storage",
        expiresIn: 3600,
      });
    }

    const fileBuffer = await gcs.downloadFile(gcsObjectPath);
    const downloadFileName = gcsObjectPath.split("/").pop() || "invoice";

    return invoiceFileDownloadResponse(Buffer.from(fileBuffer), downloadFileName);
  } catch (error) {
    console.error("Error downloading invoice file:", error);
    return NextResponse.json(
      {
        error: "Failed to download invoice file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
};

export const GET = secureApiRoute(handler);
