import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toJsonSafe } from "@/lib/json-safe";
import { getCurrentUserFromRequest } from "@/lib/session";
import {
  listPendingReceiptDeliveryNotes,
  serializePendingReceiptDeliveryNote,
} from "@/lib/purchase/pending-receipt-delivery-notes";

// GET /api/delivery-notes - Get delivery notes
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vesselId = searchParams.get("vesselId");
    const pendingReceipt = searchParams.get("pendingReceipt") === "true";
    const status = searchParams.get("status");
    const vendorQuoteId = searchParams.get("vendorQuoteId");
    const parentRequisitionId = searchParams.get("parentRequisitionId");
    const parentRequisitionNumber = searchParams.get("parentRequisitionNumber");

    if (pendingReceipt) {
      if (!vesselId) {
        return NextResponse.json(
          { error: "vesselId is required when pendingReceipt=true" },
          { status: 400 }
        );
      }
      const rows = await listPendingReceiptDeliveryNotes(prisma, vesselId);
      return NextResponse.json({
        deliveryNotes: rows.map(serializePendingReceiptDeliveryNote),
      });
    }

    const where: Record<string, unknown> = {};

    if (vesselId) {
      where.vendorQuote = {
        requisition: {
          vesselId: vesselId,
        },
      };
    }

    if (status) {
      where.status = status;
    }

    if (vendorQuoteId) {
      where.vendorQuoteId = vendorQuoteId;
    }

    if (parentRequisitionId || parentRequisitionNumber) {
      where.vendorQuote = (where.vendorQuote as Record<string, unknown>) || {};
      const reqOr = parentRequisitionId
        ? ([{ id: parentRequisitionId }, { parentRequisitionId }] as const)
        : parentRequisitionNumber
          ? [
              {
                requisitionNumber: {
                  contains: parentRequisitionNumber,
                  mode: "insensitive" as const,
                },
              },
              {
                parentRequisition: {
                  requisitionNumber: {
                    contains: parentRequisitionNumber,
                    mode: "insensitive" as const,
                  },
                },
              },
            ]
          : [];
      const vq = where.vendorQuote as {
        requisition?: Record<string, unknown>;
      };
      where.vendorQuote = {
        ...vq,
        requisition: {
          ...vq.requisition,
          ...(reqOr.length ? { OR: reqOr } : {}),
        },
      };
    }

    const deliveryNotes = await prisma.deliveryNote.findMany({
      where,
      select: {
        id: true,
        deliveryNoteNumber: true,
        deliveryDate: true,
        status: true,
        notes: true,
        googleDriveFileId: true,
        googleDriveFileName: true,
        fileMimeType: true,
        uploadedAt: true,
        verifiedAt: true,
        verifiedBy: true,
        createdAt: true,
        updatedAt: true,
        vendorQuoteId: true,
        vendorId: true,
        vendorQuote: {
          include: {
            requisition: {
              select: {
                id: true,
                requisitionNumber: true,
                heading: true,
                parentRequisitionId: true,
                parentRequisition: {
                  select: { id: true, requisitionNumber: true },
                },
                vessel: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
            vendor: {
              select: {
                id: true,
                name: true,
                vendorId: true,
              },
            },
            purchaseOrders: {
              take: 1,
              orderBy: { dateOfIssue: "desc" },
              select: { id: true, poNumber: true },
            },
          },
        },
        receiptConfirmations: {
          select: {
            id: true,
            confirmedAt: true,
            overallStatus: true,
            confirmedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeId: true,
              },
            },
          },
          orderBy: {
            confirmedAt: "desc",
          },
        },
      },
      orderBy: {
        deliveryDate: "desc",
      },
    });

    const normalized = deliveryNotes.map((dn) => ({
      ...dn,
      deliveryDate: dn.deliveryDate.toISOString(),
      uploadedAt: dn.uploadedAt.toISOString(),
      verifiedAt: dn.verifiedAt?.toISOString() ?? null,
      createdAt: dn.createdAt.toISOString(),
      updatedAt: dn.updatedAt.toISOString(),
      purchaseOrder: dn.vendorQuote.purchaseOrders[0] ?? null,
      receiptConfirmations: dn.receiptConfirmations.map((rc) => ({
        ...rc,
        confirmedAt: rc.confirmedAt.toISOString(),
      })),
    }));

    return NextResponse.json(toJsonSafe({ deliveryNotes: normalized }));
  } catch (error) {
    console.error("Error fetching delivery notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch delivery notes" },
      { status: 500 }
    );
  }
}
