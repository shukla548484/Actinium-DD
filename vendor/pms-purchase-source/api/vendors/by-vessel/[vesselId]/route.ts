import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import prisma from "@/lib/prisma";

/**
 * GET /api/vendors/by-vessel/[vesselId]
 * Get vendors registered under the company that the vessel belongs to
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vesselId: string }> }
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { vesselId } = await params;

    if (!vesselId) {
      return NextResponse.json({ error: "Vessel ID is required" }, { status: 400 });
    }

    // Get vessel with company details
    const vessel = await prisma.vessel.findUnique({
      where: { id: vesselId },
      include: {
        company: {
          include: {
            parent: true,
          },
        },
      },
    });

    if (!vessel) {
      return NextResponse.json({ error: "Vessel not found" }, { status: 404 });
    }

    // Determine master company ID
    let masterCompanyId: string | null = null;
    if (vessel.company.type === 'MASTER_COMPANY') {
      masterCompanyId = vessel.company.id;
    } else if (vessel.company.parent) {
      masterCompanyId = vessel.company.parent.id;
    } else {
      // Fallback: use vessel's company if no parent found
      masterCompanyId = vessel.company.id;
    }

    // Get vendors for the master company
    const vendors = await prisma.vendor.findMany({
      where: {
        isActive: true,
        masterCompanyId: masterCompanyId ?? undefined,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      success: true,
      vendors,
    });
  } catch (error: any) {
    console.error("Error fetching vendors by vessel:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch vendors",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
