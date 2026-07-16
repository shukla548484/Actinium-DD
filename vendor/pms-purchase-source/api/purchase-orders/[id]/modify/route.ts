import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecureRequestContext, validateUUID, sanitizeInput, validateCompanyAccess } from '@/lib/api-security';
import { prisma } from '@/lib/prisma';
import { logActivityFromRequestWithNotification } from '@/lib/utils/enhanced-activity-logger';
import { isAdminEquivalentAccessLevel } from '@/lib/admin-access-level';

/**
 * POST /api/purchase-orders/[id]/modify
 * Modify a purchase order (record modification in history)
 * SECURITY: Protected by secureApiRoute - requires authentication and level 32+
 */
const handler = async (
  request: NextRequest,
  context: SecureRequestContext,
  params?: { id: string } | Promise<{ id: string }>
) => {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    if (!resolvedParams?.id) {
      return NextResponse.json(
        { error: 'Purchase order ID is required' },
        { status: 400 }
      );
    }
    
    const id = validateUUID(resolvedParams.id, 'Purchase Order ID');
    if (!id) {
      return NextResponse.json(
        { error: 'Invalid purchase order ID' },
        { status: 400 }
      );
    }
    
    const userAccessLevel = context.user.designationAccessLevel || 0;
    const allowedLevels = [32, 33, 50, 99, 100];
    if (!allowedLevels.includes(userAccessLevel) && !isAdminEquivalentAccessLevel(userAccessLevel)) {
      return NextResponse.json(
        {
          error: 'Insufficient permissions to modify Purchase Orders',
          userAccessLevel,
          requiredLevels: allowedLevels,
        },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const cleanData = sanitizeInput(body);
    const { comments } = cleanData;

    if (!comments || !comments.trim()) {
      return NextResponse.json(
        { error: 'Comments are required for modification' },
        { status: 400 }
      );
    }

    // Get existing purchase order with vessel for access validation
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        requisition: {
          include: {
            vessel: {
              select: {
                id: true,
                companyId: true,
              },
            },
          },
        },
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }
    
    // Validate company access through vessel
    if (purchaseOrder.requisition?.vessel?.companyId) {
      const hasAccess = await validateCompanyAccess(
        context,
        purchaseOrder.requisition.vessel.companyId,
        id
      );
      
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    if (purchaseOrder.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Only active purchase orders can be modified' },
        { status: 400 }
      );
    }

    const previousStatus = purchaseOrder.status;
    const previousValue = {
      status: purchaseOrder.status,
      totalAmount: purchaseOrder.totalAmount,
      currency: purchaseOrder.currency,
    };

    // Record modification in history
    await prisma.purchaseOrderHistory.create({
      data: {
        purchaseOrderId: id,
        actionType: 'MODIFIED',
        actionDescription: `Purchase Order ${purchaseOrder.poNumber} modified`,
        previousStatus: previousStatus,
        newStatus: previousStatus, // Status doesn't change on modify
        previousValue: JSON.stringify(previousValue),
        newValue: JSON.stringify(previousValue), // Can be updated later if needed
        comments: comments.trim(),
        performedById: context.userId,
      },
    });

    console.log(`✅ Purchase Order ${purchaseOrder.poNumber} modification recorded`);

    // Log activity
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.actinium-sm.org";
      await logActivityFromRequestWithNotification(
        request,
        context.userId,
        "MODIFY_PURCHASE_ORDER",
        `Modified Purchase Order ${purchaseOrder.poNumber}`,
        {
          module: "Purchase",
          page: "/purchase/view-pos",
          purchaseOrderNumber: purchaseOrder.poNumber,
          requisitionNumber: purchaseOrder.requisition?.requisitionNumber,
          vesselId: purchaseOrder.requisition?.vesselId,
          metadata: {
            comments: comments.trim(),
          },
          createNotification: false, // Modifications don't need approval
        }
      );
    } catch (activityError: any) {
      console.error('Error logging activity:', activityError);
    }

    return NextResponse.json({
      success: true,
      message: 'Purchase Order modification recorded',
    });
  } catch (error: any) {
    console.error('Error modifying purchase order:', error);
    return NextResponse.json(
      {
        error: 'Failed to modify purchase order',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
};

// Export with security wrapper (Next.js 15 compatible)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  return secureApiRoute(
    (req, ctx) => handler(req, ctx, params),
    { requireAuth: true, allowedMethods: ['POST'], minAccessLevel: 32 } // Level 32+ required
  )(request, { params });
}












