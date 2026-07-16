import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { 
  GenerationStatus, 
  RequisitionStatus,
  canMasterApproveVesselRequisitionDraft,
} from "@/lib/types/requisition";
import { recordPurchaseHistory, PurchaseHistoryActionType } from "@/lib/services/purchase-history.service";

// GET /api/requisitions/master-approval — vessel requisitions submitted by crew (CREATED + NOT_READY), awaiting Master → NEW_REQ
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");

    if (!employeeId) {
      return NextResponse.json(
        { error: "Employee ID required" },
        { status: 400 }
      );
    }

    // Check if user is a Master
    // IMPORTANT: Always use designationAccessLevel from database, NOT hardcoded mapping
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { designationAccessLevel: true }
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    const accessLevel = employee.designationAccessLevel;
    if (!canMasterApproveVesselRequisitionDraft(accessLevel)) {
      return NextResponse.json(
        { error: "Access denied. Master (25) or administrator privileges required." },
        { status: 403 }
      );
    }

    const requisitions = await prisma.requisition.findMany({
      where: {
        status: RequisitionStatus.NOT_READY,
        generationStatus: GenerationStatus.CREATED,
        requisitionNumber: {
          startsWith: 'V.',
        },
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            designation: true,
          },
        },
        vessel: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        items: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      requisitions,
      total: requisitions.length,
    });
  } catch (error) {
    console.error("Error fetching requisitions for Master approval:", error);
    return NextResponse.json(
      { error: "Failed to fetch requisitions" },
      { status: 500 }
    );
  }
}

// PUT /api/requisitions/master-approval - Approve requisitions for generation
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { requisitionIds, employeeId } = body;

    if (!requisitionIds || !Array.isArray(requisitionIds) || !employeeId) {
      return NextResponse.json(
        { error: "Requisition IDs and Employee ID required" },
        { status: 400 }
      );
    }

    // Check if user is a Master
    // IMPORTANT: Always use designationAccessLevel from database, NOT hardcoded mapping
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { designationAccessLevel: true }
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    const accessLevel = employee.designationAccessLevel;
    if (!canMasterApproveVesselRequisitionDraft(accessLevel)) {
      return NextResponse.json(
        { error: "Access denied. Master (25) or administrator privileges required." },
        { status: 403 }
      );
    }

    const requisitions = await prisma.requisition.findMany({
      where: {
        id: { in: requisitionIds },
        status: RequisitionStatus.NOT_READY,
        generationStatus: GenerationStatus.CREATED,
        requisitionNumber: {
          startsWith: 'V.',
        },
      },
    });

    if (requisitions.length !== requisitionIds.length) {
      return NextResponse.json(
        { error: "Some requisitions are invalid or do not need Master approval" },
        { status: 400 }
      );
    }

    // Get requisitions before update to record history
    const requisitionsBeforeUpdate = await prisma.requisition.findMany({
      where: {
        id: { in: requisitionIds }
      },
      select: {
        id: true,
        requisitionNumber: true,
        status: true,
      }
    });

    // Release to shore: NEW_REQ; generation stays CREATED. isEditable false on vessel workflow.
    const updatedRequisitions = await prisma.requisition.updateMany({
      where: {
        id: { in: requisitionIds }
      },
      data: {
        generationStatus: GenerationStatus.CREATED,
        status: RequisitionStatus.NEW_REQ,
        isEditable: false, // Automatically false because status != NOT_READY
        approvedById: employeeId,
        approvedAt: new Date(),
      }
    });

    // Record purchase history for each requisition
    await Promise.all(
      requisitionsBeforeUpdate.map(req =>
        recordPurchaseHistory({
          requisitionId: req.id,
          actionType: PurchaseHistoryActionType.APPROVED,
          performedById: employeeId,
          actionDescription: `Master approval - requisition ${req.requisitionNumber} approved and set to NEW_REQ status`,
          previousStatus: req.status,
          newStatus: RequisitionStatus.NEW_REQ,
        })
      )
    );

    return NextResponse.json({
      message: `Successfully approved ${updatedRequisitions.count} requisitions`,
      approvedCount: updatedRequisitions.count,
    });
  } catch (error) {
    console.error("Error approving requisitions:", error);
    return NextResponse.json(
      { error: "Failed to approve requisitions" },
      { status: 500 }
    );
  }
}