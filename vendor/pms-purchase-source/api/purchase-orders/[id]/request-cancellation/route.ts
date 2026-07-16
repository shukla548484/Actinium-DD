import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { RequisitionStatus } from '@/lib/types/requisition';
import { sendGmailEmail } from '@/lib/gmail-server';
import { storeEmailMessage } from '@/lib/email-storage';
import { isAdminEquivalentAccessLevel } from '@/lib/admin-access-level';

/**
 * POST /api/purchase-orders/[id]/request-cancellation
 * Request cancellation of a purchase order (requires vendor acceptance)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userAccessLevel = currentUser.designationAccessLevel || 0;
    const allowedLevels = [32, 33, 39, 50, 99, 100];
    if (!allowedLevels.includes(userAccessLevel) && !isAdminEquivalentAccessLevel(userAccessLevel)) {
      return NextResponse.json(
        {
          error: 'Insufficient permissions to request Purchase Order cancellation',
          userAccessLevel,
          requiredLevels: allowedLevels,
        },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { reason } = body;

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: 'Reason is required for cancellation request' },
        { status: 400 }
      );
    }

    // Get purchase order with requisition and vendor
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        requisition: {
          include: {
            vessel: true,
            createdBy: true,
          },
        },
        quote: {
          include: {
            vendor: true,
          },
        },
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    if (purchaseOrder.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Purchase order is already cancelled' },
        { status: 400 }
      );
    }

    // Check if requisition status indicates items are already delivered
    if (purchaseOrder.requisition.status === RequisitionStatus.REQ_RECEIVED_DELIVERED) {
      return NextResponse.json(
        { error: 'Purchase order cannot be cancelled as items have already been delivered' },
        { status: 400 }
      );
    }

    // Check if there's already a pending cancellation request
    const existingRequest = await prisma.purchaseOrderCancellationRequest.findFirst({
      where: {
        purchaseOrderId: id,
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: 'A cancellation request is already pending for this purchase order' },
        { status: 400 }
      );
    }

    // Store previous requisition status before PO was sent
    const previousRequisitionStatus = purchaseOrder.requisition.status;

    // Create cancellation request
    // currentUser.id is the employee ID
    const cancellationRequest = await prisma.purchaseOrderCancellationRequest.create({
      data: {
        purchaseOrderId: id,
        status: 'PENDING',
        reason: reason.trim(),
        requestedById: currentUser.id,
        previousRequisitionStatus,
      },
      include: {
        requestedBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
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

    // Record in purchase order history
    await prisma.purchaseOrderHistory.create({
      data: {
        purchaseOrderId: id,
        actionType: 'CANCELLATION_REQUESTED',
        actionDescription: `Purchase Order ${purchaseOrder.poNumber} cancellation requested`,
        previousStatus: purchaseOrder.status,
        newStatus: purchaseOrder.status, // Status doesn't change until vendor accepts
        comments: reason.trim(),
        performedById: currentUser.id,
      },
    });

    // Get employee details for email
    const employee = await prisma.employee.findUnique({
      where: { id: currentUser.id },
      select: {
        firstName: true,
        lastName: true,
      },
    });

    // Send email to vendor requesting cancellation acceptance
    try {
      const vendor = purchaseOrder.quote.vendor;
      const vendorEmail = vendor.primaryEmail;
      
      if (vendorEmail) {
        const emailSubject = `Purchase Order Cancellation Request - ${purchaseOrder.poNumber}`;
        const emailHtml = `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #ef4444;">Purchase Order Cancellation Request</h2>
                
                <p>Dear ${vendor.name},</p>
                
                <p>We are requesting to cancel the following Purchase Order:</p>
                
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <p><strong>PO Number:</strong> ${purchaseOrder.poNumber}</p>
                  <p><strong>Requisition Number:</strong> ${purchaseOrder.requisition.requisitionNumber}</p>
                  <p><strong>Vessel:</strong> ${purchaseOrder.requisition.vessel.name}</p>
                  <p><strong>Total Amount:</strong> ${purchaseOrder.currency} ${purchaseOrder.totalAmount || '0.00'}</p>
                  <p><strong>Reason:</strong> ${reason}</p>
                </div>
                
                <p>Please review this cancellation request and accept or reject it through the vendor portal.</p>
                
                <p>If you accept this cancellation, the requisition will be returned to the previous status and will be available for quote approval and purchase order creation again.</p>
                
                <p>Thank you for your understanding.</p>
                
                <p>Best regards,<br>
                ${employee ? `${employee.firstName} ${employee.lastName}` : 'Actinium Ship Management'}</p>
              </div>
            </body>
          </html>
        `;

        const emailResult = await sendGmailEmail({
          to: vendorEmail,
          subject: emailSubject,
          html: emailHtml,
        });

        if (emailResult.messageId) {
          await storeEmailMessage(
            emailResult.messageId,
            'PO_CANCELLATION_REQUEST',
            purchaseOrder.requisitionId,
            purchaseOrder.quoteId
          );
        }
      }
    } catch (emailError) {
      console.error('Error sending cancellation request email:', emailError);
      // Continue even if email fails
    }

    console.log(`✅ Purchase Order ${purchaseOrder.poNumber} cancellation requested`);

    return NextResponse.json({
      success: true,
      message: 'Purchase Order cancellation request created. Waiting for vendor acceptance.',
      cancellationRequest: {
        id: cancellationRequest.id,
        status: cancellationRequest.status,
      },
    });
  } catch (error: any) {
    console.error('Error requesting purchase order cancellation:', error);
    return NextResponse.json(
      {
        error: 'Failed to request purchase order cancellation',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

