import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import prisma from "@/lib/prisma";

/**
 * GET /api/purchase-orders/filter-options
 * Get vessels and vendors for filter dropdowns
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessLevel = currentUser.designationAccessLevel || 0;
    const hasFullAccess = [50, 99, 100].includes(accessLevel);

    // Get vessels - filtered by user access
    let vessels: any[] = [];
    if (hasFullAccess) {
      // Get all active vessels
      vessels = await prisma.vessel.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          code: true,
        },
        orderBy: { name: "asc" },
      });
    } else {
      // Get only assigned vessels
      const assignedVessels = await prisma.employeeVessel.findMany({
        where: {
          employeeId: currentUser.id,
          vessel: {
            isActive: true,
          },
        },
        include: {
          vessel: {
            select: {
              id: true,
              name: true,
              code: true,
              isActive: true,
            },
          },
        },
      });
      vessels = assignedVessels
        .map((av) => av.vessel)
        .filter((v) => v !== null && v.isActive)
        .map((v) => ({
          id: v!.id,
          name: v!.name,
          code: v!.code,
        }));
    }

    // Get all vendors that have quotes
    const vendors = await prisma.vendor.findMany({
      where: {
        isActive: true,
        quotes: {
          some: {},
        },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
      distinct: ["id"],
    });

    return NextResponse.json({
      success: true,
      vessels,
      vendors,
    });
  } catch (error: any) {
    console.error("Error fetching filter options:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch filter options",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
