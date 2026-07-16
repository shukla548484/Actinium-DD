import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import prisma from "@/lib/prisma";
import {
  buildViewPosWhere,
  parseViewPosListParams,
  resolvePoUsdAmount,
  VIEW_POS_PO_SELECT,
} from "@/lib/purchase-orders-view-pos-query";

/**
 * GET /api/purchase-orders/view-pos
 * List purchase orders for the View Purchase Orders page.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = parseViewPosListParams(request);
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const accessLevel = user.designationAccessLevel ?? 0;
    const hasFullAccess = [50, 99, 100].includes(accessLevel);

    let allowedVesselIds: string[] = [];
    if (!hasFullAccess) {
      const assigned = await prisma.employeeVessel.findMany({
        where: { employeeId: user.id },
        select: { vesselId: true },
      });
      allowedVesselIds = assigned.map((a) => a.vesselId).filter(Boolean);
      if (allowedVesselIds.length === 0) {
        return NextResponse.json({
          purchaseOrders: [],
          count: 0,
          page,
          limit,
          totalPages: 0,
          totals: { totalUsd: 0 },
        });
      }
    }

    const { where, empty } = buildViewPosWhere({
      ...params,
      hasFullAccess,
      allowedVesselIds,
    });

    if (empty) {
      return NextResponse.json({
        purchaseOrders: [],
        count: 0,
        page,
        limit,
        totalPages: 0,
        totals: { totalUsd: 0 },
      });
    }

    const [totalCount, rows, amountRows] = await Promise.all([
      prisma.purchaseOrder.count({ where }),
      prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateOfIssue: "desc" },
        select: VIEW_POS_PO_SELECT,
      }),
      prisma.purchaseOrder.findMany({
        where,
        select: {
          totalAmount: true,
          currency: true,
          quote: { select: { currency: true, quoteToUsdRate: true } },
        },
      }),
    ]);

    const totalUsd = amountRows.reduce(
      (sum, po) =>
        sum +
        resolvePoUsdAmount({
          totalAmount: po.totalAmount,
          currency: po.currency,
          quoteCurrency: po.quote?.currency,
          quoteToUsdRate: po.quote?.quoteToUsdRate,
        }),
      0
    );

    const purchaseOrders = rows.map((po) => ({
      id: po.id,
      poNumber: po.poNumber,
      poType: po.poType ?? "GOODS",
      parentPoNumber: po.parentPurchaseOrder?.poNumber ?? null,
      dateOfIssue: po.dateOfIssue?.toISOString() ?? null,
      totalAmount: po.totalAmount != null ? Number(po.totalAmount) : null,
      currency: po.currency,
      status: po.status,
      workflowStatus: po.workflowStatus,
      completionStatus: po.completionStatus,
      createdAt: po.createdAt?.toISOString() ?? null,
      totalAmountUsd: resolvePoUsdAmount({
        totalAmount: po.totalAmount,
        currency: po.currency,
        quoteCurrency: po.quote?.currency,
        quoteToUsdRate: po.quote?.quoteToUsdRate,
      }),
      requisition: po.requisition
        ? {
            id: po.requisition.id,
            requisitionNumber: po.requisition.requisitionNumber,
            heading: po.requisition.heading,
            vessel: po.requisition.vessel,
          }
        : null,
      quote: po.quote
        ? {
            quoteNumber: po.quote.quoteNumber,
            vendor: po.quote.vendor,
          }
        : null,
    }));

    return NextResponse.json({
      purchaseOrders,
      count: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      totals: { totalUsd: Number(totalUsd.toFixed(2)) },
      currentUser: { designationAccessLevel: user.designationAccessLevel ?? 0 },
    });
  } catch (err: unknown) {
    console.error("[view-pos] Error listing purchase orders:", err);
    return NextResponse.json(
      {
        error: "Failed to load purchase orders",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
