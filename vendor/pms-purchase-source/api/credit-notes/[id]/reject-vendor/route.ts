import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGmailService } from '@/lib/gmail-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/credit-notes/[id]/reject-vendor?token=xxx
 * Vendor rejects credit note via email link
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(new URL('/credit-note-error?error=missing_token', request.url));
    }

    // Verify token format
    let tokenData;
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf-8');
      const parts = decoded.split(':');
      if (parts.length !== 4 || parts[0] !== id || parts[1] !== 'reject') {
        throw new Error('Invalid token format');
      }
      tokenData = {
        creditNoteId: parts[0],
        action: parts[1],
        timestamp: parseInt(parts[2]),
        vendorId: parts[3],
      };
    } catch (error) {
      return NextResponse.redirect(new URL('/credit-note-error?error=invalid_token', request.url));
    }

    // Check if token is expired (24 hours)
    const tokenAge = Date.now() - tokenData.timestamp;
    if (tokenAge > 24 * 60 * 60 * 1000) {
      return NextResponse.redirect(new URL('/credit-note-error?error=expired_token', request.url));
    }

    // Fetch credit note
    const creditNote = await prisma.creditNote.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          include: {
            quote: {
              include: {
                vendor: true,
              },
            },
            requisition: {
              include: {
                vessel: true,
              },
            },
          },
        },
      },
    });

    if (!creditNote) {
      return NextResponse.redirect(new URL('/credit-note-error?error=not_found', request.url));
    }

    // Verify vendor matches
    if (creditNote.purchaseOrder.quote.vendorId !== tokenData.vendorId) {
      return NextResponse.redirect(new URL('/credit-note-error?error=unauthorized', request.url));
    }

    // Check if already rejected
    if (creditNote.status === 'REJECTED') {
      return NextResponse.redirect(new URL(`/credit-note-success?action=rejected&id=${id}`, request.url));
    }

    // Update credit note status
    await prisma.creditNote.update({
      where: { id },
      data: {
        status: 'REJECTED',
        vendorConfirmedAt: new Date(),
      },
    });

    // Send confirmation email to vendor
    const vendor = creditNote.purchaseOrder.quote.vendor;
    const vendorEmail = vendor.primaryEmail || vendor.commonEmail || vendor.secondaryEmail;

    if (vendorEmail) {
      try {
        const gmail = getGmailService();
        await gmail.sendEmail({
          to: vendorEmail,
          subject: `Credit Note Rejected - ${creditNote.creditNoteNumber || `CN-${id.slice(0, 8).toUpperCase()}`}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #ef4444; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background-color: #f9fafb; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>✗ Credit Note Rejected</h1>
                </div>
                <div class="content">
                  <p>Dear ${vendor.name},</p>
                  <p>We have received your rejection of the credit note. Our accounts team will review your response and contact you if needed.</p>
                  <p><strong>Credit Note Details:</strong></p>
                  <ul>
                    <li>Credit Note Number: ${creditNote.creditNoteNumber || `CN-${id.slice(0, 8).toUpperCase()}`}</li>
                    <li>Amount: ${creditNote.currency} ${Number(creditNote.amount).toFixed(2)}</li>
                    <li>Purchase Order: ${creditNote.purchaseOrder.poNumber}</li>
                    <li>Rejected on: ${new Date().toLocaleString('en-US')}</li>
                  </ul>
                  <p>If you have any questions or concerns, please contact our accounts team.</p>
                  <p>Best regards,<br>Actinium-sm Accounts Team</p>
                </div>
                <div class="footer">
                  <p>This is an automated email from Actinium-sm Ship Manager System</p>
                </div>
              </div>
            </body>
            </html>
          `,
          text: `
Credit Note Rejected

Dear ${vendor.name},

We have received your rejection of the credit note. Our accounts team will review your response and contact you if needed.

Credit Note Details:
- Credit Note Number: ${creditNote.creditNoteNumber || `CN-${id.slice(0, 8).toUpperCase()}`}
- Amount: ${creditNote.currency} ${Number(creditNote.amount).toFixed(2)}
- Purchase Order: ${creditNote.purchaseOrder.poNumber}
- Rejected on: ${new Date().toLocaleString('en-US')}

If you have any questions or concerns, please contact our accounts team.

Best regards,
Actinium-sm Accounts Team
          `,
        });
      } catch (emailError) {
        console.error('Error sending rejection email:', emailError);
      }
    }

    // Notify users in portal
    try {
      const accountsUsers = await prisma.employee.findMany({
        where: {
          designationAccessLevel: {
            in: [32, 33, 50, 99, 100],
          },
          isActive: true,
        },
        select: { id: true },
      });

      await prisma.notification.createMany({
        data: accountsUsers.map((user) => ({
          employeeId: user.id,
          title: 'Credit Note Rejected',
          message: `Vendor ${vendor.name} has rejected credit note ${creditNote.creditNoteNumber || `CN-${id.slice(0, 8).toUpperCase()}`}. Please review.`,
          type: 'CREDIT_NOTE_REJECTED',
          link: `/purchase/credit-notes`,
          isRead: false,
        })),
      });
    } catch (notifError) {
      console.error('Error creating notifications:', notifError);
    }

    // Redirect to success page
    return NextResponse.redirect(new URL(`/credit-note-success?action=rejected&id=${id}`, request.url));
  } catch (error: any) {
    console.error('Error rejecting credit note:', error);
    return NextResponse.redirect(new URL('/credit-note-error?error=server_error', request.url));
  }
}

