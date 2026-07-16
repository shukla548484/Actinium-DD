import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import prisma from "@/lib/prisma";
import { CONTRACT_TYPE_INVOICE_BASED } from "@/lib/contract-invoice-based";

/**
 * GET /api/contracts/invoice-based?vesselId=...
 * Active invoice-based contracts applicable to the vessel (for invoice upload).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const vesselId = new URL(request.url).searchParams.get("vesselId");
    if (!vesselId) {
      return NextResponse.json({ error: "vesselId is required" }, { status: 400 });
    }

    const contracts = await prisma.contract.findMany({
      where: {
        contractType: CONTRACT_TYPE_INVOICE_BASED,
        status: "ACTIVE",
        OR: [{ isGlobal: true }, { applicableVesselIds: { has: vesselId } }],
      },
      select: {
        id: true,
        contractNumber: true,
        title: true,
        currency: true,
        vendor: { select: { id: true, name: true } },
      },
      orderBy: [{ contractNumber: "asc" }],
    });

    return NextResponse.json({ contracts });
  } catch (error: unknown) {
    console.error("[contracts/invoice-based] GET", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load invoice-based contracts", details: message },
      { status: 500 }
    );
  }
}
