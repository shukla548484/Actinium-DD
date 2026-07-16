import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { QuoteStatus } from '@prisma/client';
import { RequisitionStatus } from '@/lib/types/requisition';
import { notifyQuoteApprovedForConfirm } from '@/lib/procurement/approval-notifications';
import { recordQuoteApprovalHistory } from '@/lib/procurement/record-procurement-history';
import { markTaskNotificationsAsRead } from '@/lib/utils/mark-task-notifications-read';
import { isAdminEquivalentAccessLevel } from '@/lib/admin-access-level';
import {
  applyConfirmedQuoteQuantities,
  parseConfirmedQuantities,
} from '@/lib/procurement/apply-confirmed-quote-quantities';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/quotes/[id]/approve - Approve a quote
 * Access Requirements:
 * - User must have access level 37, 39, or admin-equivalent (50/99/100)
 * - Quote must be in RECEIVED status
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
    const allowedLevels = [37, 39, 50, 99, 100];
    if (!allowedLevels.includes(userAccessLevel) && !isAdminEquivalentAccessLevel(userAccessLevel)) {
      return NextResponse.json(
        { 
          error: 'Insufficient permissions to approve quotes',
          message: `Access level ${userAccessLevel} is not authorized to approve quotes. Required: 37, 39, or admin-equivalent (50/99/100)`,
          userAccessLevel,
          requiredLevels: allowedLevels
        },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();
    const { notes, confirmedQuantities: confirmedQuantitiesRaw } = body;

    const quote = await prisma.vendorQuote.findUnique({
      where: { id },
      include: {
        requisition: { include: { items: { orderBy: { createdAt: 'asc' } } } },
        vendor: true,
      },
    });

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (quote.status !== QuoteStatus.RECEIVED) {
      return NextResponse.json(
        { error: 'Only received quotes can be approved' },
        { status: 400 }
      );
    }

    // Check if any other quote for this requisition is already approved
    // Only one quote can be approved at a time per requisition
    const existingApprovedQuote = await prisma.vendorQuote.findFirst({
      where: {
        requisitionId: quote.requisitionId,
        status: QuoteStatus.APPROVED,
        id: { not: id }, // Exclude the current quote
      },
    });

    if (existingApprovedQuote) {
      return NextResponse.json(
        { 
          error: 'Another quote is already approved for this requisition',
          message: 'Only one quote can be approved at a time. Please return the approved quote first if you want to approve a different one.',
        },
        { status: 400 }
      );
    }

    const validItemIds = new Set(quote.requisition.items.map((item) => item.id));
    const confirmedQuantities = parseConfirmedQuantities(confirmedQuantitiesRaw, validItemIds);

    if (confirmedQuantities.length > 0) {
      await applyConfirmedQuoteQuantities({
        quoteId: id,
        confirmedQuantities,
      });
    }

    const updatedQuote = await prisma.vendorQuote.update({
      where: { id },
      data: {
        status: QuoteStatus.APPROVED,
        notes: notes || quote.notes,
      },
    });

    // Update requisition status
    await prisma.requisition.update({
      where: { id: quote.requisitionId },
      data: {
        status: RequisitionStatus.QUOTE_APPROVED,
      },
    });

    await recordQuoteApprovalHistory({
      requisitionId: quote.requisitionId,
      performedById: currentUser.id,
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      previousRequisitionStatus: quote.requisition.status,
    });

    try {
      await notifyQuoteApprovedForConfirm({
        request,
        actorUserId: currentUser.id,
        requisitionNumber: quote.requisition.requisitionNumber,
        vesselId: quote.requisition.vesselId,
        quoteId: quote.id,
        metadata: {
          quoteNumber: quote.quoteNumber,
          vendorName: quote.vendor.name,
          totalAmount: quote.totalAmount,
          currency: quote.currency,
        },
      });
    } catch (activityError: unknown) {
      console.error('Error logging quote approval notification:', activityError);
    }

    await markTaskNotificationsAsRead(currentUser.id, id);
    return NextResponse.json({
      success: true,
      message: 'Quote approved successfully',
      quote: updatedQuote,
    });
  } catch (error: any) {
    console.error('Error approving quote:', error);
    return NextResponse.json(
      { error: 'Failed to approve quote', details: error.message },
      { status: 500 }
    );
  }
}






