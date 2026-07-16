import { NextRequest, NextResponse } from "next/server";
import { isCrewOriginatedRequisitionNumber } from "@/lib/sync/record-origin-suffix";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest, getSessionPrincipalFromRequest } from "@/lib/session";
import {
  canPrincipalViewRequisition,
  resolveRequisitionViewerContext,
} from "@/lib/requisition-single-view-access";
import { 
  GenerationStatus, 
  RequisitionStatus,
  canCreateRequisition,
  canOfficeCreateRequisition,
  initialStatusForNewRequisition,
  canEditRequisition,
  isMaster,
} from "@/lib/types/requisition";
import { recordPurchaseHistory, PurchaseHistoryActionType } from "@/lib/services/purchase-history.service";
import { logActivityFromRequestWithNotification } from "@/lib/utils/enhanced-activity-logger";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import { createSparePartRecord } from "@/lib/spares-inventory/spare-part-create";
import { repairRequisitionStatusById } from "@/lib/procurement/requisition-status-reconcile";
import {
  getRequisitionSubCategoryNameMap,
  resolveRequisitionDepartmentName,
} from "@/lib/requisition-subcategory-lookup";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/requisitions/[id] - Get single requisition
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    // Try to get viewerId from query param first (for backward compatibility), then from session
    let viewerId = searchParams.get("viewerId");
    
    // If not in query param, get from session
    if (!viewerId) {
      const currentUser = await getCurrentUserFromRequest(request);
      if (currentUser) {
        viewerId = currentUser.id;
      }
    }

    if (!viewerId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const requisition = await prisma.requisition.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            designation: true,
            designationAccessLevel: true,
          },
        },
        vessel: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            designation: true,
          },
        },
        items: {
          include: {
            attachments: {
              select: { id: true, fileName: true, mimeType: true, fileSize: true },
            },
          },
        },
        parentRequisition: {
          select: { id: true, requisitionNumber: true },
        },
        childRequisitions: {
          include: {
            splitAllocationsAsChild: {
              take: 1,
              include: { vendor: { select: { id: true, name: true } } },
            },
            purchaseOrders: {
              take: 1,
              orderBy: { createdAt: "desc" as const },
              select: { id: true, poNumber: true },
            },
          },
        },
        splitAllocationsAsParent: {
          include: {
            allocationItems: {
              select: { requisitionItemId: true },
            },
            vendorQuote: {
              select: { id: true, vendorId: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!requisition) {
      return NextResponse.json(
        { error: "Requisition not found" },
        { status: 404 }
      );
    }

    const principal = await getSessionPrincipalFromRequest(request);
    if (!principal) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const viewerContext = await resolveRequisitionViewerContext(principal);
    const allowed = await canPrincipalViewRequisition(principal, requisition, viewerContext);

    if (!allowed) {
      return NextResponse.json(
        { error: "Access denied. Insufficient privileges to view this requisition." },
        { status: 403 }
      );
    }

    const repairedStatus = await repairRequisitionStatusById(prisma, id);
    if (repairedStatus && repairedStatus !== requisition.status) {
      requisition.status = repairedStatus;
    }

    const subCategoryNameMap = await getRequisitionSubCategoryNameMap(
      requisition.subCategoryCode ? [requisition.subCategoryCode] : []
    );
    const subCategoryName = resolveRequisitionDepartmentName(
      requisition.requisitionType,
      requisition.subCategoryCode,
      subCategoryNameMap
    );

    return NextResponse.json({ ...requisition, subCategoryName });
  } catch (error) {
    console.error("Error fetching requisition:", error);
    return NextResponse.json(
      { error: "Failed to fetch requisition" },
      { status: 500 }
    );
  }
}

// PUT /api/requisitions/[id] - Update requisition
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const {
      heading,
      manualReqNumber,
      description,
      portOfSupply,
      requisitionType,
      requisitionPurpose,
      portAgentDetails,
      vesselId,
      items,
      generationStatus,
      updatedById // This would come from session in real app
    } = body;
    
    // Log incoming request for debugging
    console.log(`[Requisition Update] Received PUT request for ID: ${id}`, {
      generationStatus,
      hasItems: !!items,
      itemsCount: items?.length || 0,
    });

    // Check if requisition exists
    const existingRequisition = await prisma.requisition.findUnique({
      where: { id },
      include: { createdBy: true },
    });

    if (!existingRequisition) {
      return NextResponse.json(
        { error: "Requisition not found" },
        { status: 404 }
      );
    }

    // Once status is NEW_REQ, requisition items and details cannot be modified
    if (existingRequisition.status === RequisitionStatus.NEW_REQ) {
      return NextResponse.json(
        { error: "Requisition items and details cannot be modified once status is 'New Requisition'" },
        { status: 403 }
      );
    }

    // Get updater's access level from database - always use designationAccessLevel field
    const updaterForAccess = await prisma.employee.findUnique({ 
      where: { id: updatedById }, 
      select: { designationAccessLevel: true } 
    });
    const accessLevel = updaterForAccess?.designationAccessLevel;
    
    if (!canEditRequisition(existingRequisition, accessLevel)) {
      return NextResponse.json(
        { error: "Access denied. You cannot edit this requisition due to its current status or your access level." },
        { status: 403 }
      );
    }

    // For draft requisitions, only allow editing if generation status is SAVED_AS_DRAFT
    if (existingRequisition.generationStatus !== GenerationStatus.SAVED_AS_DRAFT) {
      return NextResponse.json(
        { error: "Only draft requisitions can be edited" },
        { status: 400 }
      );
    }

    // Get updater's access level from database
    // IMPORTANT: Always use designationAccessLevel from database, NOT hardcoded mapping
    const updater = await prisma.employee.findUnique({
      where: { id: updatedById },
      select: { designationAccessLevel: true }
    });

    if (!updater) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    const updaterAccessLevel = updater.designationAccessLevel;
    if (!canCreateRequisition(updaterAccessLevel) && !canOfficeCreateRequisition(updaterAccessLevel)) {
      return NextResponse.json(
        { error: "Insufficient access level to update requisitions" },
        { status: 403 }
      );
    }

    // Check if user is updating their own requisition or has higher access
    if (existingRequisition.createdById !== updatedById && !isMaster(accessLevel)) {
      return NextResponse.json(
        { error: "You can only edit your own requisitions" },
        { status: 403 }
      );
    }

    const currentRequisition = await prisma.requisition.findUnique({
      where: { id },
      select: { status: true },
    });

    const reqNo = (existingRequisition.requisitionNumber ?? "").trim();
    const isCrewReq = isCrewOriginatedRequisitionNumber(reqNo);
    const isCreatingRequisition =
      generationStatus === GenerationStatus.CREATED || generationStatus === "CREATED";

    let finalStatus: RequisitionStatus;
    if (isCreatingRequisition) {
      if (isCrewReq) {
        finalStatus = RequisitionStatus.NOT_READY;
      } else {
        finalStatus = initialStatusForNewRequisition(
          GenerationStatus.CREATED,
          "O",
          updaterAccessLevel
        );
      }
    } else {
      finalStatus = currentRequisition?.status || RequisitionStatus.NOT_READY;
    }

    const finalGenerationStatus = isCreatingRequisition
      ? GenerationStatus.CREATED
      : generationStatus || GenerationStatus.SAVED_AS_DRAFT;

    const isEditable =
      finalStatus === RequisitionStatus.NOT_READY &&
      finalGenerationStatus === GenerationStatus.SAVED_AS_DRAFT;
    
    // Log for debugging
    console.log(`[Requisition Update] ID: ${id}`, {
      incomingGenerationStatus: generationStatus,
      finalGenerationStatus,
      finalStatus,
      isEditable,
      isCreatingRequisition,
    });
    
    const updatedRequisition = await prisma.requisition.update({
      where: { id },
      data: {
        heading,
        manualReqNumber,
        description,
        portOfSupply,
        requisitionType,
        ...(requisitionPurpose !== undefined && { requisitionPurpose }),
        portAgentDetails,
        vesselId,
        generationStatus: finalGenerationStatus, // Ensure correct generationStatus is set
        status: finalStatus, // Set status based on generationStatus
        isEditable, // Automatically set based on status
        items: {
          deleteMany: {}, // Delete existing items
          create: items.map((item: any) => ({
            itemName: item.itemName,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            urgency: item.urgency,
            remarks: item.remarks,
            impaNumber: item.impaCode || item.impaNumber || null, // Map impaCode to impaNumber
            // Spare requisition fields
            machineryInstanceId: item.machineryInstanceId,
            manualMachineryName: item.manualMachineryName,
            partNumber: item.partNumber,
            plateNumber: item.plateNumber?.trim() || null,
            partName: item.partName,
            itemNumber: item.itemNumber,
            drawingNumber: item.drawingNumber,
            currentRob: item.currentRob,
            addToInventory: item.addToInventory,
            // Lube oil requisition fields
            oilGrade: item.oilGrade,
            // Paint requisition fields
            paintBrand: item.paintBrand,
            paintProductName: item.paintProductName,
            paintColorGrade: item.paintColorGrade,
            paintColorName: item.paintColorName,
            paintColorHex: item.paintColorHex,
            paintType: item.paintType,
            paintCategory: item.paintCategory,
          })),
        },
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            designation: true,
            designationAccessLevel: true,
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
    });

    // For spare requisitions, check and create spare parts if they don't exist
    // Or update ROB if they do exist and ROB is provided
    if (requisitionType === 'SPR' || existingRequisition.requisitionType === 'SPR') {
      const { resolveMachineryIdForRequisitionSpareItem } = await import(
        '@/lib/spares-inventory/resolve-machinery-id-for-requisition-item'
      );
      for (const item of items) {
        // Only process if marked for inventory (default true)
        if (item.addToInventory === false) continue;

        if (item.machineryInstanceId && item.partNumber && item.partName) {
          const machineryId = await resolveMachineryIdForRequisitionSpareItem(
            prisma,
            item.machineryInstanceId
          );
          if (!machineryId) continue;

          const existingPart = await prisma.sparePart.findFirst({
            where: {
              machineryId,
              sparePartNumber: item.partNumber,
              isActive: true,
            },
          });

          if (existingPart) {
            const rob =
              item.currentRob !== undefined && item.currentRob !== null
                ? Number(item.currentRob)
                : NaN;
            await prisma.sparePart.update({
              where: { id: existingPart.id },
              data: {
                ...(!isNaN(rob) ? { quantity: rob } : {}),
                ...(item.plateNumber?.trim()
                  ? { plateNumber: item.plateNumber.trim() }
                  : {}),
              },
            });
          } else {
            const vesselBox = await prisma.box.findFirst({
              where: {
                vesselId: vesselId,
                isActive: true,
              },
            });

            if (vesselBox) {
              const rob = Number(item.currentRob);
              await createSparePartRecord({
                vesselId,
                name: item.partName,
                sparePartNumber: item.partNumber,
                plateNumber: item.plateNumber?.trim() || null,
                boxId: vesselBox.id,
                machineryId,
                quantity: !isNaN(rob) ? rob : 0,
                unit: item.unit || 'PCS',
                description: item.description ?? null,
                remarks: item.remarks ?? null,
              });
            }
          }
        }
      }

      const { upsertMainEnginePlateCatalogFromRequisitionItems } = await import(
        "@/lib/spares-inventory/main-engine-plate-catalog"
      );
      await upsertMainEnginePlateCatalogFromRequisitionItems(prisma, {
        vesselId,
        items,
      });
    }

    // Verify the update was successful
    console.log(`[Requisition Update] Successfully updated requisition ${id}:`, {
      generationStatus: updatedRequisition.generationStatus,
      status: updatedRequisition.status,
      isEditable: updatedRequisition.isEditable,
    });

    // Record purchase history
    await recordPurchaseHistory({
      requisitionId: id,
      actionType: PurchaseHistoryActionType.UPDATED,
      performedById: updatedById,
      actionDescription: `Requisition ${updatedRequisition.requisitionNumber} updated`,
      previousStatus: existingRequisition.status,
      newStatus: updatedRequisition.status,
      previousValue: {
        heading: existingRequisition.heading,
        requisitionType: existingRequisition.requisitionType,
        itemsCount: existingRequisition.items?.length || 0,
      },
      newValue: {
        heading: updatedRequisition.heading,
        requisitionType: updatedRequisition.requisitionType,
        itemsCount: updatedRequisition.items.length,
      },
    });

    // Log activity
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.actinium-sm.org";
      await logActivityFromRequestWithNotification(
        request,
        updatedById,
        "UPDATE_REQUISITION",
        `Updated requisition ${updatedRequisition.requisitionNumber}`,
        {
          module: "Purchase",
          page: "/purchase/requisitions/[id]",
          requisitionNumber: updatedRequisition.requisitionNumber,
          vesselId: updatedRequisition.vesselId,
          metadata: {
            previousStatus: existingRequisition.status,
            newStatus: updatedRequisition.status,
            itemsCount: updatedRequisition.items.length,
          },
          createNotification: false,
        }
      );
    } catch (activityError: any) {
      console.error('Error logging activity:', activityError);
    }

    return NextResponse.json(updatedRequisition);
  } catch (error) {
    console.error("Error updating requisition:", error);
    return NextResponse.json(
      { error: "Failed to update requisition" },
      { status: 500 }
    );
  }
}

// PATCH /api/requisitions/[id] - Partial update (e.g. isBudgeted) for quotes/comparison page
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { isBudgeted } = body;

    if (isBudgeted !== null && typeof isBudgeted !== "boolean") {
      return NextResponse.json(
        { error: "isBudgeted must be true, false, or null" },
        { status: 400 }
      );
    }

    const existing = await prisma.requisition.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        status: true,
        vesselId: true,
        requisitionNumber: true,
        generationStatus: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
    }

    const principal = await getSessionPrincipalFromRequest(request);
    if (!principal) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const viewerContext = await resolveRequisitionViewerContext(principal);
    const allowed = await canPrincipalViewRequisition(principal, existing, viewerContext);
    if (!allowed) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await prisma.requisition.update({
      where: { id },
      data: { isBudgeted },
    });
    return NextResponse.json({ ok: true, isBudgeted });
  } catch (error) {
    console.error("Requisition PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update requisition" },
      { status: 500 }
    );
  }
}

// DELETE /api/requisitions/[id] - Delete requisition
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const deletedById = searchParams.get("deletedById"); // This would come from session in real app

    if (!deletedById) {
      return NextResponse.json(
        { error: "Missing deletedById parameter" },
        { status: 400 }
      );
    }

    // Check if requisition exists
    const existingRequisition = await prisma.requisition.findUnique({
      where: { id },
      include: { createdBy: true },
    });

    if (!existingRequisition) {
      return NextResponse.json(
        { error: "Requisition not found" },
        { status: 404 }
      );
    }

    // Check if requisition can be deleted (only drafts can be deleted)
    if (existingRequisition.generationStatus !== GenerationStatus.SAVED_AS_DRAFT) {
      return NextResponse.json(
        { error: "Only draft requisitions can be deleted" },
        { status: 400 }
      );
    }

    // Get deleter's access level from database
    // IMPORTANT: Always use designationAccessLevel from database, NOT hardcoded mapping
    const deleter = await prisma.employee.findUnique({
      where: { id: deletedById },
      select: { designationAccessLevel: true }
    });

    if (!deleter) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    // Always use designationAccessLevel from database
    const accessLevel = deleter.designationAccessLevel;

    // Check if user is deleting their own requisition or has higher access
    if (existingRequisition.createdById !== deletedById && !isMaster(accessLevel)) {
      return NextResponse.json(
        { error: "You can only delete your own requisitions" },
        { status: 403 }
      );
    }

    // Record purchase history before soft-delete
    await recordPurchaseHistory({
      requisitionId: id,
      actionType: PurchaseHistoryActionType.DELETED,
      performedById: deletedById,
      actionDescription: `Requisition ${existingRequisition.requisitionNumber} deleted`,
      previousStatus: existingRequisition.status,
      previousValue: {
        heading: existingRequisition.heading,
        requisitionType: existingRequisition.requisitionType,
        itemsCount: existingRequisition.items?.length || 0,
      },
    });

    // Soft-delete: set deletedAt and deletedById so row still appears in list with red background
    await prisma.requisition.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: deletedById,
      },
    });

    const { deleteWithVesselSync, deletionSyncJsonFields } = await import(
      "@/lib/vessel-sync/sync-deletion-helper"
    );
    const deletion = await deleteWithVesselSync({
      prisma,
      tableName: "requisitions",
      recordId: id,
      vesselId: existingRequisition.vesselId,
      businessKey: existingRequisition.requisitionNumber,
      deleteData: false,
      reason: "api:requisitions:soft-delete",
    });

    return NextResponse.json({
      message: "Requisition deleted successfully",
      ...deletionSyncJsonFields(deletion),
    });
  } catch (error) {
    console.error("Error deleting requisition:", error);
    return NextResponse.json(
      { error: "Failed to delete requisition" },
      { status: 500 }
    );
  }
}