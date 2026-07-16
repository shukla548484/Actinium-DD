import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { RequisitionStatus } from '@/lib/types/requisition';
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";

/**
 * GET /api/purchase/dashboard/stats
 * Get purchase dashboard statistics for requisitions, purchase orders, and invoices
 * Filters by vessel if provided, otherwise shows data for all user's assigned vessels
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vesselId = searchParams.get('vesselId');

    // Get user's assigned vessel IDs
    const assignedVessels = await prisma.employeeVessel.findMany({
      where: {
        employeeId: currentUser.id,
      },
      select: {
        vesselId: true,
      },
    });

    const assignedVesselIds = assignedVessels.map(av => av.vesselId);

    // If user has access level 50 (admin), they can see all vessels
    const canSeeAllVessels = isAdminEquivalentAccessLevel(currentUser.designationAccessLevel);

    // Build vessel filter
    let vesselFilter: Record<string, any> = {};

    if (vesselId) {
      // If specific vessel is selected, verify user has access to it
      if (!canSeeAllVessels && !assignedVesselIds.includes(vesselId)) {
        return NextResponse.json(
          { error: 'Access denied. You do not have access to this vessel.' },
          { status: 403 }
        );
      }
      vesselFilter = { vesselId };
    } else {
      // No vessel selected - show data for all user's assigned vessels
      if (!canSeeAllVessels) {
        if (assignedVesselIds.length === 0) {
          // User has no assigned vessels - return empty stats
          return NextResponse.json({
            stats: {
              totalRequisitions: 0,
              pendingRequisitions: 0,
              approvedRequisitions: 0,
              totalQuotes: 0,
              totalPurchaseOrders: 0,
              totalInvoices: 0,
              totalAmount: 0,
              pendingAmount: 0,
            },
          });
        }
        vesselFilter = { vesselId: { in: assignedVesselIds } };
      }
      // If admin, no vessel filter needed - will show all vessels
    }

    // Build requisition filter
    const requisitionWhere: any = {};
    if (vesselId) {
      requisitionWhere.vesselId = vesselId;
    } else if (!canSeeAllVessels && assignedVesselIds.length > 0) {
      requisitionWhere.vesselId = { in: assignedVesselIds };
    }

    // Build purchase order filter (through requisition)
    const poWhere: any = {};
    if (vesselId) {
      poWhere.requisition = { vesselId };
    } else if (!canSeeAllVessels && assignedVesselIds.length > 0) {
      poWhere.requisition = { vesselId: { in: assignedVesselIds } };
    }

    // Build invoice filter (through requisition directly or through purchase order -> requisition)
    const invoiceWhere: any = {};
    if (vesselId) {
      invoiceWhere.OR = [
        { requisition: { vesselId } },
        { purchaseOrder: { requisition: { vesselId } } },
      ];
    } else if (!canSeeAllVessels && assignedVesselIds.length > 0) {
      invoiceWhere.OR = [
        { requisition: { vesselId: { in: assignedVesselIds } } },
        { purchaseOrder: { requisition: { vesselId: { in: assignedVesselIds } } } },
      ];
    }

    // Fetch all stats in parallel
    const [
      totalRequisitions,
      pendingRequisitions,
      approvedRequisitions,
      totalQuotes,
      totalPurchaseOrders,
      totalInvoices,
      totalAmountResult,
      pendingAmountResult,
    ] = await Promise.all([
      // Total requisitions
      prisma.requisition.count({
        where: requisitionWhere,
      }),

      // Pending requisitions (NOT_READY status)
      prisma.requisition.count({
        where: {
          ...requisitionWhere,
          status: RequisitionStatus.NOT_READY,
        },
      }),

      // Approved requisitions
      prisma.requisition.count({
        where: {
          ...requisitionWhere,
          status: RequisitionStatus.REQ_APPROVED,
        },
      }),

      // Total quotes
      prisma.vendorQuote.count({
        where: {
          requisition: requisitionWhere,
        },
      }),

      // Total purchase orders
      prisma.purchaseOrder.count({
        where: poWhere,
      }),

      // Total invoices
      prisma.invoice.count({
        where: invoiceWhere,
      }),

      // Total amount (sum of all purchase orders)
      prisma.purchaseOrder.aggregate({
        where: poWhere,
        _sum: {
          totalAmount: true,
        },
      }),

      // Pending amount (sum of invoices that are not paid - status is not PAID)
      prisma.invoice.aggregate({
        where: {
          ...invoiceWhere,
          status: {
            not: 'PAID',
          },
        },
        _sum: {
          invoiceAmount: true,
        },
      }),
    ]);

    const stats = {
      totalRequisitions,
      pendingRequisitions,
      approvedRequisitions,
      totalQuotes,
      totalPurchaseOrders,
      totalInvoices,
      totalAmount: totalAmountResult._sum.totalAmount || 0,
      pendingAmount: pendingAmountResult._sum.invoiceAmount || 0,
    };

    return NextResponse.json({ stats });
  } catch (error: any) {
    console.error('Error fetching purchase dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics', details: error.message },
      { status: 500 }
    );
  }
}

