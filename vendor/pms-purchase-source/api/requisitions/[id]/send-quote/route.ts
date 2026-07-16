import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { RequisitionStatus, getIsEditableFromStatus } from "@/lib/types/requisition";
import { QuoteStatus } from "@/lib/types/vendor";
import { recordPurchaseHistory, PurchaseHistoryActionType } from "@/lib/services/purchase-history.service";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import { deriveStatusFromVendorQuotes } from "@/lib/procurement/requisition-status-reconcile";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// POST /api/requisitions/[id]/send-quote - Send quote request to selected vendors
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = (await context.params);
    const body = await request.json();
    const { vendorIds, validUntilDays = 30, customMessage, portOfSupply, sentById, cc, bcc, includeUserEmailInCc = true } = body;

    // Get current user from session (preferred) or use sentById from body (fallback)
    const { getCurrentUserFromRequest } = await import('@/lib/session');
    const currentUser = await getCurrentUserFromRequest(request);
    
    // Use session user if available, otherwise use sentById from body
    const userId = currentUser?.id || sentById;

    if (!vendorIds || !Array.isArray(vendorIds) || vendorIds.length === 0) {
      return NextResponse.json(
        { error: "At least one vendor must be selected" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User authentication required. Please log in and try again." },
        { status: 401 }
      );
    }

    // Check sender's access level from database
    // IMPORTANT: Always use designationAccessLevel from database, NOT hardcoded mapping
    const sender = await prisma.employee.findUnique({
      where: { id: userId },
      select: { designationAccessLevel: true }
    });

    if (!sender) {
      return NextResponse.json(
        { error: "Employee not found. Please check your user account." },
        { status: 404 }
      );
    }

    const accessLevel = sender.designationAccessLevel;
    
    // Check if user has access level 32, 33, or 50
    if (accessLevel !== 32 && accessLevel !== 33 && !isAdminEquivalentAccessLevel(accessLevel)) {
      return NextResponse.json(
        { error: "Only users with access level 32, 33, or 50 can send requisitions for quote" },
        { status: 403 }
      );
    }

    // Check if requisition exists and is in the right state (include attachments for Excel links)
    const requisition = await prisma.requisition.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            attachments: { select: { id: true, fileName: true } },
          },
        },
        vessel: {
          include: {
            company: true,
          },
        },
        createdBy: true,
        drawingAttachments: { select: { id: true, fileName: true } },
        purchaseOrders: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!requisition) {
      return NextResponse.json(
        { error: "Requisition not found" },
        { status: 404 }
      );
    }

    // Disable if a Purchase Order has been issued
    // Check if status is QUOTE_CONFIRMED_PO_SENT
    if (requisition.status === RequisitionStatus.QUOTE_CONFIRMED_PO_SENT) {
      return NextResponse.json(
        { error: "Cannot send quote requests. A Purchase Order has already been issued for this requisition." },
        { status: 400 }
      );
    }

    // Check if there are any active (non-cancelled) purchase orders
    if (requisition.purchaseOrders && requisition.purchaseOrders.length > 0) {
      const activePOs = requisition.purchaseOrders.filter((po: any) => po.status !== 'CANCELLED');
      if (activePOs.length > 0) {
        return NextResponse.json(
          { error: "Cannot send quote requests. A Purchase Order has already been issued for this requisition." },
          { status: 400 }
        );
      }
    }

    // Allow sending quotes for requisitions in these statuses:
    // - REQ_APPROVED: Initial approval
    // - SENT_FOR_QUOTE: Already sent, but can resend to more vendors
    // - QUOTE_RECEIVED: Quotes received, but can still send to more vendors
    // - PARTIAL_QUOTE_RECEIVED: Partial quotes, can send to more vendors
    // - QUOTE_APPROVED: Quote approved, but can still send to more vendors if needed
    // This allows resending to failed vendors or adding new vendors even if some quotes were already received
    const allowedStatuses = [
      RequisitionStatus.REQ_APPROVED,
      RequisitionStatus.SENT_FOR_QUOTE,
      RequisitionStatus.QUOTE_RECEIVED,
      RequisitionStatus.PARTIAL_QUOTE_RECEIVED,
      RequisitionStatus.QUOTE_APPROVED,
    ] as string[];

    if (!allowedStatuses.includes(requisition.status)) {
      return NextResponse.json(
        { error: `Cannot send quote requests. Requisition status must be one of: REQ Approved, Sent for Quote, Quote Received, Partial Quote Received, or Quote Approved. Current status: ${requisition.status}` },
        { status: 400 }
      );
    }

    // Validate vendors exist and are active
    const vendors = await prisma.vendor.findMany({
      where: {
        id: { in: vendorIds },
        isActive: true,
      },
    });

    if (vendors.length !== vendorIds.length) {
      return NextResponse.json(
        { error: "Some selected vendors are invalid or inactive" },
        { status: 400 }
      );
    }

    // Calculate valid until date
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validUntilDays);

    // Create vendor quotes with PENDING status initially (will be updated to SENT after email is sent)
    // Create or update VendorQuote records for each vendor
    // IMPORTANT: Each vendor gets a unique VendorQuote record with a unique UUID
    // This ensures:
    // 1. Each vendor gets a different uniqueEmailId (first 8 chars of quote UUID)
    // 2. Each vendor gets a different QR code (includes vendorId and vendorEmail)
    // 3. Quotes from different vendors won't mix even if they respond to the same requisition
    const vendorQuotes = await Promise.all(
      vendors.map(async (vendor) => {
        // Check if quote already exists for this vendor and requisition
        const existingQuote = await prisma.vendorQuote.findFirst({
          where: {
            requisitionId: id,
            vendorId: vendor.id,
          },
        });

        if (existingQuote) {
          // Ensure uniqueEmailId is set (first 8 chars of quote ID)
          const uniqueEmailId = existingQuote.id.substring(0, 8).toUpperCase();
          
          // Update existing quote - keep current status, will update to SENT after email is sent
          return await prisma.vendorQuote.update({
            where: { id: existingQuote.id },
            data: {
              status: QuoteStatus.PENDING, // Set to PENDING initially
              validUntil,
              notes: customMessage,
              uniqueEmailId: existingQuote.uniqueEmailId || uniqueEmailId, // Set if not already set
              // Don't set sentAt yet - only set after email is successfully sent
              quotedItems: {
                deleteMany: {}, // Remove old items
                create: requisition.items.map((item) => {
                  const itemAny = item as any;
                  let description = item.description || "";
                  const parts = [];
                  if (itemAny.partNumber) parts.push(`Part No: ${itemAny.partNumber}`);
                  if (itemAny.drawingNumber) parts.push(`Drawing: ${itemAny.drawingNumber}`);
                  if (parts.length > 0) {
                    description = description ? `${description} | ${parts.join(" | ")}` : parts.join(" | ");
                  }
                  
                  return {
                    itemName: item.itemName,
                    description: description,
                    quantity: item.quantity,
                    unit: item.unit,
                    remarks: item.remarks,
                  };
                }),
              },
            },
            include: {
              vendor: true,
              quotedItems: true,
            },
          });
        } else {
          // Create new quote with PENDING status initially
          const newQuote = await prisma.vendorQuote.create({
            data: {
              requisitionId: id,
              vendorId: vendor.id,
              status: QuoteStatus.PENDING, // Set to PENDING initially
              validUntil,
              notes: customMessage,
              // Don't set sentAt yet - only set after email is successfully sent
              quotedItems: {
                create: requisition.items.map((item) => {
                  const itemAny = item as any;
                  let description = item.description || "";
                  const parts = [];
                  if (itemAny.partNumber) parts.push(`Part No: ${itemAny.partNumber}`);
                  if (itemAny.drawingNumber) parts.push(`Drawing: ${itemAny.drawingNumber}`);
                  if (parts.length > 0) {
                    description = description ? `${description} | ${parts.join(" | ")}` : parts.join(" | ");
                  }
                  
                  return {
                    itemName: item.itemName,
                    description: description,
                    quantity: item.quantity,
                    unit: item.unit,
                    remarks: item.remarks,
                  };
                }),
              },
            },
            include: {
              vendor: true,
              quotedItems: true,
            },
          });
          
          // Store unique email ID (first 8 chars of quote ID) for later quote comparison
          // This uniqueEmailId is vendor-specific because each vendor gets a unique VendorQuote UUID
          const uniqueEmailId = newQuote.id.substring(0, 8).toUpperCase();
          await prisma.vendorQuote.update({
            where: { id: newQuote.id },
            data: { uniqueEmailId },
          });
          
          console.log(`✅ Created unique quote for vendor ${vendor.name} (${vendor.primaryEmail}): Quote ID: ${newQuote.id}, Unique Email ID: ${uniqueEmailId}`);
          
          return { ...newQuote, uniqueEmailId };
        }
      })
    );

    // Update requisition portOfSupply if provided (do this before email sending)
    if (portOfSupply) {
      await prisma.requisition.update({
        where: { id },
        data: {
          portOfSupply: portOfSupply,
        },
      });
    }

    // NOTE: Do NOT update requisition status to SENT_FOR_QUOTE yet
    // Status will be updated AFTER emails are successfully sent

    // Get current user email if includeUserEmailInCc is true
    let userEmail: string | undefined;
    if (includeUserEmailInCc && userId) {
      const user = await prisma.employee.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      userEmail = user?.email || undefined;
    }

    // Parse CC and BCC emails (comma-separated strings to arrays)
    const parseEmails = (emailString?: string): string[] | undefined => {
      if (!emailString || !emailString.trim()) return undefined;
      return emailString
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0 && email.includes('@'));
    };

    const ccEmails = parseEmails(cc);
    const bccEmails = parseEmails(bcc);

    // Combine CC emails: user email (if enabled) + provided CC emails
    const finalCcEmails: string[] = [];
    if (includeUserEmailInCc && userEmail) {
      finalCcEmails.push(userEmail);
    }
    if (ccEmails) {
      finalCcEmails.push(...ccEmails);
    }

    // Send emails to vendors using Gmail API with locked Excel
    const { sendQuoteRequestsToVendors } = await import('@/lib/quote-email-service');
    
    // Pre-check Gmail API connectivity before attempting to send
    let gmailCheckPassed = false;
    try {
      console.log('🔍 Pre-checking Gmail API connectivity...');
      const { getGmailClient } = await import('@/lib/gmail-server');
      const gmail = await getGmailClient();
      // Try to get user profile to verify authentication
      const profile = await gmail.users.getProfile({ userId: 'me' });
      if (profile.data.emailAddress) {
        console.log(`✅ Gmail API connectivity check passed. Authenticated as: ${profile.data.emailAddress}`);
        gmailCheckPassed = true;
      } else {
        console.warn('⚠️  Gmail API connectivity check: Could not get email address from profile');
      }
    } catch (gmailCheckError: any) {
      console.error('❌ Gmail API connectivity check failed:', {
        message: gmailCheckError.message,
        code: gmailCheckError.code,
        stack: gmailCheckError.stack,
      });
      // Continue anyway - let the actual send attempt handle the error
      console.warn('⚠️  Continuing with email send attempt despite connectivity check failure...');
    }
    
    let emailResult: { success: number; failed: number; errors: Array<{ vendor: string; error: string }>; successfulQuoteIds?: string[] } | null = null;
    try {
      emailResult = await sendQuoteRequestsToVendors(
        requisition,
        vendorQuotes.map(q => ({
          id: q.id,
          vendor: q.vendor,
          validUntil,
        })),
        customMessage,
        portOfSupply || requisition.portOfSupply,
        finalCcEmails.length > 0 ? finalCcEmails : undefined,
        bccEmails
      );
      
      console.log(`📧 Email sending results: ${emailResult.success} successful, ${emailResult.failed} failed`);
      if (emailResult.errors.length > 0) {
        console.error('❌ Email errors:', emailResult.errors);
        // Log each error in detail
        emailResult.errors.forEach((err, index) => {
          console.error(`❌ Error ${index + 1}:`, {
            vendor: err.vendor,
            error: err.error,
            fullError: err,
          });
        });
      }
      
      // If all emails failed, log a warning and check for common issues
      if (emailResult.success === 0 && emailResult.failed > 0) {
        console.error('⚠️  ALL EMAILS FAILED TO SEND:', {
          totalAttempted: emailResult.failed,
          errors: emailResult.errors,
          commonIssues: [
            'Check if Gmail refresh token is valid',
            'Check if Gmail API is enabled',
            'Check if OAuth scopes are correct',
            'Check server logs for detailed error messages',
          ],
        });
      }

      // Update quote status to SENT only for quotes where email was successfully sent
      // Also ensure uniqueEmailId is stored for all quotes (for quote comparison)
      if (emailResult.successfulQuoteIds && emailResult.successfulQuoteIds.length > 0) {
        // First, ensure all quotes have uniqueEmailId stored
        for (const quoteId of emailResult.successfulQuoteIds) {
          const quote = await prisma.vendorQuote.findUnique({
            where: { id: quoteId },
            select: { id: true, uniqueEmailId: true },
          });
          if (quote && !quote.uniqueEmailId) {
            const uniqueEmailId = quote.id.substring(0, 8).toUpperCase();
            await prisma.vendorQuote.update({
              where: { id: quoteId },
              data: { uniqueEmailId },
            });
            console.log(`✅ Stored uniqueEmailId ${uniqueEmailId} for quote ${quoteId}`);
          }
        }

        const updatedRequisition = await prisma.$transaction(async (tx) => {
          await tx.vendorQuote.updateMany({
            where: {
              id: { in: emailResult.successfulQuoteIds! },
            },
            data: {
              status: QuoteStatus.SENT,
              sentAt: new Date(),
            },
          });

          return tx.requisition.update({
            where: { id },
            data: {
              status: RequisitionStatus.SENT_FOR_QUOTE,
              isEditable: getIsEditableFromStatus(RequisitionStatus.SENT_FOR_QUOTE),
            },
          });
        });
        console.log(
          `✅ Updated ${emailResult.successfulQuoteIds.length} quote(s) to SENT and requisition ${id} to SENT_FOR_QUOTE`
        );

        // Record purchase history (non-blocking — must not revert status on failure)
        void recordPurchaseHistory({
          requisitionId: id,
          actionType: PurchaseHistoryActionType.SENT_FOR_QUOTE,
          performedById: userId!,
          actionDescription: `Quote requests sent to ${emailResult.success} vendor(s)`,
          previousStatus: requisition.status,
          newStatus: updatedRequisition.status,
          newValue: {
            vendorsCount: emailResult.success,
            vendorIds: emailResult.successfulQuoteIds || [],
          },
        });
      } else {
        // No emails were sent successfully - keep requisition status as is (REQ_APPROVED or SENT_FOR_QUOTE)
        const currentStatus = requisition.status;
        console.warn(`⚠️  No emails were sent successfully. Requisition ${id} remains in ${currentStatus} status.`);
      }

      // Keep failed quotes as PENDING
      if (emailResult.failed > 0) {
        console.warn(`⚠️  ${emailResult.failed} quote(s) remain in PENDING status due to email sending failures`);
        console.warn(`⚠️  Failed vendor errors:`, emailResult.errors);
      }
    } catch (emailError: any) {
      const errorMessage = emailError.message || 'Unknown error sending emails';
      const errorCode = emailError.code || emailError.response?.status || 'N/A';
      
      console.error('❌ Error sending emails (caught in route handler):', {
        message: errorMessage,
        code: errorCode,
        stack: emailError.stack,
        response: emailError.response?.data,
        fullError: emailError,
      });
      
      // All quotes remain PENDING since email sending failed
      emailResult = {
        success: 0,
        failed: vendorQuotes.length,
        errors: vendorQuotes.map(q => ({
          vendor: q.vendor.name,
          error: errorMessage,
          errorCode: errorCode,
        })),
      };
      console.warn(`⚠️  All ${vendorQuotes.length} quote(s) remain in PENDING status - no emails were sent`);
      console.warn(`⚠️  Requisition ${id} remains in ${requisition.status} status - no emails were sent`);

      // Do not downgrade if vendor quotes were already marked SENT (partial failure / retry)
      const sentQuoteCount = await prisma.vendorQuote.count({
        where: {
          requisitionId: id,
          status: { in: [QuoteStatus.SENT, QuoteStatus.RECEIVED, QuoteStatus.REJECTED, QuoteStatus.DECLINED, QuoteStatus.APPROVED] },
        },
      });
      if (sentQuoteCount > 0) {
        const allQuotes = await prisma.vendorQuote.findMany({
          where: { requisitionId: id },
          include: { quotedItems: { select: { unitPrice: true, totalPrice: true } } },
        });
        const derived = deriveStatusFromVendorQuotes(allQuotes, requisition.status);
        if (derived && derived !== requisition.status) {
          await prisma.requisition.update({
            where: { id },
            data: {
              status: derived,
              isEditable: getIsEditableFromStatus(derived),
            },
          });
          console.log(`✅ Requisition ${id} status synced to ${derived} based on existing sent quotes`);
        }
      } else if (requisition.status !== RequisitionStatus.REQ_APPROVED) {
        await prisma.requisition.update({
          where: { id },
          data: {
            status: RequisitionStatus.REQ_APPROVED,
            isEditable: getIsEditableFromStatus(RequisitionStatus.REQ_APPROVED),
          },
        });
      }
    }

    // Build response message
    let message = `Quote requests sent to ${vendors.length} vendor${vendors.length > 1 ? 's' : ''}`;
    if (emailResult) {
      if (emailResult.success > 0 && emailResult.failed > 0) {
        message = `Quote requests created for ${vendors.length} vendor${vendors.length > 1 ? 's' : ''}. ${emailResult.success} email${emailResult.success > 1 ? 's' : ''} sent successfully, ${emailResult.failed} failed.`;
      } else if (emailResult.failed > 0) {
        // All emails failed - provide more detailed error message
        const errorDetails = emailResult.errors.map(e => `${e.vendor}: ${e.error}`).join('; ');
        message = `Quote requests created for ${vendors.length} vendor${vendors.length > 1 ? 's' : ''}, but ALL ${emailResult.failed} email${emailResult.failed > 1 ? 's' : ''} failed to send. Errors: ${errorDetails}`;
      } else {
        message = `Quote requests sent to ${vendors.length} vendor${vendors.length > 1 ? 's' : ''}. All emails sent successfully.`;
      }
    }

    // If all emails failed, return a warning status (but still 200 to show the error details)
    const allEmailsFailed = emailResult && emailResult.success === 0 && emailResult.failed > 0;
    
    return NextResponse.json({
      message,
      vendorQuotes: vendorQuotes.map(quote => ({
        id: quote.id,
        vendor: quote.vendor,
        sentAt: quote.sentAt,
        validUntil: quote.validUntil,
        itemCount: quote.quotedItems?.length || 0,
      })),
      emailResults: emailResult ? {
        success: emailResult.success,
        failed: emailResult.failed,
        errors: emailResult.errors.map(err => ({
          vendor: err.vendor,
          error: err.error,
          // Include more details if available
          ...(typeof err === 'object' && 'originalError' in err ? { originalError: (err as any).originalError } : {}),
          ...(typeof err === 'object' && 'errorCode' in err ? { errorCode: (err as any).errorCode } : {}),
        })),
        allFailed: allEmailsFailed,
      } : null,
      warning: allEmailsFailed ? 'All emails failed to send. Please check Gmail API configuration and server logs. Check browser console and server logs for detailed error messages.' : undefined,
    }, { 
      status: allEmailsFailed ? 207 : 200 // 207 Multi-Status for partial success
    });
  } catch (error: any) {
    console.error("Error sending quote request:", error);
    const errorMessage = error?.message || "Failed to send quote request";
    const errorDetails = error?.stack ? `\nDetails: ${error.stack.substring(0, 200)}` : '';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails,
        ...(process.env.NODE_ENV === 'development' && { 
          stack: error?.stack,
          fullError: error?.toString() 
        })
      },
      { status: 500 }
    );
  }
}

// GET /api/requisitions/[id]/send-quote - Get available vendors for quote request
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = (await context.params);
    const { searchParams } = new URL(request.url);
    const country = searchParams.get("country") || "";
    const search = searchParams.get("search") || "";

    // Check if requisition exists
    const requisition = await prisma.requisition.findUnique({
      where: { id },
      include: {
        vessel: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            designation: true,
          },
        },
      },
    });

    if (!requisition) {
      return NextResponse.json(
        { error: "Requisition not found" },
        { status: 404 }
      );
    }

    // Build vendor filter
    const where: any = { isActive: true };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { contactPerson: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
      ];
    }

    if (country) {
      where.country = country;
    }

    // Get vendors with their quotes for this requisition
    const vendors = await prisma.vendor.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        quotes: {
          where: { requisitionId: id },
          select: {
            id: true,
            status: true,
            sentAt: true,
            receivedAt: true,
          },
        },
      },
    });

    // "Really quoted" = vendor submitted a quote (portal or email). We set receivedAt when we process their reply.
    // So: RECEIVED or APPROVED with receivedAt != null. Do not treat SENT (or RECEIVED with null receivedAt) as "received".
    const isReallyReceived = (q: { status: string; receivedAt: Date | null }) =>
      (q.status === 'RECEIVED' || q.status === 'APPROVED') && q.receivedAt != null;

    // Get unique countries for filtering
    const countries = await prisma.vendor.findMany({
      where: { isActive: true },
      select: { country: true },
      distinct: ['country'],
      orderBy: { country: 'asc' },
    });

    return NextResponse.json({
      vendors: vendors.map(vendor => {
        const reallyReceivedQuotes = vendor.quotes.filter(isReallyReceived);
        const sentOnlyQuotes = vendor.quotes.filter(q => q.status === 'SENT' || ((q.status === 'RECEIVED' || q.status === 'APPROVED') && q.receivedAt == null));
        // Prefer a really-received quote for display; else use a sent-only quote (so we can show "Sent")
        const displayQuote = reallyReceivedQuotes[0] ?? sentOnlyQuotes[0];
        const hasExistingQuote = reallyReceivedQuotes.length > 0;
        return {
          ...vendor,
          hasExistingQuote,
          lastQuoteStatus: displayQuote?.status ?? undefined,
          lastQuoteSentAt: displayQuote?.sentAt ?? undefined,
        };
      }),
      countries: countries.map(c => c.country),
      requisition: {
        id: requisition.id,
        heading: requisition.heading,
        status: requisition.status,
        portOfSupply: requisition.portOfSupply,
        requisitionNumber: requisition.requisitionNumber,
        dateOfCreation: requisition.dateOfCreation,
        vessel: requisition.vessel,
        createdBy: requisition.createdBy,
      },
    });
  } catch (error) {
    console.error("Error fetching vendors for quote request:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendors" },
      { status: 500 }
    );
  }
}