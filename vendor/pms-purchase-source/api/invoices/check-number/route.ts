import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";

/**
 * GET /api/invoices/check-number?invoiceNumber=INV-001&excludeId=optional
 * Check whether an invoice number is available (unique).
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const invoiceNumber = searchParams.get("invoiceNumber")?.trim() ?? "";
    const excludeId = searchParams.get("excludeId")?.trim() || null;

    if (!invoiceNumber) {
      return NextResponse.json(
        { error: "invoiceNumber is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.invoice.findUnique({
      where: { invoiceNumber },
      select: { id: true },
    });

    const available = !existing || (excludeId != null && existing.id === excludeId);

    return NextResponse.json({
      success: true,
      available,
      invoiceNumber,
    });
  } catch (error: unknown) {
    console.error("Error checking invoice number:", error);
    return NextResponse.json(
      {
        error: "Failed to check invoice number",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
