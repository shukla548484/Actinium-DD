import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';

interface RouteContext {
  params: Promise<{ quoteId: string }>;
}

/**
 * GET /api/purchase-orders/find-by-quote/[quoteId] - Find PO by quote ID
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { quoteId } = await context.params;

    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: { quoteId },
      include: {
        levelOneApprover: true,
        levelTwoApprover: true,
        levelThreeApprover: true,
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      id: purchaseOrder.id,
      poNumber: purchaseOrder.poNumber,
      purchaseOrder,
    });
  } catch (error: any) {
    console.error('Error finding Purchase Order:', error);
    return NextResponse.json(
      { error: 'Failed to find Purchase Order', details: error.message },
      { status: 500 }
    );
  }
}















