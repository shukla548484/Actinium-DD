import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { z } from "zod";
import { applySprReceiptToInventory } from "@/lib/spares-inventory/receiving-inventory.service";
import { canConfirmOnboardReceipt } from "@/lib/purchase/receipt-confirmation-access";
import {
  computeOverallReceiptStatus,
  hasReceiptQuantityVariance,
  matchQuoteItemForRequisitionItem,
  orderedQuantityFromQuoteItem,
  resolveReceiptLineStatus,
  type ReceiptLineStatus,
} from "@/lib/purchase/receipt-ordered-qty";
import { syncReceiptConfirmationToPoOffline } from "@/lib/purchase/receipt-po-offline-sync";
import { notifyReceiptQuantityVariance } from "@/lib/procurement/approval-notifications";
import { markUnreadTasksReadByDedupeKey } from "@/lib/notifications/has-unread-task";
import { resolveTaskDedupeKey } from "@/lib/notifications/task-dedupe";

const receiptConfirmationSchema = z.object({
  deliveryNoteId: z.string().uuid(),
  requisitionId: z.string().uuid(),
  vendorQuoteId: z.string().uuid(),
  overallStatus: z.enum(["FULLY_RECEIVED", "PARTIALLY_RECEIVED", "NOT_RECEIVED"]),
  portOfReceived: z.string().trim().min(1, "Port of received is required").max(128),
  receivedDate: z
    .string()
    .trim()
    .min(1, "Date of received is required")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of received must be YYYY-MM-DD"),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      requisitionItemId: z.string().uuid(),
      vendorQuoteItemId: z.string().uuid().optional(),
      status: z.enum([
        "RECEIVED",
        "NOT_RECEIVED",
        "RETURNED",
        "INCORRECT",
        "QUANTITY_MISMATCH",
        "OTHER_ISSUE",
      ]),
      receivedQuantity: z.number().min(0),
      expectedQuantity: z.number().min(0),
      unit: z.string().default("PCS"),
      issueType: z.string().nullish(),
      issueDescription: z.string().nullish(),
      putAway: z
        .object({
          boxId: z.string().uuid().optional().nullable(),
          currentRobLocation: z.string().optional().nullable(),
        })
        .optional()
        .nullable(),
    })
  ),
});

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requisitionId = searchParams.get("requisitionId");
    const deliveryNoteId = searchParams.get("deliveryNoteId");
    const vendorQuoteId = searchParams.get("vendorQuoteId");

    if (!requisitionId && !deliveryNoteId && !vendorQuoteId) {
      return NextResponse.json(
        { error: "Either requisitionId, deliveryNoteId, or vendorQuoteId is required" },
        { status: 400 }
      );
    }

    const where: Record<string, string> = {};
    if (requisitionId) where.requisitionId = requisitionId;
    if (deliveryNoteId) where.deliveryNoteId = deliveryNoteId;
    if (vendorQuoteId) where.vendorQuoteId = vendorQuoteId;

    const confirmations = await prisma.requisitionReceiptConfirmation.findMany({
      where,
      include: {
        deliveryNote: {
          select: {
            id: true,
            deliveryNoteNumber: true,
            deliveryDate: true,
            status: true,
          },
        },
        requisition: {
          select: {
            id: true,
            requisitionNumber: true,
            heading: true,
            requisitionType: true,
            vessel: { select: { id: true, name: true } },
          },
        },
        vendorQuote: {
          select: {
            id: true,
            quoteNumber: true,
            vendor: { select: { id: true, name: true } },
          },
        },
        confirmedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
          },
        },
        itemStatuses: {
          include: {
            requisitionItem: {
              select: {
                id: true,
                itemName: true,
                partNumber: true,
                partName: true,
                quantity: true,
                unit: true,
                machineryInstanceId: true,
                addToInventory: true,
                remarks: true,
              },
            },
            vendorQuoteItem: {
              select: {
                id: true,
                itemName: true,
                quantity: true,
                unit: true,
                partNumber: true,
              },
            },
            inventorySparePart: {
              select: {
                id: true,
                name: true,
                sparePartNumber: true,
                quantity: true,
                boxId: true,
                currentRobLocation: true,
              },
            },
            putawayBox: {
              select: {
                id: true,
                boxNumber: true,
                rack: {
                  select: {
                    rackNumber: true,
                    storeLocation: { select: { name: true, code: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { confirmedAt: "desc" },
    });

    return NextResponse.json({ confirmations });
  } catch (error) {
    console.error("Error fetching receipt confirmations:", error);
    return NextResponse.json(
      { error: "Failed to fetch receipt confirmations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = receiptConfirmationSchema.parse(await request.json());

    const deliveryNote = await prisma.deliveryNote.findUnique({
      where: { id: body.deliveryNoteId },
      include: {
        vendorQuote: {
          include: {
            quotedItems: true,
            purchaseOrders: { take: 1, select: { poNumber: true } },
            requisition: { include: { vessel: true } },
          },
        },
      },
    });

    if (!deliveryNote) {
      return NextResponse.json({ error: "Delivery note not found" }, { status: 404 });
    }

    if (deliveryNote.status !== "VERIFIED" && deliveryNote.status !== "UPLOADED") {
      return NextResponse.json(
        { error: "Delivery note must be issued (VERIFIED or UPLOADED) before confirmation" },
        { status: 400 }
      );
    }

    const requisition = deliveryNote.vendorQuote.requisition;
    if (requisition.id !== body.requisitionId) {
      return NextResponse.json({ error: "Requisition mismatch" }, { status: 400 });
    }

    if (deliveryNote.vendorQuote.id !== body.vendorQuoteId) {
      return NextResponse.json({ error: "Vendor quote mismatch" }, { status: 400 });
    }

    const existingConfirmation = await prisma.requisitionReceiptConfirmation.findFirst({
      where: {
        deliveryNoteId: body.deliveryNoteId,
        requisitionId: body.requisitionId,
      },
    });

    if (existingConfirmation) {
      return NextResponse.json(
        { error: "Receipt already confirmed for this delivery note" },
        { status: 400 }
      );
    }

    const quotedItems = deliveryNote.vendorQuote.quotedItems;
    const normalizedItems: Array<{
      requisitionItemId: string;
      vendorQuoteItemId: string;
      status: ReceiptLineStatus;
      receivedQuantity: number;
      orderedQuantity: number;
      unit: string;
      issueType?: string;
      issueDescription?: string;
      putAway?: { boxId?: string; currentRobLocation?: string | null } | null;
      itemName: string;
      unitPrice: number | null;
    }> = [];

    for (const item of body.items) {
      const requisitionItem = await prisma.requisitionItem.findUnique({
        where: { id: item.requisitionItemId },
      });
      if (!requisitionItem) {
        return NextResponse.json(
          { error: `Requisition item ${item.requisitionItemId} not found` },
          { status: 400 }
        );
      }

      const quoteItem = matchQuoteItemForRequisitionItem(
        requisitionItem,
        quotedItems
      );
      if (!quoteItem) {
        return NextResponse.json(
          {
            error: `No ordered quote line found for item "${requisitionItem.itemName}". Shore must link quote items before onboard receipt.`,
          },
          { status: 400 }
        );
      }

      const orderedQuantity = orderedQuantityFromQuoteItem(quoteItem);
      if (orderedQuantity == null) {
        return NextResponse.json(
          { error: `Invalid ordered quantity for item "${requisitionItem.itemName}"` },
          { status: 400 }
        );
      }

      if (Math.abs(item.expectedQuantity - orderedQuantity) > 0.0001) {
        return NextResponse.json(
          {
            error: `Expected quantity must match ordered quantity (${orderedQuantity}) for "${requisitionItem.itemName}"`,
          },
          { status: 400 }
        );
      }

      const resolvedStatus = resolveReceiptLineStatus(
        item.status,
        item.receivedQuantity,
        orderedQuantity
      );

      normalizedItems.push({
        requisitionItemId: item.requisitionItemId,
        vendorQuoteItemId: quoteItem.id,
        status: resolvedStatus,
        receivedQuantity: item.receivedQuantity,
        orderedQuantity,
        unit: item.unit || quoteItem.unit,
        issueType: item.issueType,
        issueDescription: item.issueDescription,
        putAway: item.putAway,
        itemName: requisitionItem.partName || requisitionItem.itemName,
        unitPrice: quoteItem.unitPrice != null ? Number(quoteItem.unitPrice) : null,
      });
    }

    const overallStatus = computeOverallReceiptStatus(
      normalizedItems.map((item) => ({
        status: item.status,
        receivedQuantity: item.receivedQuantity,
        orderedQuantity: item.orderedQuantity,
      }))
    );

    const inventoryResults: Awaited<ReturnType<typeof applySprReceiptToInventory>>[] = [];
    const confirmedAt = new Date();
    const receivedDate = new Date(`${body.receivedDate}T12:00:00.000Z`);

    const result = await prisma.$transaction(async (tx) => {
      const confirmation = await tx.requisitionReceiptConfirmation.create({
        data: {
          deliveryNoteId: body.deliveryNoteId,
          requisitionId: body.requisitionId,
          vendorQuoteId: body.vendorQuoteId,
          confirmedBy: currentUser.id,
          overallStatus,
          portOfReceived: body.portOfReceived.trim(),
          receivedDate,
          notes: body.notes || null,
        },
      });

      const itemStatuses = [];

      for (const item of normalizedItems) {
        const requisitionItem = await tx.requisitionItem.findUnique({
          where: { id: item.requisitionItemId },
        });
        if (!requisitionItem) {
          throw new Error(`Requisition item ${item.requisitionItemId} not found`);
        }

        const itemStatus = await tx.requisitionItemReceiptStatus.create({
          data: {
            receiptConfirmationId: confirmation.id,
            requisitionItemId: item.requisitionItemId,
            vendorQuoteItemId: item.vendorQuoteItemId,
            status: item.status,
            receivedQuantity: item.receivedQuantity,
            expectedQuantity: item.orderedQuantity,
            unit: item.unit,
            issueType: item.issueType || null,
            issueDescription: item.issueDescription || null,
            isAddedToInventory: false,
          },
        });

        const invResult = await applySprReceiptToInventory(tx, {
          requisitionId: body.requisitionId,
          requisitionType: requisition.requisitionType,
          vesselId: requisition.vesselId,
          deliveryNoteId: body.deliveryNoteId,
          deliveryNoteNumber: deliveryNote.deliveryNoteNumber,
          requisitionNumber: requisition.requisitionNumber,
          vendorQuoteId: body.vendorQuoteId,
          createdById: currentUser.id,
          itemReceiptStatusId: itemStatus.id,
          line: {
            requisitionItemId: item.requisitionItemId,
            status: item.status,
            receivedQuantity: item.receivedQuantity,
            unit: item.unit,
            putAway: item.putAway,
          },
          requisitionItem,
        });

        inventoryResults.push(invResult);
        itemStatuses.push(itemStatus);
      }

      const offlineSync = await syncReceiptConfirmationToPoOffline(tx, {
        vesselId: requisition.vesselId,
        vesselName: requisition.vessel.name,
        requisitionId: requisition.id,
        requisitionNumber: requisition.requisitionNumber,
        requisitionType: requisition.requisitionType,
        quoteId: body.vendorQuoteId,
        crewReceiptById: currentUser.id,
        crewReceiptAt: confirmedAt,
        overallStatus,
        items: normalizedItems.map((item) => ({
          requisitionItemId: item.requisitionItemId,
          itemName: item.itemName,
          orderedQuantity: item.orderedQuantity,
          receivedQuantity: item.receivedQuantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          status: item.status,
        })),
      });

      return { confirmation, itemStatuses, offlineSync };
    });

    const varianceLineCount = normalizedItems.filter(
      (item) => item.receivedQuantity !== item.orderedQuantity
    ).length;

    if (hasReceiptQuantityVariance(normalizedItems)) {
      await notifyReceiptQuantityVariance({
        request,
        actorUserId: currentUser.id,
        vesselId: requisition.vesselId,
        companyId: requisition.vessel.companyId ?? null,
        requisitionNumber: requisition.requisitionNumber,
        purchaseOrderNumber:
          deliveryNote.vendorQuote.purchaseOrders[0]?.poNumber ??
          result.offlineSync?.poNumber,
        deliveryNoteId: body.deliveryNoteId,
        deliveryNoteNumber: deliveryNote.deliveryNoteNumber,
        varianceLineCount,
        metadata: {
          requisitionId: requisition.id,
          quoteId: body.vendorQuoteId,
        },
      });
    }

    try {
      const receiptDedupe =
        resolveTaskDedupeKey("ONBOARD_RECEIPT_PENDING", {
          deliveryNoteId: body.deliveryNoteId,
        }) ?? `dn:${body.deliveryNoteId}:receipt`;
      await markUnreadTasksReadByDedupeKey({
        operation: "ONBOARD_RECEIPT_PENDING",
        dedupeKey: receiptDedupe,
      });
    } catch (cleanupErr) {
      console.error("Onboard receipt task cleanup failed:", cleanupErr);
    }

    return NextResponse.json(
      {
        message: "Receipt confirmation created successfully",
        confirmation: result.confirmation,
        itemStatuses: result.itemStatuses,
        inventoryResults,
        overallStatus,
        offlineSync: result.offlineSync,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating receipt confirmation:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create receipt confirmation",
      },
      { status: 500 }
    );
  }
}
