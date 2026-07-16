import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/purchase-orders/[id]/cancellation/[requestId]/reject
 * Vendor rejects the cancellation request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const { id, requestId } = await params;
    const body = await request.json();
    const { rejectionReason } = body;

    // Get cancellation request
    const cancellationRequest = await prisma.purchaseOrderCancellationRequest.findUnique({
      where: { id: requestId },
      include: {
        purchaseOrder: true,
      },
    });

    if (!cancellationRequest) {
      return NextResponse.json(
        { error: 'Cancellation request not found' },
        { status: 404 }
      );
    }

    if (cancellationRequest.purchaseOrderId !== id) {
      return NextResponse.json(
        { error: 'Cancellation request does not belong to this purchase order' },
        { status: 400 }
      );
    }

    if (cancellationRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Cancellation request is already ${cancellationRequest.status}` },
        { status: 400 }
      );
    }

    // Update cancellation request status to REJECTED
    const updatedRequest = await prisma.purchaseOrderCancellationRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: rejectionReason || null,
        // Note: rejectedBy would be set if we had vendor authentication
      },
    });

    // Record in purchase order history
    await prisma.purchaseOrderHistory.create({
      data: {
        purchaseOrderId: id,
        actionType: 'CANCELLATION_REJECTED',
        actionDescription: `Purchase Order ${cancellationRequest.purchaseOrder.poNumber} cancellation rejected by vendor`,
        previousStatus: cancellationRequest.purchaseOrder.status,
        newStatus: cancellationRequest.purchaseOrder.status, // Status doesn't change
        comments: rejectionReason || 'Cancellation rejected by vendor',
        performedById: cancellationRequest.requestedById, // Use requester's ID as fallback
      },
    });

    console.log(`⚠️  Purchase Order ${cancellationRequest.purchaseOrder.poNumber} cancellation rejected`);

    return NextResponse.json({
      success: true,
      message: 'Purchase Order cancellation rejected by vendor.',
    });
  } catch (error: any) {
    console.error('Error rejecting purchase order cancellation:', error);
    return NextResponse.json(
      {
        error: 'Failed to reject purchase order cancellation',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}















