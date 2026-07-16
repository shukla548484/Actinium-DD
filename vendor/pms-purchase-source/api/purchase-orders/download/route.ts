import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecureRequestContext, sanitizeInput } from '@/lib/api-security';
import { getGoogleCloudStorageService } from '@/lib/google-cloud-storage';
import {
  resolveFileLocally,
  shouldServeLocally,
  extractGcsObjectPath,
} from '@/lib/local-file-resolver';

/**
 * GET /api/purchase-orders/download?fileUrl=xxx
 * Download purchase order PDF from Google Cloud Storage and serve directly
 * SECURITY: Protected by secureApiRoute - requires authentication
 */
const handler = async (
  request: NextRequest,
  context: SecureRequestContext
) => {
  try {
    const { searchParams } = new URL(request.url);
    const fileUrl = sanitizeInput(searchParams.get('fileUrl'));

    if (!fileUrl) {
      return NextResponse.json(
        { error: 'fileUrl parameter is required' },
        { status: 400 }
      );
    }

    console.log('📥 Downloading purchase order PDF from:', fileUrl);

    if (!fileUrl.includes('storage.googleapis.com')) {
      return NextResponse.json(
        { error: 'Invalid file URL. Only Google Cloud Storage URLs are supported.' },
        { status: 400 }
      );
    }

    const filePath = extractGcsObjectPath(fileUrl);
    if (!filePath) {
      return NextResponse.json(
        { error: 'Invalid Google Cloud Storage URL format' },
        { status: 400 }
      );
    }

    if (shouldServeLocally()) {
      const localBuffer = await resolveFileLocally(fileUrl);
      if (localBuffer) {
        const fileName = filePath.split('/').pop() || 'purchase-order.pdf';
        return new NextResponse(localBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${fileName}"`,
            'Content-Length': localBuffer.length.toString(),
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
      return NextResponse.json(
        { error: 'File not yet available locally. It will be downloaded during the next sync.' },
        { status: 404 }
      );
    }

    const gcs = getGoogleCloudStorageService();
    const fileBuffer = Buffer.from(await gcs.downloadFile(filePath));
    const fileName = filePath.split('/').pop() || 'purchase-order.pdf';

    console.log('✅ File downloaded successfully:', {
      fileName,
      size: fileBuffer.length,
      sizeMB: (fileBuffer.length / 1024 / 1024).toFixed(2),
    });

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: unknown) {
    console.error('❌ Error downloading purchase order PDF:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to download file',
        details: message,
      },
      { status: 500 }
    );
  }
};

export const GET = secureApiRoute(handler, {
  requireAuth: true,
  allowedMethods: ['GET'],
  minAccessLevel: 10,
});
