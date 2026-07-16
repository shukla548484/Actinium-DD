import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import prisma from "@/lib/prisma";
import { getDefaultFreightAccount } from "@/lib/freight/freight-account-config";

/**
 * GET /api/purchase-orders/lookup
 * Look up purchase order by requisition number or PO number
 * Query params:
 * - requisitionNumber: Look up by requisition number
 * - poNumber: Look up by PO number
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requisitionNumber = searchParams.get("requisitionNumber");
    const poNumber = searchParams.get("poNumber");

    if (!requisitionNumber && !poNumber) {
      return NextResponse.json(
        { error: "Either requisitionNumber or poNumber is required" },
        { status: 400 }
      );
    }

    // Build where clause
    const where: any = {};
    
    if (poNumber) {
      where.poNumber = poNumber;
    } else if (requisitionNumber) {
      where.requisition = {
        requisitionNumber: requisitionNumber,
      };
    }

    // Get purchase order with vessel information
    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where,
      include: {
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

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      );
    }

    const isFreightPo = purchaseOrder.poType === "FREIGHT";
    const freightAccount =
      isFreightPo && purchaseOrder.requisition.vessel
        ? await getDefaultFreightAccount(
            purchaseOrder.requisition.vessel.companyId,
            purchaseOrder.requisition.vessel.id
          )
        : null;

    return NextResponse.json({
      success: true,
      purchaseOrder: {
        id: purchaseOrder.id,
        poNumber: purchaseOrder.poNumber,
        poType: purchaseOrder.poType ?? "GOODS",
        requisitionNumber: purchaseOrder.requisition.requisitionNumber,
        vessel: purchaseOrder.requisition.vessel,
        vendor: purchaseOrder.quote.vendor,
        suggestedFreightAccount: freightAccount,
      },
    });
  } catch (error: any) {
    console.error("Error looking up purchase order:", error);
    return NextResponse.json(
      {
        error: "Failed to look up purchase order",
        details: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
