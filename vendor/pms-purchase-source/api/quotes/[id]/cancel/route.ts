import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { sendGmailEmail } from '@/lib/gmail-server';
import { storeEmailMessage } from '@/lib/email-storage';
import { QuoteStatus } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/quotes/[id]/cancel - Cancel a quote
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

    const { id } = await context.params;
    const body = await request.json();
    const { reason } = body;

    // Get quote
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

    // Update quote status to expired (acts as cancelled)
    const updatedQuote = await prisma.vendorQuote.update({
      where: { id },
      data: {
        status: QuoteStatus.EXPIRED,
        notes: reason || quote.notes,
      },
    });

    // Send cancellation email to vendor
    const subject = `Quote Cancelled - ${quote.requisition.requisitionNumber}`;
    const htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #ef4444;">Quote Cancelled</h2>
            
            <p>Dear ${quote.vendor.contactPerson || 'Sir/Madam'},</p>
            
            <p>We regret to inform you that the following quote request has been cancelled:</p>
            
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
            
            ${reason ? `
              <div style="background-color: #fee2e2; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #991b1b;">Reason:</h3>
                <p style="white-space: pre-wrap; color: #991b1b;">${reason}</p>
              </div>
            ` : ''}
            
            <p>We apologize for any inconvenience caused.</p>
            
            <p>Best regards,<br>
            ${quote.requisition.createdBy.firstName} ${quote.requisition.createdBy.lastName}<br>
            Procurement Team</p>
          </div>
        </body>
      </html>
    `;

    try {
      const result = await sendGmailEmail({
        to: quote.vendor.primaryEmail,
        cc: quote.vendor.secondaryEmail ? [quote.vendor.secondaryEmail] : undefined,
        subject,
        html: htmlContent,
        text: `Quote Cancelled\n\nRequisition: ${quote.requisition.requisitionNumber}\n${reason ? `Reason: ${reason}` : ''}`,
      });

      // Store email
      await storeEmailMessage(result.messageId, 'QUOTE_CANCELLED', quote.requisitionId, quote.id);
    } catch (emailError) {
      console.error('Error sending cancellation email:', emailError);
      // Continue even if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Quote cancelled successfully',
      quote: updatedQuote,
    });
  } catch (error: any) {
    console.error('Error cancelling quote:', error);
    return NextResponse.json(
      { error: 'Failed to cancel quote', details: error.message },
      { status: 500 }
    );
  }
}




















