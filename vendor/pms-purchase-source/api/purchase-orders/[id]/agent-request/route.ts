import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import prisma from "@/lib/prisma";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/purchase-orders/[id]/agent-request - Get agent requests for a PO
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userAccessLevel = currentUser.designationAccessLevel || 0;
    if (![32, 33, 50, 99, 100].includes(userAccessLevel) && !isAdminEquivalentAccessLevel(userAccessLevel)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    const agentRequests = await prisma.agentDetailsRequest.findMany({
      where: {
        purchaseOrderId: id,
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            primaryEmail: true,
            contactPerson: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        respondedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      agentRequests,
    });
  } catch (error) {
    console.error("Error fetching agent requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent requests" },
      { status: 500 }
    );
  }
}


