import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { getGmailService } from '@/lib/gmail-service';
import { generateCreditNotePDF } from '@/lib/services/credit-note-pdf-generator';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/credit-notes/[id]/send-email
 * Send email to vendor with credit note PDF for confirmation
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check access level (32, 33, 50, 99, or 100)
    const accessLevel = currentUser.designationAccessLevel || 0;
    if (![32, 33, 50, 99, 100].includes(accessLevel)) {
      return NextResponse.json(
        { error: 'Access denied. Only users with access level 32, 33, 50, 99, 100 can send credit note emails.' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.actinium-sm.org';

    // Fetch credit note with all related data
    const creditNote = await prisma.creditNote.findUnique({
      where: { id },
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

    if (!creditNote) {
      return NextResponse.json({ error: 'Credit note not found' }, { status: 404 });
    }

    const vendor = creditNote.purchaseOrder.quote.vendor;
    const vessel = creditNote.purchaseOrder.requisition.vessel;

    // Get vendor email
    const vendorEmail = vendor.primaryEmail || vendor.commonEmail || vendor.secondaryEmail;
    if (!vendorEmail) {
      return NextResponse.json(
        { error: 'Vendor email not found. Please update vendor contact information.' },
        { status: 400 }
      );
    }

    // Generate PDF
    const pdfBuffer = await generateCreditNotePDF({
      creditNoteId: id,
      baseUrl,
    });

    // Generate confirmation tokens
    const timestamp = Date.now();
    const confirmToken = Buffer.from(`${id}:confirm:${timestamp}:${vendor.id}`).toString('base64url');
    const rejectToken = Buffer.from(`${id}:reject:${timestamp}:${vendor.id}`).toString('base64url');

    // Store tokens in database (you might want a separate table for this)
    // For now, we'll verify tokens by checking the format

    // Prepare email content - include vendor ID in subject for easy identification
    const vendorIdDisplay = (vendor.vendorId || 'NOT_ASSIGNED').trim();
    const emailSubject = `Credit Note Verification Required - ${creditNote.creditNoteNumber || `CN-${id.slice(0, 8).toUpperCase()}`} | Vendor ID: ${vendorIdDisplay}`;
    
    const confirmUrl = `${baseUrl}/api/credit-notes/${id}/confirm-vendor?token=${confirmToken}`;
    const rejectUrl = `${baseUrl}/api/credit-notes/${id}/reject-vendor?token=${rejectToken}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1e40af; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .button { display: inline-block; padding: 12px 24px; margin: 10px 5px; text-decoration: none; border-radius: 5px; font-weight: bold; }
          .button-accept { background-color: #10b981; color: white; }
          .button-reject { background-color: #ef4444; color: white; }
          .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #1e40af; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ACTINIUM-SM</h1>
            <p>SHIP MANAGER SYSTEM</p>
          </div>
          <div class="content">
            <h2>Credit Note Verification Required</h2>
            <p>Dear ${vendor.name},</p>
            <p>We have created a credit note for your review and confirmation. Please review the attached PDF document which contains all the details.</p>
            
            <div class="details">
              <h3>Credit Note Details:</h3>
              <ul>
                <li><strong>Credit Note Number:</strong> ${creditNote.creditNoteNumber || `CN-${id.slice(0, 8).toUpperCase()}`}</li>
                <li><strong>Date:</strong> ${new Date(creditNote.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</li>
                <li><strong>Amount:</strong> ${creditNote.currency} ${Number(creditNote.amount).toFixed(2)}</li>
                <li><strong>Purchase Order:</strong> ${creditNote.purchaseOrder.poNumber}</li>
                <li><strong>Requisition:</strong> ${creditNote.purchaseOrder.requisition.requisitionNumber}</li>
                <li><strong>Vessel:</strong> ${vessel.name} (${vessel.code || 'N/A'})</li>
              </ul>
            </div>

            <p><strong>Action Required:</strong> Please click one of the buttons below to confirm or reject this credit note:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${confirmUrl}" class="button button-accept">✓ ACCEPT CREDIT NOTE</a>
              <a href="${rejectUrl}" class="button button-reject">✗ REJECT CREDIT NOTE</a>
            </div>

            <p>Alternatively, you can use the links provided in the attached PDF document.</p>
            
            <p>If you have any questions or concerns, please contact us immediately.</p>
            
            <p>Best regards,<br>Actinium-sm Accounts Team</p>
          </div>
          <div class="footer">
            <p>This is an automated email from Actinium-sm Ship Manager System</p>
            <p>© ${new Date().getFullYear()} Actinium-sm. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailText = `
ACTINIUM-SM - SHIP MANAGER SYSTEM
Credit Note Verification Required

Dear ${vendor.name},

We have created a credit note for your review and confirmation.

Credit Note Details:
- Credit Note Number: ${creditNote.creditNoteNumber || `CN-${id.slice(0, 8).toUpperCase()}`}
- Date: ${new Date(creditNote.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
- Amount: ${creditNote.currency} ${Number(creditNote.amount).toFixed(2)}
- Purchase Order: ${creditNote.purchaseOrder.poNumber}
- Requisition: ${creditNote.purchaseOrder.requisition.requisitionNumber}
- Vessel: ${vessel.name} (${vessel.code || 'N/A'})

Action Required:
Please click one of the links below to confirm or reject this credit note:

ACCEPT: ${confirmUrl}
REJECT: ${rejectUrl}

Alternatively, you can use the links provided in the attached PDF document.

If you have any questions or concerns, please contact us immediately.

Best regards,
Actinium-sm Accounts Team

---
This is an automated email from Actinium-sm Ship Manager System
© ${new Date().getFullYear()} Actinium-sm. All rights reserved.
    `;

    // Send email with PDF attachment
    const gmail = getGmailService();
    const result = await gmail.sendEmail({
      to: vendorEmail,
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
      attachments: [
        {
          filename: `Credit_Note_${creditNote.creditNoteNumber || id.slice(0, 8)}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    // Update credit note to track email sent
    await prisma.creditNote.update({
      where: { id },
      data: {
        // You might want to add an emailSentAt field to track when email was sent
      },
    });

    // Log activity
    try {
      await prisma.activityLog.create({
        data: {
          employeeId: currentUser.id,
          actionType: 'SEND_CREDIT_NOTE_EMAIL',
          description: `Sent credit note verification email to vendor ${vendor.name}`,
          module: 'Purchase',
          page: '/purchase/credit-notes',
          metadata: {
            creditNoteId: id,
            vendorId: vendor.id,
            vendorEmail: vendorEmail,
            messageId: result.id,
          },
        },
      });
    } catch (logError) {
      console.error('Error logging activity:', logError);
    }

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully to vendor',
      messageId: result.id,
      vendorEmail: vendorEmail,
    });
  } catch (error: any) {
    console.error('Error sending credit note email:', error);
    return NextResponse.json(
      { error: 'Failed to send email', details: error.message },
      { status: 500 }
    );
  }
}

