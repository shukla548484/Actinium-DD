import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import prisma from "@/lib/prisma";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";

interface RouteContext {
  params: Promise<{ id: string; requestId: string }>;
}

// POST /api/purchase-orders/[id]/agent-request/[requestId]/respond - Respond to agent request
export async function POST(
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
        { error: "Insufficient permissions. Only users with access level 32, 33, or 50 can respond to agent requests." },
        { status: 403 }
      );
    }

    const { id, requestId } = await context.params;
    const body = await request.json();
    const { agentDetails, responseMessage } = body;

    if (!agentDetails || agentDetails.trim() === "") {
      return NextResponse.json(
        { error: "Agent details are required" },
        { status: 400 }
      );
    }

    // Verify request exists and belongs to this PO
    const agentRequest = await prisma.agentDetailsRequest.findFirst({
      where: {
        id: requestId,
        purchaseOrderId: id,
        status: "PENDING",
      },
    });

    if (!agentRequest) {
      return NextResponse.json(
        { error: "Agent request not found or already responded" },
        { status: 404 }
      );
    }

    // Update agent request
    const updatedRequest = await prisma.agentDetailsRequest.update({
      where: {
        id: requestId,
      },
      data: {
        status: "RESPONDED",
        agentDetails: agentDetails.trim(),
        responseMessage: responseMessage || null,
        respondedById: currentUser.id,
        respondedAt: new Date(),
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            primaryEmail: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      agentRequest: updatedRequest,
      message: "Agent details provided successfully. The vendor will be notified.",
    });
  } catch (error) {
    console.error("Error responding to agent request:", error);
    return NextResponse.json(
      { error: "Failed to respond to agent request" },
      { status: 500 }
    );
  }
}















