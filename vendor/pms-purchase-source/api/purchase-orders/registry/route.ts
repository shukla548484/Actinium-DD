import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { secureApiRoute } from "@/lib/api-security";
import { convertQuoteAmountToUsd } from "@/lib/utils/currency-shared";
import { parseTablePageSize, DEFAULT_TABLE_PAGE_SIZE } from "@/lib/table-page-size";

function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function resolvePoUsdAmount(params: {
  totalAmount: unknown;
  currency: string;
  quoteCurrency?: string | null;
  quoteToUsdRate?: unknown;
}): number {
  const amount = toNumber(params.totalAmount);
  const currency = (params.currency || params.quoteCurrency || "USD").trim().toUpperCase() || "USD";
  const rate =
    params.quoteToUsdRate != null && params.quoteToUsdRate !== ""
      ? Number(params.quoteToUsdRate)
      : null;
  return convertQuoteAmountToUsd(amount, currency, rate != null && Number.isFinite(rate) ? rate : null);
}

/**
 * GET /api/purchase-orders/registry — filtered PO registry for Purchase Orders (All) tab.
 */
export const GET = secureApiRoute(
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const vesselId = searchParams.get("vesselId");
    const poNumber = searchParams.get("poNumber");
    const requisitionNumber = searchParams.get("requisitionNumber");
    const vendorId = searchParams.get("vendorId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const workflowStatus = searchParams.get("workflowStatus");
    const legacyStatus = searchParams.get("legacyStatus");
    const poType = searchParams.get("poType");
    const q = searchParams.get("q")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = parseTablePageSize(searchParams.get("pageSize"), DEFAULT_TABLE_PAGE_SIZE);

    const where: Record<string, unknown> = {};
    const requisitionFilter: Record<string, unknown> = {};

    if (vesselId) {
      const vesselIds = vesselId.split(",").filter(Boolean);
      if (vesselIds.length === 1) {
        requisitionFilter.vesselId = vesselIds[0];
      } else if (vesselIds.length > 1) {
        requisitionFilter.vesselId = { in: vesselIds };
      }
    }
    if (requisitionNumber) {
      requisitionFilter.requisitionNumber = { contains: requisitionNumber, mode: "insensitive" };
    }
    if (Object.keys(requisitionFilter).length > 0) {
      where.requisition = requisitionFilter;
    }
    if (poNumber) {
      where.poNumber = { contains: poNumber, mode: "insensitive" };
    }
    if (vendorId) {
      const vendorIds = vendorId.split(",").filter(Boolean);
      if (vendorIds.length === 1) {
        where.quote = { vendorId: vendorIds[0] };
      } else if (vendorIds.length > 1) {
        where.quote = { vendorId: { in: vendorIds } };
      }
    }
    if (startDate || endDate) {
      where.dateOfIssue = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      };
    }
    if (workflowStatus && workflowStatus !== "all") {
      where.workflowStatus = workflowStatus;
    }
    if (legacyStatus && legacyStatus !== "all") {
      where.status = legacyStatus;
    }
    if (poType && poType !== "all") {
      where.poType = poType;
    }
    if (q) {
      where.OR = [
        { poNumber: { contains: q, mode: "insensitive" } },
        { vesselName: { contains: q, mode: "insensitive" } },
        { requisition: { requisitionNumber: { contains: q, mode: "insensitive" } } },
        { quote: { vendor: { name: { contains: q, mode: "insensitive" } } } },
      ];
    }

    const amountRows = await prisma.purchaseOrder.findMany({
      where,
      select: {
        totalAmount: true,
        currency: true,
        quote: {
          select: {
            currency: true,
            quoteToUsdRate: true,
          },
        },
      },
    });

    const totalCount = amountRows.length;
    let totalUsdAll = 0;
    for (const row of amountRows) {
      totalUsdAll += resolvePoUsdAmount({
        totalAmount: row.totalAmount,
        currency: row.currency,
        quoteCurrency: row.quote?.currency,
        quoteToUsdRate: row.quote?.quoteToUsdRate,
      });
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        requisition: {
          include: {
            vessel: { select: { id: true, name: true } },
          },
        },
        quote: {
          include: {
            vendor: true,
            deliveryNotes: {
              orderBy: { uploadedAt: "desc" },
              take: 1,
            },
          },
        },
        _count: { select: { invoices: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const vendors = await prisma.vendor.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      purchaseOrders: purchaseOrders.map((po) => {
        const quoteCurrency = po.quote?.currency || po.currency || "USD";
        const originalAmount = toNumber(po.totalAmount);
        const quoteToUsdRate =
          po.quote?.quoteToUsdRate != null ? Number(po.quote.quoteToUsdRate) : null;
        const totalAmountUsd = resolvePoUsdAmount({
          totalAmount: po.totalAmount,
          currency: po.currency,
          quoteCurrency,
          quoteToUsdRate,
        });
        return {
          id: po.id,
          poNumber: po.poNumber,
          originalPdfUrl: po.originalPdfUrl,
          vesselName: po.requisition?.vessel?.name ?? "",
          dateOfIssue: po.dateOfIssue?.toISOString() ?? null,
          totalAmount: po.totalAmount,
          currency: po.currency,
          quoteCurrency,
          quoteToUsdRate,
          totalAmountUsd,
          originalAmount,
          status: po.status,
          workflowStatus: po.workflowStatus,
          levelOneApprovedAt: po.levelOneApprovedAt?.toISOString() ?? null,
          levelTwoApprovedAt: po.levelTwoApprovedAt?.toISOString() ?? null,
          levelThreeApprovedAt: po.levelThreeApprovedAt?.toISOString() ?? null,
          hasInvoice: (po._count?.invoices ?? 0) > 0,
          completionStatus: po.completionStatus,
          createdAt: po.createdAt.toISOString(),
          requisition: {
            id: po.requisition.id,
            requisitionNumber: po.requisition.requisitionNumber,
            vesselName: po.requisition?.vessel?.name ?? null,
            vessel: po.requisition?.vessel ?? null,
          },
          quote: po.quote
            ? {
                id: po.quote.id,
                vendorId: po.quote.vendorId,
                vendor: po.quote.vendor,
                currency: po.quote.currency,
                quoteToUsdRate,
                deliveryNotes: po.quote.deliveryNotes.map((dn) => ({ id: dn.id })),
              }
            : null,
        };
      }),
      vendors,
      pagination: {
        page,
        pageSize,
        total: totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      },
      totals: {
        totalUsd: Math.round(totalUsdAll * 100) / 100,
        count: totalCount,
      },
    });
  },
  { requireAuth: true, allowedMethods: ["GET"] }
);
