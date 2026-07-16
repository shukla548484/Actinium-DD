import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import prisma from '@/lib/prisma';
import { getGoogleCloudStorageService } from '@/lib/google-cloud-storage';
import { extractGcsObjectPath } from '@/lib/local-file-resolver';
import { regeneratePurchaseOrderPdf } from '@/lib/services/regenerate-purchase-order-pdf';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/purchase-orders/[id]/pdf
 * Regenerate PO PDF with the current template and return a signed preview URL.
 * Used by approval / confirm pages so approvers always see the latest layout.
 *
 * Pass `?regenerate=0` to serve the stored PDF without rebuilding (optional).
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const skipRegenerate = request.nextUrl.searchParams.get('regenerate') === '0';

    if (skipRegenerate) {
      const purchaseOrder = await prisma.purchaseOrder.findUnique({
        where: { id },
        select: { id: true, originalPdfUrl: true },
      });

      if (!purchaseOrder) {
        return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 });
      }

      if (!purchaseOrder.originalPdfUrl) {
        return NextResponse.json({ error: 'PDF not found for this Purchase Order' }, { status: 404 });
      }

      const gcs = getGoogleCloudStorageService();
      const objectPath =
        gcs.getPathFromFileUrl(purchaseOrder.originalPdfUrl) ??
        extractGcsObjectPath(purchaseOrder.originalPdfUrl);

      if (!objectPath) {
        return NextResponse.json({ error: 'PDF not found for this Purchase Order' }, { status: 404 });
      }

      const signedUrl = await gcs.getSignedUrl(objectPath, 60);
      return NextResponse.json({ signedUrl, regenerated: false });
    }

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 });
    }

    const result = await regeneratePurchaseOrderPdf(id);

    return NextResponse.json({
      signedUrl: result.signedUrl,
      pdfUrl: result.pdfUrl,
      regenerated: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate PDF URL';
    console.error('Error generating PO PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF URL', details: message },
      { status: 500 }
    );
  }
}
