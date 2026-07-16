import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGmailService } from '@/lib/gmail-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/credit-notes/[id]/confirm-vendor?token=xxx
 * Vendor confirms credit note via email link
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(new URL('/credit-note-error?error=missing_token', request.url));
    }

    // Verify token format (in production, use proper JWT or signed tokens)
    let tokenData;
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf-8');
      const parts = decoded.split(':');
      if (parts.length !== 4 || parts[0] !== id || parts[1] !== 'confirm') {
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

    // Check if already confirmed
    if (creditNote.status === 'CONFIRMED') {
      // Redirect to success page
      return NextResponse.redirect(new URL(`/credit-note-success?action=confirmed&id=${id}`, request.url));
    }

    // Update credit note status
    await prisma.creditNote.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
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
          subject: `Credit Note Confirmed - ${creditNote.creditNoteNumber || `CN-${id.slice(0, 8).toUpperCase()}`}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #10b981; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background-color: #f9fafb; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>✓ Credit Note Confirmed</h1>
                </div>
                <div class="content">
                  <p>Dear ${vendor.name},</p>
                  <p>Thank you for confirming the credit note. Your response has been received and recorded.</p>
                  <p><strong>Credit Note Details:</strong></p>
                  <ul>
                    <li>Credit Note Number: ${creditNote.creditNoteNumber || `CN-${id.slice(0, 8).toUpperCase()}`}</li>
                    <li>Amount: ${creditNote.currency} ${Number(creditNote.amount).toFixed(2)}</li>
                    <li>Purchase Order: ${creditNote.purchaseOrder.poNumber}</li>
                    <li>Confirmed on: ${new Date().toLocaleString('en-US')}</li>
                  </ul>
                  <p>This credit note will now be reflected in your account statements and can be applied to future invoices.</p>
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
Credit Note Confirmed

Dear ${vendor.name},

Thank you for confirming the credit note. Your response has been received and recorded.

Credit Note Details:
- Credit Note Number: ${creditNote.creditNoteNumber || `CN-${id.slice(0, 8).toUpperCase()}`}
- Amount: ${creditNote.currency} ${Number(creditNote.amount).toFixed(2)}
- Purchase Order: ${creditNote.purchaseOrder.poNumber}
- Confirmed on: ${new Date().toLocaleString('en-US')}

This credit note will now be reflected in your account statements and can be applied to future invoices.

Best regards,
Actinium-sm Accounts Team
          `,
        });
      } catch (emailError) {
        console.error('Error sending confirmation email:', emailError);
        // Don't fail the request if email fails
      }
    }

    // Notify users in portal (create notification)
    try {
      // Find users with access level 32, 33, 50, 99, or 100
      const accountsUsers = await prisma.employee.findMany({
        where: {
          designationAccessLevel: {
            in: [32, 33, 50, 99, 100],
          },
          isActive: true,
        },
        select: { id: true },
      });

      // Create notifications for accounts users
      await prisma.notification.createMany({
        data: accountsUsers.map((user) => ({
          employeeId: user.id,
          title: 'Credit Note Confirmed',
          message: `Vendor ${vendor.name} has confirmed credit note ${creditNote.creditNoteNumber || `CN-${id.slice(0, 8).toUpperCase()}`}`,
          type: 'CREDIT_NOTE_CONFIRMED',
          link: `/purchase/credit-notes`,
          isRead: false,
        })),
      });
    } catch (notifError) {
      console.error('Error creating notifications:', notifError);
    }

    // Redirect to success page
    return NextResponse.redirect(new URL(`/credit-note-success?action=confirmed&id=${id}`, request.url));
  } catch (error: any) {
    console.error('Error confirming credit note:', error);
    return NextResponse.redirect(new URL('/credit-note-error?error=server_error', request.url));
  }
}

