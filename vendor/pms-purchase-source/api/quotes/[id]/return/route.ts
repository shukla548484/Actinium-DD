import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { sendGmailEmail } from '@/lib/gmail-server';
import { storeEmailMessage } from '@/lib/email-storage';
import { RequisitionStatus } from '@/lib/types/requisition';
import { QuoteStatus } from '@prisma/client';
import { isAdminEquivalentAccessLevel } from '@/lib/admin-access-level';
import { PurchaseOrderWorkflowStatus } from '@/lib/types/purchase-order-workflow';
import {
  purgeCancelledPurchaseOrdersForQuote,
  purgePurchaseOrderRecord,
} from '@/lib/procurement/purge-purchase-order';
import { markTaskNotificationsAsRead } from '@/lib/utils/mark-task-notifications-read';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function canUnapproveApprovedQuote(userAccessLevel: number): boolean {
  const allowedLevels = [32, 33, 50, 99, 100];
  return allowedLevels.includes(userAccessLevel) || isAdminEquivalentAccessLevel(userAccessLevel);
}

/**
 * POST /api/quotes/[id]/return - Return quote to vendor for revision OR un-approve approved quote
 * - If quote is APPROVED and user has procurement access: Un-approve (change status to RECEIVED)
 * - With returnToSelection: cancel linked PO (if not sent) and redirect purchaser to quote comparison
 * - If quote is RECEIVED: Return to vendor for revision
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userAccessLevel = currentUser.designationAccessLevel || 0;
    const { id } = await context.params;
    const body = await request.json();
    const { reason, requestRevision, returnToSelection, childRequisitionId } = body;

    const quote = await prisma.vendorQuote.findUnique({
      where: { id },
      include: {
        requisition: {
          include: {
            vessel: true,
            createdBy: true,
          },
        },
        vendor: true,
      },
    });

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (quote.status === QuoteStatus.APPROVED && canUnapproveApprovedQuote(userAccessLevel)) {
      if (returnToSelection) {
        if (!reason?.trim()) {
          return NextResponse.json(
            { error: 'Reason is required to return to quote selection' },
            { status: 400 }
          );
        }

        const childReqId =
          typeof childRequisitionId === 'string' && childRequisitionId.trim()
            ? childRequisitionId.trim()
            : null;

        const linkedPo = await prisma.purchaseOrder.findFirst({
          where: childReqId
            ? { quoteId: id, requisitionId: childReqId, status: 'ACTIVE' }
            : { quoteId: id, status: 'ACTIVE' },
        });

        if (linkedPo) {
          const workflowStatus =
            linkedPo.workflowStatus ?? PurchaseOrderWorkflowStatus.PO_CREATED;

          if (workflowStatus === PurchaseOrderWorkflowStatus.PO_SENT) {
            return NextResponse.json(
              {
                error:
                  'Purchase Order has already been sent to the vendor and cannot be returned to quote selection',
              },
              { status: 400 }
            );
          }

          if (
            linkedPo.status !== 'CANCELLED' &&
            workflowStatus !== PurchaseOrderWorkflowStatus.CANCELLED
          ) {
            const comments = reason.trim();

            await purgePurchaseOrderRecord({
              purchaseOrderId: linkedPo.id,
              performedById: currentUser.id,
              reason: `Returned to quote selection: ${comments}`,
            });

            await prisma.$transaction([
              prisma.vendorQuote.update({
                where: { id },
                data: { status: QuoteStatus.RECEIVED },
              }),
              prisma.requisition.update({
                where: { id: quote.requisitionId },
                data: { status: RequisitionStatus.QUOTE_RECEIVED },
              }),
            ]);

            await markTaskNotificationsAsRead(currentUser.id, linkedPo.poNumber || linkedPo.id);
          } else {
            await purgeCancelledPurchaseOrdersForQuote({
              quoteId: id,
              requisitionId: childReqId ?? linkedPo.requisitionId,
              performedById: currentUser.id,
              reason: `Cleanup cancelled PO while returning to quote selection: ${reason.trim()}`,
            });

            await prisma.$transaction([
              prisma.vendorQuote.update({
                where: { id },
                data: { status: QuoteStatus.RECEIVED },
              }),
              prisma.requisition.update({
                where: { id: quote.requisitionId },
                data: { status: RequisitionStatus.QUOTE_RECEIVED },
              }),
            ]);
          }
        } else {
          await purgeCancelledPurchaseOrdersForQuote({
            quoteId: id,
            requisitionId: childReqId ?? quote.requisitionId,
            performedById: currentUser.id,
            reason: `Cleanup cancelled PO while returning to quote selection: ${reason.trim()}`,
          });

          await prisma.$transaction([
            prisma.vendorQuote.update({
              where: { id },
              data: { status: QuoteStatus.RECEIVED },
            }),
            prisma.requisition.update({
              where: { id: quote.requisitionId },
              data: { status: RequisitionStatus.QUOTE_RECEIVED },
            }),
          ]);
        }

        await markTaskNotificationsAsRead(currentUser.id, quote.requisition.requisitionNumber || quote.requisitionId);

        return NextResponse.json({
          success: true,
          message:
            'Purchase Order removed and quote returned to selection. Choose another vendor quote to proceed.',
          quote: {
            id: quote.id,
            status: QuoteStatus.RECEIVED,
          },
          quotesPath: `/purchase/requisitions/${quote.requisitionId}/quotes`,
        });
      }

      await prisma.vendorQuote.update({
        where: { id },
        data: {
          status: QuoteStatus.RECEIVED,
        },
      });

      await prisma.requisition.update({
        where: { id: quote.requisitionId },
        data: {
          status: RequisitionStatus.QUOTE_RECEIVED,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Approved quote has been returned. It is now available for approval again.',
        quote: {
          id: quote.id,
          status: QuoteStatus.RECEIVED,
        },
      });
    }

    const subject = `Quote Returned - ${quote.requisition.requisitionNumber} - Revision Requested`;
    const htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #f59e0b;">Quote Returned for Revision</h2>
            
            <p>Dear ${quote.vendor.contactPerson || 'Sir/Madam'},</p>
            
            <p>We are returning your quote for the following requisition:</p>
            
            <table style="border-collapse: collapse; width: 100%; margin: 20px 0; border: 1px solid #ddd;">
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; background-color: #f5f5f5;">Requisition Number:</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${quote.requisition.requisitionNumber}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; background-color: #f5f5f5;">Heading:</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${quote.requisition.heading}</td>
              </tr>
            </table>
            
            <div style="background-color: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #92400e;">Reason for Return:</h3>
              <p style="white-space: pre-wrap; color: #92400e;">${reason || 'Please review and resubmit your quote.'}</p>
            </div>
            
            ${requestRevision ? `
              <div style="background-color: #dbeafe; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #1e40af;">Revision Requested:</h3>
                <p style="white-space: pre-wrap; color: #1e40af;">${requestRevision}</p>
              </div>
            ` : ''}
            
            <p>Please review and resubmit your quote with the requested changes.</p>
            
            <p>Best regards,<br>
            ${quote.requisition.createdBy.firstName} ${quote.requisition.createdBy.lastName}<br>
            Procurement Team</p>
          </div>
        </body>
      </html>
    `;

    const result = await sendGmailEmail({
      to: quote.vendor.primaryEmail,
      cc: quote.vendor.secondaryEmail ? [quote.vendor.secondaryEmail] : undefined,
      subject,
      html: htmlContent,
      text: `Quote Returned for Revision\n\nRequisition: ${quote.requisition.requisitionNumber}\nReason: ${reason || 'Please review and resubmit.'}\n\n${requestRevision || ''}`,
    });

    await storeEmailMessage(result.messageId, 'QUOTE_RETURNED', quote.requisitionId, quote.id);

    await prisma.requisition.update({
      where: { id: quote.requisitionId },
      data: {
        status: RequisitionStatus.REQ_RETURNED,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Quote return notification sent successfully',
      emailId: result.messageId,
    });
  } catch (error: any) {
    console.error('Error returning quote:', error);
    return NextResponse.json(
      { error: 'Failed to return quote', details: error.message },
      { status: 500 }
    );
  }
}
