import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { QuoteStatus } from '@prisma/client';
import { recordQuoteRejectionHistory } from '@/lib/procurement/record-procurement-history';
import { markTaskNotificationsAsRead } from '@/lib/utils/mark-task-notifications-read';
import { notifyQuoteRejected } from '@/lib/procurement/approval-notifications';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/quotes/[id]/reject - Reject a quote
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
    });

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Get full quote details for logging
    const fullQuote = await prisma.vendorQuote.findUnique({
      where: { id },
      include: {
        requisition: true,
        vendor: true,
      },
    });

    // Update quote status
    const updatedQuote = await prisma.vendorQuote.update({
      where: { id },
      data: {
        status: QuoteStatus.REJECTED,
        notes: reason || quote.notes,
      },
    });

    // Log activity + notify purchaser
    try {
      if (fullQuote) {
        await recordQuoteRejectionHistory({
          requisitionId: fullQuote.requisitionId,
          performedById: currentUser.id,
          quoteId: fullQuote.id,
          quoteNumber: fullQuote.quoteNumber,
          reason,
        });

        await notifyQuoteRejected({
          request,
          actorUserId: currentUser.id,
          requisitionId: fullQuote.requisitionId,
          requisitionNumber: fullQuote.requisition.requisitionNumber,
          vesselId: fullQuote.requisition.vesselId,
          quoteId: fullQuote.id,
          quoteNumber: fullQuote.quoteNumber,
          reason,
          metadata: {
            vendorId: fullQuote.vendor.id,
            vendorName: fullQuote.vendor.name,
          },
        });
      }
    } catch (activityError: unknown) {
      console.error("Error logging quote rejection:", activityError);
    }

    await markTaskNotificationsAsRead(currentUser.id, id);
    return NextResponse.json({
      success: true,
      message: 'Quote rejected',
      quote: updatedQuote,
    });
  } catch (error: any) {
    console.error('Error rejecting quote:', error);
    return NextResponse.json(
      { error: 'Failed to reject quote', details: error.message },
      { status: 500 }
    );
  }
}
















