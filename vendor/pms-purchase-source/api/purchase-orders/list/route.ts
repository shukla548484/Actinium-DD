import { NextRequest, NextResponse } from "next/server";
import { secureApiRoute, SecureRequestContext, sanitizeInput, validateUUID } from "@/lib/api-security";
import { prisma } from "@/lib/prisma";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";

/**
 * GET /api/purchase-orders/list
 * List all purchase orders with delivery note status
 * SECURITY: Protected by secureApiRoute - requires authentication
 */
const getHandler = async (
  request: NextRequest,
  context: SecureRequestContext
) => {
  try {
    // Get vesselId and requisitionId from query params if provided
    const searchParams = request.nextUrl.searchParams;
    const vesselIdRaw = searchParams.get("vesselId");
    const vesselId = vesselIdRaw ? validateUUID(vesselIdRaw, 'Vessel ID') || vesselIdRaw : null;
    const requisitionIdRaw = searchParams.get("requisitionId");
    const requisitionId = requisitionIdRaw ? validateUUID(requisitionIdRaw, 'Requisition ID') || requisitionIdRaw : null;
    
    // Validate vessel access if vesselId is provided
    if (vesselId && !isAdminEquivalentAccessLevel(context.user.designationAccessLevel)) {
      const hasVesselAccess = context.user.assignedVessels?.some((v: any) => v.vessel?.id === vesselId);
      if (!hasVesselAccess) {
        return NextResponse.json(
          { error: 'Access denied to vessel' },
          { status: 403 }
        );
      }
    }

    // Build where clause
    const where: any = {};
    if (vesselId) {
      where.requisition = {
        vesselId: vesselId,
      };
    }
    if (requisitionId) {
      where.requisitionId = requisitionId;
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
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
                name: true,
              },
            },
            deliveryNotes: {
              orderBy: {
                uploadedAt: "desc",
              },
              take: 1,
              select: {
                id: true,
                deliveryNoteNumber: true,
                deliveryDate: true,
                status: true,
                googleDriveFileId: true,
                googleDriveFileName: true,
                uploadedAt: true,
                receiptConfirmations: {
                  take: 1,
                  select: { id: true },
                },
              },
            },
          },
        },
      },
      orderBy: {
        dateOfIssue: "desc",
      },
    });

    // Format the response
    const formattedOrders = purchaseOrders.map((po) => ({
      id: po.id,
      poNumber: po.poNumber,
      dateOfIssue: po.dateOfIssue,
      totalAmount: po.totalAmount ? Number(po.totalAmount) : null,
      currency: po.currency,
      status: po.status,
      requisition: {
        id: po.requisition.id,
        requisitionNumber: po.requisition.requisitionNumber,
        heading: po.requisition.heading,
        description: po.requisition.description,
        requisitionType: po.requisition.requisitionType,
        portOfSupply: po.requisition.portOfSupply,
        status: po.requisition.status,
        vessel: po.requisition.vessel,
      },
      quote: {
        id: po.quote.id,
        vendor: {
          name: po.quote.vendor.name,
        },
      },
      deliveryNote: po.quote.deliveryNotes[0]
        ? {
            id: po.quote.deliveryNotes[0].id,
            deliveryNoteNumber: po.quote.deliveryNotes[0].deliveryNoteNumber,
            deliveryDate: po.quote.deliveryNotes[0].deliveryDate,
            status: po.quote.deliveryNotes[0].status,
            fileUrl: po.quote.deliveryNotes[0].googleDriveFileId || null, // This is the GCS URL
            fileName: po.quote.deliveryNotes[0].googleDriveFileName,
            uploadedAt: po.quote.deliveryNotes[0].uploadedAt,
            hasReceiptConfirmation:
              (po.quote.deliveryNotes[0].receiptConfirmations?.length ?? 0) > 0,
          }
        : null,
    }));

    return NextResponse.json({
      success: true,
      purchaseOrders: formattedOrders,
    });
  } catch (error: any) {
    console.error("Error fetching purchase orders:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch purchase orders",
        details: error.message,
      },
      { status: 500 }
    );
  }
};

// Export with security wrapper
export const GET = secureApiRoute(getHandler, {
  requireAuth: true,
  allowedMethods: ['GET'],
  minAccessLevel: 10,
});

