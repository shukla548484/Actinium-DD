import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';

/**
 * GET /api/requisitions/[id]/diagnose-quotes
 * Comprehensive diagnostic tool to check quote processing status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: requisitionId } = await params;

    // Step 1: Check if requisition exists
    const requisition = await prisma.requisition.findUnique({
      where: { id: requisitionId },
      include: {
        vessel: {
          select: {
            id: true,
            name: true,
            imoNumber: true,
          },
        },
        vendorQuotes: {
          include: {
            vendor: {
              select: {
                id: true,
                name: true,
                primaryEmail: true,
                secondaryEmail: true,
              },
            },
            quotedItems: true,
          },
        },
      },
    });

    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    const diagnostics: any = {
      requisition: {
        id: requisition.id,
        requisitionNumber: requisition.requisitionNumber,
        status: requisition.status,
        vessel: requisition.vessel,
      },
      steps: [],
      issues: [],
      recommendations: [],
    };

    // Step 2: Check for emails related to this requisition
    // Build comprehensive search criteria
    const vendorEmails = requisition.vendorQuotes
      .map(q => [q.vendor.primaryEmail, q.vendor.secondaryEmail].filter(Boolean))
      .flat();
    
    // Normalize requisition number for pattern matching (handle dots, spaces, underscores, dashes)
    const reqNumberNormalized = requisition.requisitionNumber.replace(/[.\s_-]/g, '');
    const reqNumberPatterns = [
      requisition.requisitionNumber,
      requisition.requisitionNumber.replace(/\./g, ' '),
      requisition.requisitionNumber.replace(/\./g, '-'),
      requisition.requisitionNumber.replace(/\./g, '_'),
      reqNumberNormalized,
    ];

    // Search for emails in multiple ways
    const relatedEmails = await prisma.emailMessage.findMany({
      where: {
        OR: [
          // Directly linked emails
          { relatedRequisitionId: requisitionId },
          { relatedQuoteId: { in: requisition.vendorQuotes.map(q => q.id) } },
          
          // Emails from vendors associated with this requisition
          ...(vendorEmails.length > 0 ? [{
            from: { in: vendorEmails }
          }] : []),
          
          // Emails with requisition number in subject (various formats)
          ...reqNumberPatterns.map(pattern => ({
            subject: {
              contains: pattern,
              mode: 'insensitive' as const,
            },
          })),
          
          // Emails with Excel attachments that might contain requisition number in filename
          {
            attachments: {
              some: {
                OR: reqNumberPatterns.map(pattern => ({
                  filename: {
                    contains: pattern,
                    mode: 'insensitive' as const,
                  },
                })),
              },
            },
          },
          
          // Emails with QUOTE_RESPONSE type (might be unlinked)
          {
            emailType: 'QUOTE_RESPONSE',
            hasAttachment: true,
          },
        ],
      },
      include: {
        attachments: true,
      },
      orderBy: { receivedAt: 'desc' },
      take: 100, // Limit to prevent too many results
    });

    // Also check for unprocessed emails that might match
    const unprocessedEmailsWithAttachments = await prisma.emailMessage.findMany({
      where: {
        processed: false,
        hasAttachment: true,
        attachments: {
          some: {
            filename: {
              endsWith: '.xlsx',
            },
          },
        },
        // Check if from any vendor email or has requisition number in subject/attachment
        OR: [
          ...(vendorEmails.length > 0 ? [{
            from: { in: vendorEmails }
          }] : []),
          ...reqNumberPatterns.map(pattern => ({
            subject: {
              contains: pattern,
              mode: 'insensitive' as const,
            },
          })),
          {
            attachments: {
              some: {
                OR: reqNumberPatterns.map(pattern => ({
                  filename: {
                    contains: pattern,
                    mode: 'insensitive' as const,
                  },
                })),
              },
            },
          },
        ],
      },
      include: {
        attachments: true,
      },
      orderBy: { receivedAt: 'desc' },
      take: 20,
    });

    // Combine related emails and unprocessed potential matches first
    const allRelatedEmails = [
      ...relatedEmails,
      ...unprocessedEmailsWithAttachments.filter(
        email => !relatedEmails.find(e => e.id === email.id)
      ),
    ];

    // Additional check: All emails from vendors (even without Excel attachments initially)
    const allVendorEmails = vendorEmails.length > 0 ? await prisma.emailMessage.findMany({
      where: {
        from: { in: vendorEmails },
        receivedAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
        },
      },
      include: {
        attachments: true,
      },
      orderBy: { receivedAt: 'desc' },
      take: 50,
    }) : [];

    // Filter out duplicates and add vendor emails
    const uniqueVendorEmails = allVendorEmails.filter(
      email => !allRelatedEmails.find(e => e.id === email.id)
    );

    // Add vendor emails to the combined list
    allRelatedEmails.push(...uniqueVendorEmails);

    diagnostics.steps.push({
      step: 1,
      name: 'Check Received Emails',
      status: allRelatedEmails.length > 0 ? 'PASS' : 'FAIL',
      details: {
        totalEmails: allRelatedEmails.length,
        linkedEmails: relatedEmails.length,
        unprocessedPotentialMatches: unprocessedEmailsWithAttachments.length,
        vendorEmailsFound: uniqueVendorEmails.length,
        searchCriteria: {
          requisitionNumber: requisition.requisitionNumber,
          vendorEmails: vendorEmails,
          patternsSearched: reqNumberPatterns,
          searchMethods: [
            'Directly linked (relatedRequisitionId)',
            'Linked to quotes (relatedQuoteId)',
            'From vendor emails',
            'Requisition number in subject',
            'Requisition number in attachment filename',
            'QUOTE_RESPONSE type',
            'Unprocessed emails with Excel attachments',
            'All emails from vendors (last 90 days)',
          ],
        },
        emails: allRelatedEmails.map((email) => ({
          id: email.id,
          subject: email.subject,
          from: email.from,
          receivedAt: email.receivedAt,
          processed: email.processed,
          hasAttachment: email.hasAttachment,
          emailType: email.emailType,
          relatedRequisitionId: email.relatedRequisitionId,
          relatedQuoteId: email.relatedQuoteId,
          attachmentCount: email.attachments.length,
          excelAttachments: email.attachments.filter(
            att => att.filename.endsWith('.xlsx') || att.filename.endsWith('.xls')
          ).map(att => ({
            filename: att.filename,
            size: att.size,
          })),
        })),
      },
    });

    // Check total emails in database to see if email syncing is working
    const totalEmailsInDatabase = await prisma.emailMessage.count();
    const recentEmailsCount = await prisma.emailMessage.count({
      where: {
        receivedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
    });

    if (allRelatedEmails.length === 0) {
      diagnostics.issues.push('No emails found related to this requisition');
      
      if (totalEmailsInDatabase === 0) {
        diagnostics.issues.push('No emails found in database at all - email syncing may not be working');
        diagnostics.recommendations.push('Run email sync to fetch emails from Gmail inbox');
        diagnostics.recommendations.push('Check Gmail API authentication and permissions');
      } else if (recentEmailsCount === 0) {
        diagnostics.issues.push('No recent emails in database - email polling may not be working');
        diagnostics.recommendations.push('Check if email polling is running and fetching new emails');
      } else {
        diagnostics.recommendations.push('Check if quote request emails were sent to vendors');
        diagnostics.recommendations.push('Check if vendors replied to the quote request emails');
        diagnostics.recommendations.push('Verify vendor email addresses are correct in the system');
      }
      
      diagnostics.recommendations.push('Check email inbox manually for quote response emails');
      diagnostics.recommendations.push('Verify email polling is working and checking inbox regularly');
    } else if (unprocessedEmailsWithAttachments.length > 0) {
      diagnostics.issues.push(`${unprocessedEmailsWithAttachments.length} unprocessed email(s) found that might be quote responses`);
      diagnostics.recommendations.push('Run quote processing to match and process these emails');
      diagnostics.recommendations.push('Use /api/quotes/process-responses endpoint to process unprocessed emails');
    }
    
    // Add database statistics
    diagnostics.databaseStats = {
      totalEmailsInDatabase,
      recentEmailsLast7Days: recentEmailsCount,
      emailsWithAttachments: await prisma.emailMessage.count({
        where: { hasAttachment: true },
      }),
      unprocessedEmails: await prisma.emailMessage.count({
        where: { processed: false },
      }),
    };

    // Step 3: Check for Excel attachments in emails
    const excelAttachments = allRelatedEmails.flatMap((email) =>
      email.attachments
        .filter((att) => att.filename.endsWith('.xlsx') || att.filename.endsWith('.xls'))
        .map((att) => ({
          emailId: email.id,
          emailSubject: email.subject,
          attachmentId: att.id,
          filename: att.filename,
          size: att.size,
          hasFileData: !!att.fileData,
          hasFileUrl: !!att.fileUrl,
          fileUrl: att.fileUrl,
          storageType: att.storageType,
          parsedData: att.parsedData ? 'Yes' : 'No',
        }))
    );

    diagnostics.steps.push({
      step: 2,
      name: 'Check Quote Files Received',
      status: excelAttachments.length > 0 ? 'PASS' : 'FAIL',
      details: {
        totalExcelFiles: excelAttachments.length,
        attachments: excelAttachments,
      },
    });

    if (excelAttachments.length === 0 && allRelatedEmails.length > 0) {
      diagnostics.issues.push('Emails found but no Excel attachments detected');
      diagnostics.recommendations.push('Vendors may have replied without attaching the Excel file');
    }

    // Step 4: Check database quotes
    diagnostics.steps.push({
      step: 3,
      name: 'Check Database Quotes',
      status: requisition.vendorQuotes.length > 0 ? 'PASS' : 'FAIL',
      details: {
        totalQuotes: requisition.vendorQuotes.length,
        quotes: requisition.vendorQuotes.map((quote) => ({
          id: quote.id,
          vendorName: quote.vendor.name,
          vendorEmail: quote.vendor.primaryEmail,
          status: quote.status,
          totalAmount: quote.totalAmount,
          receivedAt: quote.receivedAt,
          itemCount: quote.quotedItems.length,
          hasItems: quote.quotedItems.length > 0,
        })),
      },
    });

    // Step 5: Check if quotes have RECEIVED status
    const receivedQuotes = requisition.vendorQuotes.filter((q) => q.status === 'RECEIVED');
    diagnostics.steps.push({
      step: 4,
      name: 'Check Quote Status (RECEIVED)',
      status: receivedQuotes.length > 0 ? 'PASS' : 'FAIL',
      details: {
        receivedQuotes: receivedQuotes.length,
        totalQuotes: requisition.vendorQuotes.length,
        quotes: requisition.vendorQuotes.map((q) => ({
          id: q.id,
          vendor: q.vendor.name,
          status: q.status,
        })),
      },
    });

    if (receivedQuotes.length === 0 && requisition.vendorQuotes.length > 0) {
      diagnostics.issues.push('Quotes exist but none have RECEIVED status');
      diagnostics.recommendations.push('Check if quote processing completed successfully');
    }

    // Step 6: Check Google Cloud Storage files
    const attachmentsWithUrls = excelAttachments.filter((att) => att.hasFileUrl);
    const gcsAttachments = attachmentsWithUrls.filter(
      (att) => att.storageType === 'GOOGLE_CLOUD_STORAGE' || att.fileUrl?.includes('storage.googleapis.com')
    );

    diagnostics.steps.push({
      step: 5,
      name: 'Check Google Cloud Storage Files',
      status: gcsAttachments.length > 0 ? 'PASS' : 'WARNING',
      details: {
        totalGcsFiles: gcsAttachments.length,
        attachments: gcsAttachments.map((att) => ({
          filename: att.filename,
          fileUrl: att.fileUrl,
          storageType: att.storageType,
        })),
      },
    });

    if (gcsAttachments.length === 0 && excelAttachments.length > 0) {
      diagnostics.issues.push('Excel files found but not uploaded to Google Cloud Storage');
      diagnostics.recommendations.push('Files may be stored in database only. Check storage configuration.');
    }

    // Step 7: Check file URL accessibility
    const urlChecks = await Promise.all(
      gcsAttachments.map(async (att) => {
        if (!att.fileUrl) {
          return { filename: att.filename, accessible: false, error: 'No URL' };
        }
        try {
          const response = await fetch(att.fileUrl, { method: 'HEAD' });
          return {
            filename: att.filename,
            url: att.fileUrl,
            accessible: response.ok,
            status: response.status,
            error: response.ok ? null : `HTTP ${response.status}`,
          };
        } catch (error: any) {
          return {
            filename: att.filename,
            url: att.fileUrl,
            accessible: false,
            error: error.message || 'Network error',
          };
        }
      })
    );

    diagnostics.steps.push({
      step: 6,
      name: 'Check File URL Accessibility',
      status: urlChecks.every((check) => check.accessible) ? 'PASS' : 'WARNING',
      details: {
        urlChecks,
      },
    });

    // Step 8: Match emails to quotes
    const emailQuoteMatches = requisition.vendorQuotes.map((quote) => {
      const matchingEmails = allRelatedEmails.filter(
        (email) =>
          email.relatedQuoteId === quote.id ||
          (email.from &&
            (email.from.includes(quote.vendor.primaryEmail) ||
              email.from.includes(quote.vendor.secondaryEmail || '')))
      );
      return {
        quoteId: quote.id,
        vendorName: quote.vendor.name,
        vendorEmail: quote.vendor.primaryEmail,
        matchingEmails: matchingEmails.length,
        emails: matchingEmails.map((e) => ({
          id: e.id,
          subject: e.subject,
          from: e.from,
          processed: e.processed,
          hasExcelAttachment: e.attachments.some(
            att => att.filename.endsWith('.xlsx') || att.filename.endsWith('.xls')
          ),
        })),
      };
    });

    diagnostics.steps.push({
      step: 7,
      name: 'Match Emails to Quotes',
      status: 'INFO',
      details: {
        matches: emailQuoteMatches,
      },
    });

    // Summary
    const allStepsPassed = diagnostics.steps.every(
      (step: any) => step.status === 'PASS' || step.status === 'INFO' || step.status === 'WARNING'
    );
    diagnostics.summary = {
      allStepsPassed,
      totalSteps: diagnostics.steps.length,
      passedSteps: diagnostics.steps.filter((s: any) => s.status === 'PASS').length,
      failedSteps: diagnostics.steps.filter((s: any) => s.status === 'FAIL').length,
      issuesCount: diagnostics.issues.length,
    };

    return NextResponse.json(diagnostics);
  } catch (error: any) {
    console.error('Error diagnosing quotes:', error);
    return NextResponse.json(
      { error: 'Failed to diagnose quotes', details: error.message },
      { status: 500 }
    );
  }
}

