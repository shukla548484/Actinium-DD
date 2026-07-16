import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecureRequestContext, validateUUID, sanitizeInput, validateCompanyAccess } from '@/lib/api-security';
import { prisma } from '@/lib/prisma';
import { logActivityFromRequestWithNotification } from '@/lib/utils/enhanced-activity-logger';
import { markTaskNotificationsAsRead } from '@/lib/utils/mark-task-notifications-read';
import {
  PurchaseOrderPurgeBlockedError,
  purgePurchaseOrderRecord,
} from '@/lib/procurement/purge-purchase-order';
import { isAdminEquivalentAccessLevel } from '@/lib/admin-access-level';
import { PurchaseOrderWorkflowStatus } from '@/lib/types/purchase-order-workflow';

/**
 * POST /api/purchase-orders/[id]/cancel
 * Cancel a purchase order
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
          error: 'Insufficient permissions to cancel Purchase Orders',
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
        { error: 'Comments are required for cancellation' },
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

    const workflowStatus =
      purchaseOrder.workflowStatus ?? PurchaseOrderWorkflowStatus.PO_CREATED;

    if (workflowStatus === PurchaseOrderWorkflowStatus.PO_SENT) {
      return NextResponse.json(
        {
          error: 'Purchase orders that have been sent to the vendor cannot be cancelled in the system',
        },
        { status: 400 }
      );
    }

    if (
      purchaseOrder.status === 'CANCELLED' ||
      workflowStatus === PurchaseOrderWorkflowStatus.CANCELLED
    ) {
      return NextResponse.json(
        { error: 'Purchase order is already cancelled' },
        { status: 400 }
      );
    }

    try {
      await purgePurchaseOrderRecord({
        purchaseOrderId: id,
        performedById: context.userId,
        reason: comments.trim(),
      });
    } catch (purgeError) {
      if (purgeError instanceof PurchaseOrderPurgeBlockedError) {
        return NextResponse.json({ error: purgeError.message }, { status: 400 });
      }
      throw purgeError;
    }

    console.log(`✅ Purchase Order ${purchaseOrder.poNumber} removed from system`);

    // Log activity with notification
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.actinium-sm.org";
      await logActivityFromRequestWithNotification(
        request,
        context.userId,
        "CANCEL_PURCHASE_ORDER",
        `Cancelled Purchase Order ${purchaseOrder.poNumber}`,
        {
          module: "Purchase",
          page: "/purchase/view-pos",
          purchaseOrderNumber: purchaseOrder.poNumber,
          requisitionNumber: purchaseOrder.requisition?.requisitionNumber,
          vesselId: purchaseOrder.requisition?.vesselId,
          metadata: {
            comments: comments.trim(),
            removed: true,
          },
          createNotification: true,
          notificationType: "INFO",
          actionUrl: `${baseUrl}/purchase/view-pos?po=${encodeURIComponent(purchaseOrder.poNumber)}&from=notification`,
          targetAccessLevels: [32, 33, 50, 99, 100], // Managers + admin-equivalent
        }
      );
    } catch (activityError: any) {
      console.error('Error logging activity:', activityError);
    }

    await markTaskNotificationsAsRead(context.userId, purchaseOrder.poNumber || id);
    return NextResponse.json({
      success: true,
      message: 'Purchase Order removed successfully',
    });
  } catch (error: any) {
    console.error('Error cancelling purchase order:', error);
    return NextResponse.json(
      {
        error: 'Failed to cancel purchase order',
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












