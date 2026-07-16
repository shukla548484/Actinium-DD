import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import prisma from "@/lib/prisma";
import {
  buildViewPosWhere,
  parseViewPosListParams,
  resolvePoUsdAmount,
  VIEW_POS_PO_SELECT,
} from "@/lib/purchase-orders-view-pos-query";
import { poWorkflowStatusLabel } from "@/lib/types/purchase-order-workflow";
import { filteredTableExcelResponse } from "@/lib/excel-filtered-table-export";

/**
 * GET /api/purchase-orders/view-pos/export
 * Excel export of all POs matching current View POs filters (not just current page).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = parseViewPosListParams(request);
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
        return NextResponse.json({ error: "No vessels assigned" }, { status: 403 });
      }
    }

    const { where, empty } = buildViewPosWhere({
      ...params,
      hasFullAccess,
      allowedVesselIds,
    });
    if (empty) {
      return NextResponse.json({ error: "No data to export" }, { status: 400 });
    }

    const rows = await prisma.purchaseOrder.findMany({
      where,
      orderBy: { dateOfIssue: "desc" },
      take: 10_000,
      select: VIEW_POS_PO_SELECT,
    });

    if (rows.length === 0) {
      return NextResponse.json({ error: "No data to export" }, { status: 400 });
    }

    let totalUsd = 0;
    const exportRows = rows.map((po) => {
      const usd = resolvePoUsdAmount({
        totalAmount: po.totalAmount,
        currency: po.currency,
        quoteCurrency: po.quote?.currency,
        quoteToUsdRate: po.quote?.quoteToUsdRate,
      });
      totalUsd += usd;
      return {
        poNumber: po.poNumber,
        dateOfIssue: po.dateOfIssue ? po.dateOfIssue.toLocaleDateString("en-GB") : "",
        requisitionNumber: po.requisition?.requisitionNumber ?? "",
        heading: po.requisition?.heading ?? "",
        vessel: po.requisition?.vessel?.name ?? "",
        vesselCode: po.requisition?.vessel?.code ?? "",
        quoteNumber: po.quote?.quoteNumber ?? "",
        vendor: po.quote?.vendor?.name ?? "",
        totalAmount:
          po.totalAmount != null ? Number(po.totalAmount) : "",
        currency: po.currency,
        totalUsd: Number(usd.toFixed(2)),
        workflow: poWorkflowStatusLabel(po.workflowStatus),
        completion: po.completionStatus,
        createdAt: po.createdAt ? po.createdAt.toLocaleDateString("en-GB") : "",
      };
    });

    const generatedBy = [user.firstName, user.lastName].filter(Boolean).join(" ");

    return filteredTableExcelResponse(
      {
        title: "PURCHASE ORDERS",
        subtitle: `Filtered export · ${exportRows.length} PO(s) · Total USD ${totalUsd.toFixed(2)}`,
        columns: [
          { key: "poNumber", header: "PO Number", width: 20 },
          { key: "dateOfIssue", header: "Date of Issue", width: 14 },
          { key: "requisitionNumber", header: "Requisition Number", width: 22 },
          { key: "heading", header: "Requisition Heading", width: 28 },
          { key: "vessel", header: "Vessel", width: 22 },
          { key: "vesselCode", header: "Vessel Code", width: 12 },
          { key: "quoteNumber", header: "Quote Number", width: 16 },
          { key: "vendor", header: "Vendor", width: 22 },
          { key: "totalAmount", header: "Total Amount", width: 14, align: "right" },
          { key: "currency", header: "Currency", width: 10 },
          { key: "totalUsd", header: "Total USD", width: 14, align: "right" },
          { key: "workflow", header: "Workflow", width: 16 },
          { key: "completion", header: "Completion", width: 12 },
          { key: "createdAt", header: "Created", width: 12 },
        ],
        rows: exportRows,
        totals: [
          { label: "Filtered PO count", value: exportRows.length },
          { label: "Total (USD)", value: Number(totalUsd.toFixed(2)) },
        ],
        generatedBy: generatedBy || undefined,
      },
      `purchase_orders_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  } catch (err: unknown) {
    console.error("[view-pos/export]", err);
    return NextResponse.json(
      {
        error: "Failed to export purchase orders",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
