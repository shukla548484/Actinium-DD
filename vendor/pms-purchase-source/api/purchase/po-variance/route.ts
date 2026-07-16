import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import prisma from "@/lib/prisma";

/**
 * GET /api/purchase/po-variance
 * Crew receipt vs PO line amounts from `purchase_orders_offline` (synced from vessel).
 * Query: vesselId (optional for full-access users; "all" = any vessel they can see).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vesselIdParam = (searchParams.get("vesselId") || "").trim();

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
        return NextResponse.json({ rows: [], count: 0 });
      }
    }

    const where: {
      deletedAt: null;
      receiptHasVariance: true;
      vesselId?: string | { in: string[] };
    } = {
      deletedAt: null,
      receiptHasVariance: true,
    };

    if (vesselIdParam && vesselIdParam !== "all") {
      if (hasFullAccess) {
        where.vesselId = vesselIdParam;
      } else if (allowedVesselIds.includes(vesselIdParam)) {
        where.vesselId = vesselIdParam;
      } else {
        return NextResponse.json({ rows: [], count: 0 });
      }
    } else if (!hasFullAccess) {
      where.vesselId = { in: allowedVesselIds };
    }

    const rows = await prisma.purchaseOrdersOffline.findMany({
      where,
      orderBy: [{ crewReceiptAt: "desc" }, { updatedAt: "desc" }],
      take: 500,
    });

    const out = rows.map((r) => {
      let variance: Record<string, unknown> | null = null;
      try {
        variance = JSON.parse(r.receiptVarianceJson || "{}") as Record<string, unknown>;
      } catch {
        variance = null;
      }
      return {
        id: r.id,
        vesselId: r.vesselId,
        vesselName: r.vesselName,
        poNumber: r.poNumber,
        requisitionId: r.requisitionId,
        requisitionNumber: r.requisitionNumber,
        currency: r.currency || "USD",
        crewReceiptStatus: r.crewReceiptStatus,
        crewReceiptAt: r.crewReceiptAt?.toISOString() ?? null,
        receiptAmountVariance: r.receiptAmountVariance != null ? Number(r.receiptAmountVariance) : null,
        variance: variance,
      };
    });

    return NextResponse.json({
      rows: out,
      count: out.length,
      currentUser: { designationAccessLevel: accessLevel },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
