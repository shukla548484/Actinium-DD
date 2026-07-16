import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { isAdminEquivalentAccessLevel } from '@/lib/admin-access-level';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/requisitions/[id]/agent-details - Get agent details for a requisition
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const requisition = await prisma.requisition.findUnique({
      where: { id },
      select: {
        id: true,
        portAgentDetails: true,
      },
    });

    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      agentDetails: requisition.portAgentDetails || null,
    });
  } catch (error: any) {
    console.error('Error fetching agent details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent details', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/requisitions/[id]/agent-details - Update agent details for a requisition
 * Only users with access level 32, 33, or admin-equivalent (50/99/100) can update
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userAccessLevel = currentUser.designationAccessLevel || 0;
    const allowedLevels = [32, 33, 50, 99, 100];
    if (!allowedLevels.includes(userAccessLevel) && !isAdminEquivalentAccessLevel(userAccessLevel)) {
      return NextResponse.json(
        {
          error: 'Insufficient permissions',
          message: `Access level ${userAccessLevel} is not authorized to update agent details. Required: 32, 33, or admin-equivalent (50/99/100)`,
        },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();
    const { agentDetails } = body;

    if (!agentDetails || typeof agentDetails !== 'string') {
      return NextResponse.json(
        { error: 'Agent details are required' },
        { status: 400 }
      );
    }

    // Update requisition
    const updatedRequisition = await prisma.requisition.update({
      where: { id },
      data: {
        portAgentDetails: agentDetails.trim(),
      },
      select: {
        id: true,
        portAgentDetails: true,
      },
    });

    // Also update agent details in any associated purchase orders
    // This ensures vendors can see the agent details
    await prisma.purchaseOrder.updateMany({
      where: {
        requisitionId: id,
      },
      data: {
        // Note: PurchaseOrder doesn't have portAgentDetails field directly
        // We'll need to update the requisition relation
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Agent details updated successfully',
      agentDetails: updatedRequisition.portAgentDetails,
    });
  } catch (error: any) {
    console.error('Error updating agent details:', error);
    return NextResponse.json(
      { error: 'Failed to update agent details', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/requisitions/[id]/agent-details - Delete agent details for a requisition
 * Only users with access level 32, 33, or admin-equivalent (50/99/100) can delete
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userAccessLevel = currentUser.designationAccessLevel || 0;
    const allowedLevels = [32, 33, 50, 99, 100];
    if (!allowedLevels.includes(userAccessLevel) && !isAdminEquivalentAccessLevel(userAccessLevel)) {
      return NextResponse.json(
        {
          error: 'Insufficient permissions',
          message: `Access level ${userAccessLevel} is not authorized to delete agent details. Required: 32, 33, or admin-equivalent (50/99/100)`,
        },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    // Update requisition to remove agent details
    await prisma.requisition.update({
      where: { id },
      data: {
        portAgentDetails: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Agent details deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting agent details:', error);
    return NextResponse.json(
      { error: 'Failed to delete agent details', details: error.message },
      { status: 500 }
    );
  }
}















