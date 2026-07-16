import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RequisitionStatus, getIsEditableFromStatus } from '@/lib/types/requisition';
import { recordPurchaseHistory, PurchaseHistoryActionType } from '@/lib/services/purchase-history.service';

/**
 * POST /api/purchase-orders/[id]/cancellation/[requestId]/accept
 * Vendor accepts the cancellation request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const { id, requestId } = await params;

    // Get cancellation request
    const cancellationRequest = await prisma.purchaseOrderCancellationRequest.findUnique({
      where: { id: requestId },
      include: {
        purchaseOrder: {
          include: {
            requisition: {
              include: {
                vessel: true,
              },
            },
            quote: {
              include: {
                vendor: true,
              },
            },
          },
        },
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

    // Update cancellation request status to ACCEPTED
    const updatedRequest = await prisma.purchaseOrderCancellationRequest.update({
      where: { id: requestId },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        // Note: acceptedBy would be set if we had vendor authentication
        // For now, we'll leave it null as vendors may not have employee records
      },
    });

    // Update purchase order status to CANCELLED
    await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
    });

    // Revert requisition status to previous status (before PO was sent)
    const previousStatus = cancellationRequest.previousRequisitionStatus as RequisitionStatus;
    const requisition = cancellationRequest.purchaseOrder.requisition;
    
    // Determine the correct previous status
    // If previous status was QUOTE_APPROVED, revert to that
    // Otherwise, revert to a status that allows quote approval and PO creation
    let newRequisitionStatus: RequisitionStatus;
    
    if (previousStatus === RequisitionStatus.QUOTE_APPROVED) {
      newRequisitionStatus = RequisitionStatus.QUOTE_APPROVED;
    } else if (
      previousStatus === RequisitionStatus.QUOTE_CONFIRMED_PO_SENT ||
      previousStatus === RequisitionStatus.REQ_RECEIVED_DELIVERED
    ) {
      // If we don't have the exact previous status, default to QUOTE_APPROVED
      // which allows quote confirmation and PO creation again
      newRequisitionStatus = RequisitionStatus.QUOTE_APPROVED;
    } else {
      // Fallback to QUOTE_APPROVED
      newRequisitionStatus = RequisitionStatus.QUOTE_APPROVED;
    }

    await prisma.requisition.update({
      where: { id: requisition.id },
      data: {
        status: newRequisitionStatus,
        isEditable: getIsEditableFromStatus(newRequisitionStatus),
      },
    });

    // Record in purchase order history
    await prisma.purchaseOrderHistory.create({
      data: {
        purchaseOrderId: id,
        actionType: 'CANCELLATION_ACCEPTED',
        actionDescription: `Purchase Order ${cancellationRequest.purchaseOrder.poNumber} cancellation accepted by vendor`,
        previousStatus: cancellationRequest.purchaseOrder.status,
        newStatus: 'CANCELLED',
        comments: `Cancellation accepted. Requisition reverted to ${newRequisitionStatus}`,
        performedById: cancellationRequest.requestedById, // Use requester's ID as fallback
      },
    });

    // Record purchase history for requisition
    await recordPurchaseHistory({
      requisitionId: requisition.id,
      actionType: PurchaseHistoryActionType.STATUS_CHANGED,
      performedById: cancellationRequest.requestedById,
      actionDescription: `Purchase Order cancelled. Requisition status reverted to ${newRequisitionStatus}`,
      previousStatus: requisition.status,
      newStatus: newRequisitionStatus,
      comments: `PO ${cancellationRequest.purchaseOrder.poNumber} cancelled by vendor acceptance`,
    });

    console.log(`✅ Purchase Order ${cancellationRequest.purchaseOrder.poNumber} cancellation accepted`);

    return NextResponse.json({
      success: true,
      message: 'Purchase Order cancellation accepted. Requisition status reverted.',
      requisitionStatus: newRequisitionStatus,
    });
  } catch (error: any) {
    console.error('Error accepting purchase order cancellation:', error);
    return NextResponse.json(
      {
        error: 'Failed to accept purchase order cancellation',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}














