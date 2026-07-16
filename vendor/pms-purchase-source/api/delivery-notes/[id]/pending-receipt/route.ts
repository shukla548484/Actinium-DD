import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { canConfirmOnboardReceipt } from "@/lib/purchase/receipt-confirmation-access";
import {
  matchQuoteItemForRequisitionItem,
  orderedQuantityFromQuoteItem,
} from "@/lib/purchase/receipt-ordered-qty";

// GET /api/delivery-notes/[id]/pending-receipt - Get delivery note details for receipt confirmation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessLevel = currentUser.designationAccessLevel || 0;
    if (!canConfirmOnboardReceipt(accessLevel)) {
      return NextResponse.json(
        { error: "Access denied. Required access level: 20-24" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const deliveryNote = await prisma.deliveryNote.findUnique({
      where: { id },
      include: {
        vendorQuote: {
          include: {
            requisition: {
              include: {
                vessel: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
                items: {
                  include: {
                    defect: true,
                  },
                  orderBy: {
                    createdAt: "asc",
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
            quotedItems: {
              orderBy: {
                createdAt: "asc",
              },
            },
            purchaseOrders: {
              take: 1,
              select: {
                id: true,
                poNumber: true,
              },
            },
          },
        },
        receiptConfirmations: {
          include: {
            confirmedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeId: true,
              },
            },
            itemStatuses: true,
          },
          orderBy: {
            confirmedAt: "desc",
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

    const isConfirmed = deliveryNote.receiptConfirmations.length > 0;
    const lastConfirmation = isConfirmed
      ? deliveryNote.receiptConfirmations[0]
      : null;

    const itemsWithQuoteInfo = deliveryNote.vendorQuote.requisition.items.map(
      (reqItem) => {
        const quoteItem = matchQuoteItemForRequisitionItem(
          reqItem,
          deliveryNote.vendorQuote.quotedItems
        );
        const orderedQuantity = orderedQuantityFromQuoteItem(quoteItem);

        const receiptStatus = lastConfirmation?.itemStatuses.find(
          (status) => status.requisitionItemId === reqItem.id
        );

        return {
          requisitionItem: {
            id: reqItem.id,
            itemName: reqItem.itemName,
            description: reqItem.description,
            partNumber: reqItem.partNumber,
            partName: reqItem.partName,
            quantity: Number(reqItem.quantity),
            unit: reqItem.unit,
            machineryInstanceId: reqItem.machineryInstanceId,
            manualMachineryName: reqItem.manualMachineryName,
            addToInventory: reqItem.addToInventory,
            currentRob: reqItem.currentRob ? Number(reqItem.currentRob) : null,
          },
          quoteItem: quoteItem
            ? {
                id: quoteItem.id,
                itemName: quoteItem.itemName,
                quantity: Number(quoteItem.quantity),
                unit: quoteItem.unit,
                partNumber: quoteItem.partNumber,
                unitPrice: quoteItem.unitPrice
                  ? Number(quoteItem.unitPrice)
                  : null,
                totalPrice: quoteItem.totalPrice
                  ? Number(quoteItem.totalPrice)
                  : null,
              }
            : null,
          orderedQuantity,
          requestedQuantity: Number(reqItem.quantity),
          receiptStatus: receiptStatus
            ? {
                id: receiptStatus.id,
                status: receiptStatus.status,
                receivedQuantity: Number(receiptStatus.receivedQuantity),
                expectedQuantity: Number(receiptStatus.expectedQuantity),
                issueType: receiptStatus.issueType,
                issueDescription: receiptStatus.issueDescription,
                isAddedToInventory: receiptStatus.isAddedToInventory,
              }
            : null,
        };
      }
    );

    const purchaseOrder = deliveryNote.vendorQuote.purchaseOrders[0] ?? null;

    return NextResponse.json({
      deliveryNote: {
        id: deliveryNote.id,
        deliveryNoteNumber: deliveryNote.deliveryNoteNumber,
        deliveryDate: deliveryNote.deliveryDate,
        status: deliveryNote.status,
        notes: deliveryNote.notes,
      },
      requisition: {
        id: deliveryNote.vendorQuote.requisition.id,
        requisitionNumber: deliveryNote.vendorQuote.requisition.requisitionNumber,
        heading: deliveryNote.vendorQuote.requisition.heading,
        portOfSupply: deliveryNote.vendorQuote.requisition.portOfSupply,
        vessel: deliveryNote.vendorQuote.requisition.vessel,
      },
      vendor: deliveryNote.vendorQuote.vendor,
      vendorQuote: {
        id: deliveryNote.vendorQuote.id,
        quoteNumber: deliveryNote.vendorQuote.quoteNumber,
      },
      purchaseOrder,
      items: itemsWithQuoteInfo,
      isConfirmed,
      lastConfirmation: lastConfirmation
        ? {
            id: lastConfirmation.id,
            confirmedAt: lastConfirmation.confirmedAt,
            confirmedBy: lastConfirmation.confirmedByUser,
            overallStatus: lastConfirmation.overallStatus,
            portOfReceived: lastConfirmation.portOfReceived,
            receivedDate: lastConfirmation.receivedDate,
            notes: lastConfirmation.notes,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching delivery note for receipt:", error);
    return NextResponse.json(
      { error: "Failed to fetch delivery note" },
      { status: 500 }
    );
  }
}
