import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import { notifyDeliveryNoteRejected, notifyOnboardReceiptPending } from "@/lib/procurement/approval-notifications";
import { markTaskNotificationsAsRead } from "@/lib/utils/mark-task-notifications-read";
import { markUnreadTasksReadByDedupeKey } from "@/lib/notifications/has-unread-task";
import { resolveTaskDedupeKey } from "@/lib/notifications/task-dedupe";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/delivery-notes/[id]/verify
 * Verify or reject a delivery note
 * Access Control: Only users with access level 25 (Master) or 50 (Admin) can verify
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userAccessLevel = currentUser.designationAccessLevel || 0;
    
    // Only access level 25 (Master) or 50 (Admin) can verify
    if (userAccessLevel !== 25 && !isAdminEquivalentAccessLevel(userAccessLevel)) {
      return NextResponse.json(
        { error: "Insufficient permissions. Access level 25 (Master) or 50 (Admin) required to verify delivery notes." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();
    const { verified, notes } = body;

    if (typeof verified !== "boolean") {
      return NextResponse.json(
        { error: "verified field is required and must be a boolean" },
        { status: 400 }
      );
    }

    // Get delivery note
    const deliveryNote = await prisma.deliveryNote.findUnique({
      where: { id },
      include: {
        vendorQuote: {
          include: {
            requisition: {
              include: {
                vessel: { select: { id: true, companyId: true } },
              },
            },
            purchaseOrders: { select: { poNumber: true }, take: 1 },
          },
        },
      },
    });

    if (!deliveryNote) {
      return NextResponse.json(
        { error: "Delivery note not found" },
        { status: 404 }
      );
    }

    // Validate currentUser has id
    if (!currentUser.id) {
      console.error("Current user missing id:", currentUser);
      return NextResponse.json(
        { error: "Invalid user session" },
        { status: 401 }
      );
    }

    // Prepare update data
    const updateData: any = {
      status: verified ? "VERIFIED" : "REJECTED",
    };

    // Set verifiedAt and verifiedBy only when verifying (not when rejecting)
    if (verified) {
      updateData.verifiedAt = new Date();
      updateData.verifiedBy = currentUser.id;
    } else {
      // When rejecting, clear verifiedAt and verifiedBy
      updateData.verifiedAt = null;
      updateData.verifiedBy = null;
    }

    // Handle notes - preserve existing notes, append verification notes if provided
    if (notes && notes.trim()) {
      // If there are existing notes, append verification notes
      if (deliveryNote.notes && deliveryNote.notes.trim()) {
        updateData.notes = `${deliveryNote.notes}\n\n[Verification ${verified ? 'Approved' : 'Rejected'}]: ${notes.trim()}`;
      } else {
        updateData.notes = `[Verification ${verified ? 'Approved' : 'Rejected'}]: ${notes.trim()}`;
      }
    } else {
      // Keep existing notes if no verification notes provided
      updateData.notes = deliveryNote.notes || null;
    }

    console.log("Updating delivery note with data:", {
      id,
      status: updateData.status,
      verifiedAt: updateData.verifiedAt,
      verifiedBy: updateData.verifiedBy,
      hasNotes: !!updateData.notes,
    });

    const updatedDN = await prisma.deliveryNote.update({
      where: { id },
      data: updateData,
    });

    // Fetch verifier details if verified
    let verifierDetails = null;
    if (verified && updatedDN.verifiedBy) {
      try {
        const verifier = await prisma.employee.findUnique({
          where: { id: updatedDN.verifiedBy },
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        });
        verifierDetails = verifier;
      } catch (e) {
        console.error('Error fetching verifier details:', e);
        // Continue even if verifier fetch fails
      }
    }

    // Serialize the response properly (Prisma returns Date and BigInt which need serialization)
    const serializedDN = {
      id: updatedDN.id,
      deliveryNoteNumber: updatedDN.deliveryNoteNumber,
      deliveryDate: updatedDN.deliveryDate.toISOString(),
      status: updatedDN.status,
      notes: updatedDN.notes,
      googleDriveFileId: updatedDN.googleDriveFileId,
      googleDriveFileName: updatedDN.googleDriveFileName,
      googleDriveFolderId: updatedDN.googleDriveFolderId,
      fileMimeType: updatedDN.fileMimeType,
      fileSize: updatedDN.fileSize ? updatedDN.fileSize.toString() : null,
      uploadedAt: updatedDN.uploadedAt.toISOString(),
      verifiedAt: updatedDN.verifiedAt ? updatedDN.verifiedAt.toISOString() : null,
      verifiedBy: updatedDN.verifiedBy,
      createdAt: updatedDN.createdAt.toISOString(),
      updatedAt: updatedDN.updatedAt.toISOString(),
      verifiedByUser: verifierDetails,
    };

    if (!verified) {
      try {
        const req = deliveryNote.vendorQuote?.requisition;
        await notifyDeliveryNoteRejected({
          request,
          actorUserId: currentUser.id,
          vesselId: req?.vesselId ?? null,
          companyId: req?.vessel?.companyId ?? null,
          requisitionNumber: req?.requisitionNumber,
          purchaseOrderNumber: deliveryNote.vendorQuote?.purchaseOrders?.[0]?.poNumber,
          deliveryNoteId: id,
          deliveryNoteNumber: deliveryNote.deliveryNoteNumber,
          rejectionNotes: notes?.trim() || undefined,
        });
      } catch (notifyErr) {
        console.error("Delivery note rejection notification failed:", notifyErr);
      }
      await markTaskNotificationsAsRead(currentUser.id, id);
    } else {
      const req = deliveryNote.vendorQuote?.requisition;
      const vesselId = req?.vesselId;
      if (vesselId) {
        try {
          await notifyOnboardReceiptPending({
            request,
            actorUserId: currentUser.id,
            vesselId,
            companyId: req?.vessel?.companyId ?? null,
            requisitionNumber: req?.requisitionNumber,
            purchaseOrderNumber: deliveryNote.vendorQuote?.purchaseOrders?.[0]?.poNumber,
            deliveryNoteId: id,
            deliveryNoteNumber: deliveryNote.deliveryNoteNumber,
            metadata: {
              requisitionId: req?.id,
              quoteId: deliveryNote.vendorQuoteId,
            },
          });
        } catch (notifyErr) {
          console.error("Onboard receipt pending notification failed:", notifyErr);
        }
      }

      try {
        const verifyDedupe =
          resolveTaskDedupeKey("DELIVERY_NOTE_VERIFICATION", {
            deliveryNoteId: id,
          }) ?? `dn:${id}:verify`;
        await markUnreadTasksReadByDedupeKey({
          operation: "DELIVERY_NOTE_VERIFICATION",
          dedupeKey: verifyDedupe,
        });
      } catch (cleanupErr) {
        console.error("DN verification task cleanup failed:", cleanupErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: verified ? "Delivery note verified successfully" : "Delivery note rejected",
      deliveryNote: serializedDN,
    });
  } catch (error: any) {
    console.error("Error verifying delivery note:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    });
    return NextResponse.json(
      {
        error: "Failed to verify delivery note",
        details: error.message || "Unknown error occurred",
        ...(process.env.NODE_ENV === 'development' && {
          code: error.code,
          meta: error.meta,
        }),
      },
      { status: 500 }
    );
  }
}


