import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { detectAndProcessQuoteResponses } from '@/lib/quote-email-detector';
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";

/**
 * POST /api/quotes/process-manual
 * Manually trigger processing of quote responses for a specific requisition
 * Body: { requisitionNumber?: string, requisitionId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser || !isAdminEquivalentAccessLevel(currentUser.designationAccessLevel)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { requisitionNumber, requisitionId } = body;

    if (!requisitionNumber && !requisitionId) {
      return NextResponse.json(
        { error: 'requisitionNumber or requisitionId required' },
        { status: 400 }
      );
    }

    // Find requisition
    let requisition;
    if (requisitionId) {
      requisition = await prisma.requisition.findUnique({
        where: { id: requisitionId },
        include: {
          vendorQuotes: {
            include: { vendor: true },
          },
        },
      });
    } else {
      requisition = await prisma.requisition.findUnique({
        where: { requisitionNumber },
        include: {
          vendorQuotes: {
            include: { vendor: true },
          },
        },
      });
    }

    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    console.log(`🔄 Manually processing quote responses for requisition ${requisition.requisitionNumber}`);

    // Process all quote responses (no userId filter for manual processing)
    const result = await detectAndProcessQuoteResponses();

    // Get updated quotes
    const updatedQuotes = await prisma.vendorQuote.findMany({
      where: {
        requisitionId: requisition.id,
        status: 'RECEIVED',
      },
      include: {
        vendor: true,
        quotedItems: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Processed quote responses for requisition ${requisition.requisitionNumber}`,
      requisition: {
        id: requisition.id,
        requisitionNumber: requisition.requisitionNumber,
        status: requisition.status,
      },
      quotesReceived: updatedQuotes.length,
      quotes: updatedQuotes.map(q => ({
        id: q.id,
        vendor: q.vendor.name,
        status: q.status,
        receivedAt: q.receivedAt,
        totalAmount: q.totalAmount,
        itemCount: q.quotedItems.length,
      })),
    });
  } catch (error: any) {
    console.error('Error manually processing quotes:', error);
    return NextResponse.json(
      { error: 'Failed to process quotes', details: error.message },
      { status: 500 }
    );
  }
}

















