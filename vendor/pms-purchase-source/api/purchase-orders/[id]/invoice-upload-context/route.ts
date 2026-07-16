import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { resolveQuoteDisplayAmount } from "@/lib/purchase/quote-display-amount";
import { resolveVesselConfirmedAmount } from "@/lib/purchase/vessel-confirmed-amount";
import { isUnbudgetedPurchase, resolveEffectiveIsBudgeted } from "@/lib/purchase/po-budget-classification";

/**
 * GET /api/purchase-orders/[id]/invoice-upload-context
 * PO + quote + DN + vessel receipt snapshot for invoice upload comparison panel.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        requisition: {
          select: {
            id: true,
            requisitionNumber: true,
            heading: true,
            requisitionType: true,
            isBudgeted: true,
            vessel: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        quote: {
          select: {
            id: true,
            quoteNumber: true,
            totalAmount: true,
            netAmountAfterDiscount: true,
            grossAmountBeforeDiscount: true,
            currency: true,
            vendor: { select: { id: true, name: true } },
            quotedItems: { select: { totalPrice: true } },
            deliveryNotes: {
              orderBy: { uploadedAt: "desc" },
              take: 1,
              select: {
                id: true,
                deliveryNoteNumber: true,
                deliveryDate: true,
                status: true,
                uploadedAt: true,
                verifiedAt: true,
                googleDriveFileId: true,
                googleDriveFileName: true,
                receiptConfirmations: {
                  take: 1,
                  select: { id: true, confirmedAt: true, overallStatus: true },
                },
              },
            },
          },
        },
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    const deliveryNote = purchaseOrder.quote.deliveryNotes[0] ?? null;
    const receiptConfirmation = deliveryNote?.receiptConfirmations[0] ?? null;

    const quotedItemsTotal = purchaseOrder.quote.quotedItems.reduce(
      (sum, item) => sum + (item.totalPrice != null ? Number(item.totalPrice) : 0),
      0
    );

    const quoteTotalAmount = resolveQuoteDisplayAmount({
      totalAmount:
        purchaseOrder.quote.totalAmount != null
          ? Number(purchaseOrder.quote.totalAmount)
          : null,
      netAmountAfterDiscount:
        purchaseOrder.quote.netAmountAfterDiscount != null
          ? Number(purchaseOrder.quote.netAmountAfterDiscount)
          : null,
      grossAmountBeforeDiscount:
        purchaseOrder.quote.grossAmountBeforeDiscount != null
          ? Number(purchaseOrder.quote.grossAmountBeforeDiscount)
          : null,
      quotedItemsTotal: quotedItemsTotal > 0 ? quotedItemsTotal : null,
    });

    let vesselConfirmedAmount: number | null = null;
    const vesselId = purchaseOrder.requisition.vessel?.id;
    if (vesselId) {
      vesselConfirmedAmount = await resolveVesselConfirmedAmount(prisma, {
        vesselId,
        poNumber: purchaseOrder.poNumber,
        quoteId: purchaseOrder.quote.id,
      });
    }

    return NextResponse.json({
      purchaseOrder: {
        id: purchaseOrder.id,
        poNumber: purchaseOrder.poNumber,
        poType: purchaseOrder.poType,
        totalAmount:
          purchaseOrder.totalAmount != null ? Number(purchaseOrder.totalAmount) : null,
        currency: purchaseOrder.currency,
        isBudgeted: purchaseOrder.isBudgeted,
        dateOfIssue: purchaseOrder.dateOfIssue?.toISOString() ?? null,
        completionStatus: purchaseOrder.completionStatus,
      },
      requisition: {
        ...purchaseOrder.requisition,
        isBudgeted: purchaseOrder.requisition.isBudgeted,
      },
      quote: {
        id: purchaseOrder.quote.id,
        quoteNumber: purchaseOrder.quote.quoteNumber,
        totalAmount: quoteTotalAmount,
        currency: purchaseOrder.quote.currency,
        vendor: purchaseOrder.quote.vendor,
      },
      deliveryNote: deliveryNote
        ? {
            id: deliveryNote.id,
            deliveryNoteNumber: deliveryNote.deliveryNoteNumber,
            deliveryDate: deliveryNote.deliveryDate?.toISOString() ?? null,
            status: deliveryNote.status,
            uploadedAt: deliveryNote.uploadedAt?.toISOString() ?? null,
            verifiedAt: deliveryNote.verifiedAt?.toISOString() ?? null,
            hasFile: Boolean(deliveryNote.googleDriveFileId),
            fileName: deliveryNote.googleDriveFileName,
            hasReceiptConfirmation: Boolean(receiptConfirmation),
            receiptConfirmedAt: receiptConfirmation?.confirmedAt?.toISOString() ?? null,
            receiptOverallStatus: receiptConfirmation?.overallStatus ?? null,
          }
        : null,
      vesselConfirmedAmount,
      isUnbudgeted: isUnbudgetedPurchase({
        poIsBudgeted: purchaseOrder.isBudgeted,
        requisitionIsBudgeted: purchaseOrder.requisition.isBudgeted,
      }),
      effectiveIsBudgeted: resolveEffectiveIsBudgeted(
        purchaseOrder.isBudgeted,
        purchaseOrder.requisition.isBudgeted
      ),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load PO context";
    console.error("invoice-upload-context:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
