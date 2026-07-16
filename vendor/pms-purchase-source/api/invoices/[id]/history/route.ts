import { NextRequest, NextResponse } from "next/server";
import { assertPurchaseEntityHistoryAccess } from "@/lib/purchase/purchase-entity-history-access";
import prisma from "@/lib/prisma";
import { buildInvoiceTimeline } from "@/lib/purchase/build-entity-history";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/invoices/[id]/history — chronological audit trail (latest first). */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const access = await assertPurchaseEntityHistoryAccess(request);
    if (!access.allowed) {
      return access.response;
    }

    const { id } = await context.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const history = await buildInvoiceTimeline(id);
    return NextResponse.json({ history });
  } catch (error) {
    console.error("Error fetching invoice history:", error);
    return NextResponse.json({ error: "Failed to fetch invoice history" }, { status: 500 });
  }
}
