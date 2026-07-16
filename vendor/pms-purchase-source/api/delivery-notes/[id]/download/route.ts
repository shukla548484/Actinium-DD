import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getGoogleCloudStorageService } from "@/lib/google-cloud-storage";
import { resolveLocalFilePath } from "@/lib/local-file-resolver";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/delivery-notes/[id]/download
 * Download delivery note file
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const deliveryNote = await prisma.deliveryNote.findUnique({
      where: { id },
    });

    if (!deliveryNote) {
      return NextResponse.json(
        { error: "Delivery note not found" },
        { status: 404 }
      );
    }

    if (!deliveryNote.googleDriveFileId) {
      return NextResponse.json(
        { error: "Delivery note file not found" },
        { status: 404 }
      );
    }

    const fileRef = deliveryNote.googleDriveFileId;

    if (fileRef.startsWith("local://")) {
      const fullPath = resolveLocalFilePath(fileRef);
      if (!existsSync(fullPath)) {
        return NextResponse.json(
          { error: "Local delivery note file not found on disk" },
          { status: 404 }
        );
      }
      const localBuffer = await readFile(fullPath);
      return new NextResponse(localBuffer, {
        headers: {
          "Content-Type": deliveryNote.fileMimeType || "application/pdf",
          "Content-Disposition": `attachment; filename="${deliveryNote.googleDriveFileName || "delivery-note.pdf"}"`,
        },
      });
    }

    // Get file from Google Cloud Storage
    // googleDriveFileId might be a URL or a file path
    const gcs = getGoogleCloudStorageService();
    
    // Extract file path from URL if it's a full URL
    // URL format: https://storage.googleapis.com/BUCKET_NAME/FILE_PATH
    let filePath = fileRef;
    
    if (filePath.includes('storage.googleapis.com/')) {
      // Extract path after bucket name
      const urlParts = filePath.split('storage.googleapis.com/');
      if (urlParts.length >= 2) {
        const pathAfterBucket = urlParts[1];
        const pathParts = pathAfterBucket.split('/');
        // Remove bucket name (first part) and get the rest as file path
        if (pathParts.length > 1) {
          filePath = pathParts.slice(1).join('/');
          // Remove query parameters if any
          filePath = filePath.split('?')[0];
        } else {
          // If only bucket name, file path is empty (invalid)
          return NextResponse.json(
            { error: "Invalid file URL format" },
            { status: 400 }
          );
        }
      }
    } else if (filePath.startsWith('gs://')) {
      // Handle gs://bucket-name/path/to/file.pdf format
      filePath = filePath.replace('gs://', '').split('/').slice(1).join('/');
    }
    // If it's already just a path (no URL), use it as is
    
    const fileBuffer = await gcs.downloadFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": deliveryNote.fileMimeType || "application/pdf",
        "Content-Disposition": `attachment; filename="${deliveryNote.googleDriveFileName || "delivery-note.pdf"}"`,
      },
    });
  } catch (error: any) {
    console.error("Error downloading delivery note:", error);
    return NextResponse.json(
      {
        error: "Failed to download delivery note",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

