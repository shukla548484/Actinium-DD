import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { secureApiRoute } from "@/lib/api-security";
import { convertQuoteAmountToUsd } from "@/lib/utils/currency-shared";
import { poListDisplayStatus } from "@/lib/types/purchase-order-workflow";
import { filteredTableExcelResponse } from "@/lib/excel-filtered-table-export";

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
  const currency =
    (params.currency || params.quoteCurrency || "USD").trim().toUpperCase() || "USD";
  const rate =
    params.quoteToUsdRate != null && params.quoteToUsdRate !== ""
      ? Number(params.quoteToUsdRate)
      : null;
  return convertQuoteAmountToUsd(
    amount,
    currency,
    rate != null && Number.isFinite(rate) ? rate : null
  );
}

function buildRegistryWhere(searchParams: URLSearchParams): Record<string, unknown> {
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

  const where: Record<string, unknown> = {};
  const requisitionFilter: Record<string, unknown> = {};

  if (vesselId) {
    const vesselIds = vesselId.split(",").filter(Boolean);
    if (vesselIds.length === 1) requisitionFilter.vesselId = vesselIds[0];
    else if (vesselIds.length > 1) requisitionFilter.vesselId = { in: vesselIds };
  }
  if (requisitionNumber) {
    requisitionFilter.requisitionNumber = {
      contains: requisitionNumber,
      mode: "insensitive",
    };
  }
  if (Object.keys(requisitionFilter).length > 0) {
    where.requisition = requisitionFilter;
  }
  if (poNumber) {
    where.poNumber = { contains: poNumber, mode: "insensitive" };
  }
  if (vendorId) {
    const vendorIds = vendorId.split(",").filter(Boolean);
    if (vendorIds.length === 1) where.quote = { vendorId: vendorIds[0] };
    else if (vendorIds.length > 1) where.quote = { vendorId: { in: vendorIds } };
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
  return where;
}

/**
 * GET /api/purchase-orders/registry/export — Excel of all filtered registry POs.
 */
export const GET = secureApiRoute(
  async (request: NextRequest, context) => {
    const { searchParams } = new URL(request.url);
    const where = buildRegistryWhere(searchParams);

    const rows = await prisma.purchaseOrder.findMany({
      where,
      take: 10_000,
      orderBy: { dateOfIssue: "desc" },
      include: {
        requisition: {
          select: {
            requisitionNumber: true,
            vessel: { select: { name: true, code: true } },
          },
        },
        quote: {
          select: {
            currency: true,
            quoteToUsdRate: true,
            vendor: { select: { name: true } },
          },
        },
        _count: { select: { invoices: true } },
      },
    });

    if (rows.length === 0) {
      return NextResponse.json({ error: "No data to export" }, { status: 400 });
    }

    let totalUsd = 0;
    const exportRows = rows.map((po) => {
      const quoteToUsdRate =
        po.quote?.quoteToUsdRate != null ? Number(po.quote.quoteToUsdRate) : null;
      const usd = resolvePoUsdAmount({
        totalAmount: po.totalAmount,
        currency: po.currency,
        quoteCurrency: po.quote?.currency,
        quoteToUsdRate,
      });
      totalUsd += usd;
      const display = poListDisplayStatus({
        workflowStatus: po.workflowStatus,
        status: po.status,
        levelOneApprovedAt: po.levelOneApprovedAt,
        levelTwoApprovedAt: po.levelTwoApprovedAt,
        levelThreeApprovedAt: po.levelThreeApprovedAt,
        hasInvoice: po._count.invoices > 0,
      });
      return {
        poNumber: po.poNumber,
        requisitionNumber: po.requisition?.requisitionNumber ?? "",
        vessel: po.requisition?.vessel?.name ?? po.vesselName ?? "",
        vendor: po.quote?.vendor?.name ?? "",
        dateOfIssue: po.dateOfIssue ? po.dateOfIssue.toLocaleDateString("en-GB") : "",
        amount: po.totalAmount != null ? Number(po.totalAmount) : "",
        currency: po.currency,
        amountUsd: Number(usd.toFixed(2)),
        approvalStatus: display,
        completion: po.completionStatus,
        createdAt: po.createdAt.toLocaleDateString("en-GB"),
      };
    });

    const generatedBy = [context.user.firstName, context.user.lastName]
      .filter(Boolean)
      .join(" ");

    return filteredTableExcelResponse(
      {
        title: "PURCHASE ORDERS REGISTRY",
        subtitle: `Filtered export · ${exportRows.length} PO(s) · Total USD ${totalUsd.toFixed(2)}`,
        columns: [
          { key: "poNumber", header: "PO Number", width: 20 },
          { key: "requisitionNumber", header: "Req. Number", width: 22 },
          { key: "vessel", header: "Vessel", width: 22 },
          { key: "vendor", header: "Vendor", width: 22 },
          { key: "dateOfIssue", header: "Date of Issue", width: 14 },
          { key: "amount", header: "Amount", width: 14, align: "right" },
          { key: "currency", header: "Currency", width: 10 },
          { key: "amountUsd", header: "Amount USD", width: 14, align: "right" },
          { key: "approvalStatus", header: "Approval Status", width: 28 },
          { key: "completion", header: "Completion", width: 12 },
          { key: "createdAt", header: "Created At", width: 12 },
        ],
        rows: exportRows,
        totals: [
          { label: "Filtered PO count", value: exportRows.length },
          { label: "Total (USD)", value: Number(totalUsd.toFixed(2)) },
        ],
        generatedBy: generatedBy || undefined,
      },
      `po_registry_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  },
  { requireAuth: true, allowedMethods: ["GET"] }
);
