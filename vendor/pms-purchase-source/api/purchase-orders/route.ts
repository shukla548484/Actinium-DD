import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecureRequestContext, sanitizeInput, validateUUID } from '@/lib/api-security';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/purchase-orders
 * Get all purchase orders with optional filters
 * SECURITY: Protected by secureApiRoute - requires authentication
 */
const getHandler = async (
  request: NextRequest,
  context: SecureRequestContext
) => {
  try {

    const { searchParams } = new URL(request.url);
    const poNumber = sanitizeInput(searchParams.get('poNumber'));
    const poDetails = sanitizeInput(searchParams.get('poDetails'));
    const requisitionNumber = sanitizeInput(searchParams.get('requisitionNumber')); // Direct requisition number search
    const vesselIdRaw = searchParams.get('vesselId');
    const vesselId = vesselIdRaw ? validateUUID(vesselIdRaw, 'Vessel ID') || vesselIdRaw : null;
    const dateFrom = sanitizeInput(searchParams.get('dateFrom'));
    const dateTo = sanitizeInput(searchParams.get('dateTo'));
    
    // Determine user access level
    const accessLevel = context.user.designationAccessLevel ?? 0;
    const canSeeAllVessels = [50, 99, 100].includes(accessLevel);
    
    // Get user's assigned vessel IDs if not admin
    let assignedVesselIds: string[] = [];
    if (!canSeeAllVessels) {
      const assignedVessels = (context.user as any).assignedVessels || [];
      assignedVesselIds = assignedVessels
        .map((v: any) => v?.vessel?.id || v?.vesselId)
        .filter((id: string) => id);
      
      console.log('[PURCHASE ORDERS API] User vessel access:', {
        userId: context.user.id,
        accessLevel: accessLevel,
        canSeeAllVessels,
        assignedVesselsCount: assignedVessels.length,
        assignedVesselIdsCount: assignedVesselIds.length,
        assignedVesselIds,
        vesselIdProvided: !!vesselId,
      });
      
      // If non-admin user has no assigned vessels and no vessel filter, they should see no POs
      if (assignedVesselIds.length === 0 && !vesselId) {
        console.log('[PURCHASE ORDERS API] Non-admin user with no assigned vessels and no vessel filter, returning empty array');
        return NextResponse.json({
          success: true,
          purchaseOrders: [],
        });
      }
    } else {
      console.log('[PURCHASE ORDERS API] Admin user - can see all vessels');
    }

    // Validate vessel access if vesselId is provided
    if (vesselId && !canSeeAllVessels) {
      if (!assignedVesselIds.includes(vesselId)) {
        return NextResponse.json(
          { error: 'Access denied to vessel' },
          { status: 403 }
        );
      }
    }

    const where: any = {};
    const andConditions: any[] = [];

    // Filter by vessel - apply if vesselId is provided AND not empty string
    if (vesselId && vesselId.trim() !== '') {
      andConditions.push({
        requisition: {
          vesselId: vesselId,
        },
      });
      // Also ensure quote exists when filtering by vessel
      andConditions.push({
        quoteId: {
          not: null,
        },
      });
    } else if (!canSeeAllVessels && assignedVesselIds.length > 0) {
      // If no vessel filter but user has limited access, filter by assigned vessels
      andConditions.push({
        requisition: {
          vesselId: { in: assignedVesselIds },
        },
      });
      andConditions.push({
        quoteId: {
          not: null,
        },
      });
    } else if (canSeeAllVessels) {
      // For admins with no vessel filter, only ensure relationships exist (don't filter by vessel)
      // But still require requisition and quote to exist
      andConditions.push({
        requisitionId: {
          not: null,
        },
      });
      andConditions.push({
        quoteId: {
          not: null,
        },
      });
    } else {
      // Non-admin with no assigned vessels and no vessel filter - should not reach here due to early return above
      // But as a safety check, return empty array
      console.warn('[PURCHASE ORDERS API] Unexpected condition: non-admin, no assigned vessels, no vessel filter');
      return NextResponse.json({
        success: true,
        purchaseOrders: [],
      });
    }

    // Filter by PO number
    if (poNumber) {
      andConditions.push({
        poNumber: {
          contains: poNumber,
          mode: 'insensitive',
        },
      });
    }

    // Filter by requisition number (exact or partial match)
    if (requisitionNumber) {
      andConditions.push({
        requisition: {
          requisitionNumber: {
            contains: requisitionNumber,
            mode: 'insensitive',
          },
        },
      });
    }

    // Filter by PO details (requisition number, heading, vessel name, vendor name)
    // Note: If requisitionNumber is provided, this is redundant but kept for backward compatibility
    if (poDetails && !requisitionNumber) {
      const poDetailsConditions = [
        { requisition: { requisitionNumber: { contains: poDetails, mode: 'insensitive' } } },
        { requisition: { heading: { contains: poDetails, mode: 'insensitive' } } },
        { requisition: { vessel: { name: { contains: poDetails, mode: 'insensitive' } } } },
        { quote: { vendor: { name: { contains: poDetails, mode: 'insensitive' } } } },
      ];
      andConditions.push({ OR: poDetailsConditions });
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      const dateFilter: any = {};
      if (dateFrom) {
        dateFilter.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        dateFilter.lte = endDate;
      }
      andConditions.push({ dateOfIssue: dateFilter });
    }

    // Filter by status - only show ACTIVE (issued) purchase orders
    // Exclude CANCELLED or other non-active statuses
    andConditions.push({
      status: {
        equals: 'ACTIVE',
      },
    });

    // Combine all conditions with AND
    if (andConditions.length === 1) {
      Object.assign(where, andConditions[0]);
    } else if (andConditions.length > 1) {
      where.AND = andConditions;
    }

    // Log query for debugging
    console.log('[PURCHASE ORDERS API] Query filters:', {
      vesselId,
      vesselIdRaw,
      poNumber,
      poDetails,
      requisitionNumber,
      dateFrom,
      dateTo,
      canSeeAllVessels,
      assignedVesselIdsCount: assignedVesselIds.length,
      assignedVesselIds: assignedVesselIds.slice(0, 5), // Log first 5 for debugging
      whereCondition: JSON.stringify(where, null, 2),
    });

    let purchaseOrders;
    try {
      // First, let's check if there are any POs at all (without filters)
      const totalPOCount = await prisma.purchaseOrder.count({});
      const activePOCount = await prisma.purchaseOrder.count({
        where: { status: 'ACTIVE' }
      });
      console.log(`[PURCHASE ORDERS API] Total POs in database: ${totalPOCount}, Active POs: ${activePOCount}`);

      purchaseOrders = await prisma.purchaseOrder.findMany({
        where,
        include: {
          requisition: {
            include: {
              vessel: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
          quote: {
            include: {
              vendor: {
                select: {
                  id: true,
                  name: true,
                },
              },
              deliveryNotes: {
                orderBy: {
                  uploadedAt: 'desc',
                },
                take: 1, // Get the latest delivery note
                include: {
                  verifiedBy: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          },
          attachments: {
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
        orderBy: {
          dateOfIssue: 'desc',
        },
      });

      console.log(`[PURCHASE ORDERS API] Found ${purchaseOrders.length} purchase orders after filtering`);
      
      // Debug: Show sample PO data for troubleshooting
      if (purchaseOrders.length > 0) {
        console.log('[PURCHASE ORDERS API] Sample POs:', 
          purchaseOrders.slice(0, 5).map(po => ({
            poNumber: po.poNumber,
            requisitionNumber: po.requisition?.requisitionNumber,
            requisitionId: po.requisitionId,
            vesselId: po.requisition?.vesselId,
            vesselName: po.requisition?.vessel?.name,
            vesselCode: po.requisition?.vessel?.code,
            dateOfIssue: po.dateOfIssue,
            hasQuote: !!po.quote,
            quoteId: po.quoteId,
          }))
        );
      } else {
        // If no results, check what POs exist in the database to help debug
        const allPOs = await prisma.purchaseOrder.findMany({
          take: 10,
          where: {
            status: 'ACTIVE', // Only check active POs
          },
          include: {
            requisition: {
              include: {
                vessel: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
            quote: {
              include: {
                vendor: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        });
        console.log('[PURCHASE ORDERS API] Debug - Sample of ACTIVE POs in database (first 10):', 
          allPOs.map(po => ({
            poNumber: po.poNumber,
            status: po.status,
            requisitionNumber: po.requisition?.requisitionNumber,
            requisitionId: po.requisitionId,
            hasRequisition: !!po.requisition,
            vesselId: po.requisition?.vesselId,
            vesselName: po.requisition?.vessel?.name,
            hasQuote: !!po.quote,
            quoteId: po.quoteId,
            dateOfIssue: po.dateOfIssue,
            matchesVesselFilter: vesselId ? po.requisition?.vesselId === vesselId : 'N/A',
            inAssignedVessels: !canSeeAllVessels && assignedVesselIds.length > 0 
              ? assignedVesselIds.includes(po.requisition?.vesselId || '') 
              : 'N/A',
          }))
        );
        
        // Also check if there are POs without requisition or quote
        const posWithoutRequisition = await prisma.purchaseOrder.count({
          where: {
            status: 'ACTIVE',
            requisition: null,
          },
        });
        const posWithoutQuote = await prisma.purchaseOrder.count({
          where: {
            status: 'ACTIVE',
            quote: null,
          },
        });
        console.log(`[PURCHASE ORDERS API] Debug - Active POs without requisition: ${posWithoutRequisition}, without quote: ${posWithoutQuote}`);
      }
    } catch (queryError: any) {
      console.error('Prisma query error:', queryError);
      // If it's a relation error (e.g., missing quote or requisition), return empty array
      if (queryError.code === 'P2003' || queryError.code === 'P2025' || queryError.message?.includes('relation')) {
        console.warn('Query failed due to missing relations, returning empty array');
        return NextResponse.json({
          success: true,
          purchaseOrders: [],
        });
      }
      // Re-throw other errors to be caught by outer catch
      throw queryError;
    }

    // Map delivery note to purchase order structure
    // Filter out any POs with missing required relationships (shouldn't happen but safety check)
    const purchaseOrdersWithDN = purchaseOrders
      .filter(po => {
        // Ensure required relationships exist
        if (!po.requisition) {
          console.warn(`[PURCHASE ORDERS API] PO ${po.poNumber} has no requisition, skipping`);
          return false;
        }
        if (!po.quote) {
          console.warn(`[PURCHASE ORDERS API] PO ${po.poNumber} has no quote, skipping`);
          return false;
        }
        return true;
      })
      .map(po => ({
        ...po,
        deliveryNote: po.quote?.deliveryNotes?.[0] || null,
      }));

    // Always return success with purchaseOrders array (empty if none found)
    return NextResponse.json({
      success: true,
      purchaseOrders: purchaseOrdersWithDN || [],
    });
  } catch (error: any) {
    console.error('Error fetching purchase orders:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    });
    
    // Check if it's a known Prisma error that can be handled gracefully
    // For data integrity issues or connection errors, we should still return an error
    // But for query errors that might be due to missing data, return empty array
    if (error.code === 'P2002' || error.code === 'P2025') {
      // Unique constraint or record not found - return empty array
      return NextResponse.json({
        success: true,
        purchaseOrders: [],
      });
    }
    
    // For other errors, return error response but with better message
    return NextResponse.json(
      {
        error: 'Failed to fetch purchase orders',
        details: error.message || 'Unknown error',
        code: error.code,
      },
      { status: 500 }
    );
  }
};

// Export with security wrapper
export const GET = secureApiRoute(getHandler, {
  requireAuth: true,
  allowedMethods: ['GET'],
  minAccessLevel: 10, // Require at least level 10 to view purchase orders
});






