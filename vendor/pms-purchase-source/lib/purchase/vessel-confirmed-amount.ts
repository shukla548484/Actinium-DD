import type { PrismaClient } from "@prisma/client";

function toNum(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Vessel receipt total from synced offline PO receipt data. */
export async function vesselConfirmedAmountFromOffline(
  db: Pick<PrismaClient, "purchaseOrdersOffline">,
  vesselId: string,
  poNumber: string
): Promise<number | null> {
  const row = await db.purchaseOrdersOffline.findFirst({
    where: {
      vesselId,
      poNumber,
      deletedAt: null,
      crewReceiptAt: { not: null },
    },
    select: { receiptVarianceJson: true, receiptLinesJson: true },
  });

  if (!row) return null;

  try {
    const variance = JSON.parse(row.receiptVarianceJson || "{}") as {
      sumReceivedLineAmount?: number;
    };
    const fromVariance = toNum(variance.sumReceivedLineAmount);
    if (fromVariance != null) return fromVariance;
  } catch {
    /* fall through */
  }

  try {
    const lines = JSON.parse(row.receiptLinesJson || "[]") as Array<{
      receivedLineAmount?: number;
    }>;
    const total = lines.reduce((sum, line) => sum + (toNum(line.receivedLineAmount) ?? 0), 0);
    return lines.length > 0 ? total : null;
  } catch {
    return null;
  }
}

/** Vessel receipt total from onboard receipt confirmation on the vendor quote. */
export async function vesselConfirmedAmountFromQuoteReceipt(
  db: Pick<PrismaClient, "requisitionReceiptConfirmation">,
  quoteId: string
): Promise<number | null> {
  const confirmation = await db.requisitionReceiptConfirmation.findFirst({
    where: { vendorQuoteId: quoteId },
    orderBy: { confirmedAt: "desc" },
    include: {
      itemStatuses: {
        include: {
          vendorQuoteItem: { select: { unitPrice: true } },
        },
      },
    },
  });

  if (!confirmation?.itemStatuses.length) return null;

  return confirmation.itemStatuses.reduce((sum, status) => {
    const unitPrice = toNum(status.vendorQuoteItem?.unitPrice) ?? 0;
    const receivedQty = toNum(status.receivedQuantity) ?? 0;
    return sum + unitPrice * receivedQty;
  }, 0);
}

export async function resolveVesselConfirmedAmount(
  db: Pick<PrismaClient, "purchaseOrdersOffline" | "requisitionReceiptConfirmation">,
  params: { vesselId: string; poNumber: string; quoteId: string }
): Promise<number | null> {
  const fromOffline = await vesselConfirmedAmountFromOffline(
    db,
    params.vesselId,
    params.poNumber
  );
  if (fromOffline != null) return fromOffline;

  return vesselConfirmedAmountFromQuoteReceipt(db, params.quoteId);
}
