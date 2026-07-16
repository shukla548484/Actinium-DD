import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";

/**
 * GET /api/quotes/debug-requisition?requisitionNumber=O.ABTA.STR.25.0002
 * Debug endpoint to check why quotes aren't showing for a requisition
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser || !isAdminEquivalentAccessLevel(currentUser.designationAccessLevel)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requisitionNumber = searchParams.get('requisitionNumber');

    if (!requisitionNumber) {
      return NextResponse.json({ error: 'requisitionNumber parameter required' }, { status: 400 });
    }

    // Find requisition
    const requisition = await prisma.requisition.findUnique({
      where: { requisitionNumber },
      include: {
        vendorQuotes: {
          include: {
            vendor: true,
            quotedItems: true,
          },
        },
        vessel: {
          select: {
            name: true,
            imoNumber: true,
          },
        },
      },
    });

    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    // Find all emails related to this requisition
    const relatedEmails = await prisma.emailMessage.findMany({
      where: {
        OR: [
          { relatedRequisitionId: requisition.id },
          { subject: { contains: requisitionNumber } },
        ],
      },
      include: {
        attachments: true,
      },
      orderBy: { receivedAt: 'desc' },
    });

    // Find unprocessed emails with Excel attachments
    const unprocessedEmails = await prisma.emailMessage.findMany({
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
      },
      include: {
        attachments: true,
      },
      orderBy: { receivedAt: 'desc' },
      take: 20,
    });

    // Check for emails that might match this requisition
    const { normalizeEmailSubject } = await import('@/lib/email-utils');
    const potentialMatches = unprocessedEmails.filter(email => {
      const subject = email.subject || '';
      // Normalize subject to remove Re:/Fw: prefixes before matching
      const normalizedSubject = normalizeEmailSubject(subject);
      
      // Check if normalized subject contains requisition number
      return normalizedSubject.includes(requisitionNumber) || 
             normalizedSubject.includes(requisitionNumber.replace(/\./g, ' ')) ||
             normalizedSubject.includes(requisitionNumber.replace(/\./g, '-'));
    });

    return NextResponse.json({
      requisition: {
        id: requisition.id,
        requisitionNumber: requisition.requisitionNumber,
        heading: requisition.heading,
        status: requisition.status,
        vessel: requisition.vessel,
      },
      quotes: requisition.vendorQuotes.map(q => ({
        id: q.id,
        vendor: q.vendor.name,
        vendorEmail: q.vendor.primaryEmail,
        status: q.status,
        sentAt: q.sentAt,
        receivedAt: q.receivedAt,
        totalAmount: q.totalAmount,
        itemCount: q.quotedItems.length,
      })),
      relatedEmails: relatedEmails.map(e => ({
        id: e.id,
        subject: e.subject,
        from: e.from,
        receivedAt: e.receivedAt,
        processed: e.processed,
        hasAttachment: e.hasAttachment,
        attachments: e.attachments.map(a => ({
          filename: a.filename,
          size: a.size,
          storageType: a.storageType,
        })),
      })),
      unprocessedEmails: unprocessedEmails.map(e => ({
        id: e.id,
        subject: e.subject,
        from: e.from,
        receivedAt: e.receivedAt,
        attachments: e.attachments.map(a => ({
          filename: a.filename,
          size: a.size,
        })),
      })),
      potentialMatches: potentialMatches.map(e => ({
        id: e.id,
        subject: e.subject,
        from: e.from,
        receivedAt: e.receivedAt,
        attachments: e.attachments.map(a => ({
          filename: a.filename,
          size: a.size,
        })),
      })),
    });
  } catch (error: any) {
    console.error('Error debugging requisition:', error);
    return NextResponse.json(
      { error: 'Failed to debug requisition', details: error.message },
      { status: 500 }
    );
  }
}


