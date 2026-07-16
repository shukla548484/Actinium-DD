import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecureRequestContext, validateUUID, validateCompanyAccess } from '@/lib/api-security';
import prisma from '@/lib/prisma';

/**
 * GET /api/purchase-orders/[id]
 * Get purchase order details
 * SECURITY: Protected by secureApiRoute - requires authentication
 */
const getHandler = async (
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

    const accessLevel = context.user.designationAccessLevel ?? 0;
    const includeOrderTracking = accessLevel >= 26 && accessLevel <= 100;

    const fullInclude = {
      requisition: {
        include: {
          vessel: {
            select: {
              id: true,
              name: true,
              code: true,
              companyId: true,
            },
          },
        },
      },
      quote: {
        select: {
          id: true,
          quoteNumber: true,
          totalAmount: true,
          currency: true,
          deliveryCharges: true,
          deliveryChargesAttachment: true,
          otherChargesBreakdown: true,
          vendor: {
            select: {
              name: true,
              primaryEmail: true,
            },
          },
        },
      },
      attachments: {
        orderBy: {
          createdAt: 'desc',
        },
      },
      ...(includeOrderTracking && { orderTracking: true }),
    } as const;

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: fullInclude,
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

    return NextResponse.json({
      success: true,
      purchaseOrder,
    });
  } catch (error: any) {
    const code = error?.code;
    const meta = error?.meta;
    console.error('[purchase-orders GET] Error:', error?.message);
    console.error('[purchase-orders GET] Code:', code, 'Meta:', JSON.stringify(meta));
    console.error('[purchase-orders GET] Stack:', error?.stack);
    const body: Record<string, unknown> = {
      error: 'Failed to fetch purchase order',
      details: error?.message || 'Unknown error',
      code,
    };
    if (code === 'P2022') {
      if (meta) body.meta = meta;
      body.fix = 'Call once to add missing columns: GET /api/dev/apply-schema-fix (in dev) or /api/dev/apply-schema-fix?key=DEV_DIAGNOSTIC_KEY (set env and reload PO page).';
    }
    return NextResponse.json(body, { status: 500 });
  }
};

// Export with security wrapper (Next.js 15 compatible)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  return secureApiRoute(
    (req, ctx) => getHandler(req, ctx, params),
    { requireAuth: true, allowedMethods: ['GET'], minAccessLevel: 10 }
  )(request, { params });
}


