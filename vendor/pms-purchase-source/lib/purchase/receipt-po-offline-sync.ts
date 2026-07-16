import type { Prisma } from "@prisma/client";

export type ReceiptSyncLine = {
  requisitionItemId: string;
  itemName: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unit: string;
  unitPrice?: number | null;
  status: string;
};

export type ReceiptPoOfflineSyncResult = {
  poNumber: string;
  hasVariance: boolean;
  receiptAmountVariance: number;
};

/**
 * Mirror web receipt confirmation into `purchase_orders_offline` for PO Variance (shore).
 */
export async function syncReceiptConfirmationToPoOffline(
  tx: Prisma.TransactionClient,
  params: {
    vesselId: string;
    vesselName: string;
    requisitionId: string;
    requisitionNumber: string;
    requisitionType: string;
    quoteId: string;
    crewReceiptById: string;
    crewReceiptAt: Date;
    overallStatus: string;
    items: ReceiptSyncLine[];
  }
): Promise<ReceiptPoOfflineSyncResult | null> {
  const po = await tx.purchaseOrder.findFirst({
    where: { quoteId: params.quoteId },
    select: {
      poNumber: true,
      totalAmount: true,
      currency: true,
      workflowStatus: true,
      completionStatus: true,
      dateOfIssue: true,
    },
  });

  if (!po) return null;

  const receiptLines = params.items.map((item) => {
    const unitPrice = item.unitPrice ?? 0;
    const qtyVariance = item.receivedQuantity - item.orderedQuantity;
    const poLineAmount = unitPrice * item.orderedQuantity;
    const receivedLineAmount = unitPrice * item.receivedQuantity;
    return {
      lineKey: item.requisitionItemId,
      itemName: item.itemName,
      qtyOrdered: item.orderedQuantity,
      qtyReceived: item.receivedQuantity,
      qtyVariance,
      unitPrice,
      poLineAmount,
      receivedLineAmount,
      lineAmountVariance: receivedLineAmount - poLineAmount,
      lineRemark: item.status,
    };
  });

  const lineItems = receiptLines.map((line) => ({
    lineKey: line.lineKey,
    itemName: line.itemName,
    qtyOrdered: line.qtyOrdered,
    unitPrice: line.unitPrice,
    poLineAmount: line.poLineAmount,
  }));

  const sumPoLineAmount = receiptLines.reduce((sum, line) => sum + line.poLineAmount, 0);
  const sumReceivedLineAmount = receiptLines.reduce(
    (sum, line) => sum + line.receivedLineAmount,
    0
  );
  const poHeaderTotal = po.totalAmount != null ? Number(po.totalAmount) : sumPoLineAmount;
  const amountVarianceByLines = sumReceivedLineAmount - sumPoLineAmount;

  const variance = {
    currency: po.currency,
    poHeaderTotal,
    sumPoLineAmount,
    sumReceivedLineAmount,
    amountVarianceByLines,
    amountVarianceVsPoHeader: sumReceivedLineAmount - poHeaderTotal,
    lines: receiptLines,
    source: "web_receipt_confirmation",
  };

  const hasVariance =
    receiptLines.some((line) => line.qtyVariance !== 0) || amountVarianceByLines !== 0;

  const payload = {
    vesselId: params.vesselId,
    requisitionId: params.requisitionId,
    requisitionNumber: params.requisitionNumber,
    poNumber: po.poNumber,
    quoteId: params.quoteId,
    dateOfIssue: po.dateOfIssue,
    status: "ACTIVE",
    workflowStatus: po.workflowStatus,
    completionStatus: po.completionStatus,
    totalAmount: po.totalAmount != null ? String(po.totalAmount) : null,
    currency: po.currency,
    vesselName: params.vesselName,
    crewReceiptStatus: params.overallStatus,
    crewReceiptAt: params.crewReceiptAt,
    crewReceiptById: params.crewReceiptById,
    requisitionType: params.requisitionType,
    lineItemsJson: JSON.stringify(lineItems),
    receiptLinesJson: JSON.stringify(receiptLines),
    receiptVarianceJson: JSON.stringify(variance),
    receiptAmountVariance: amountVarianceByLines,
    receiptHasVariance: hasVariance,
    deletedAt: null,
  };

  const existing = await tx.purchaseOrdersOffline.findFirst({
    where: {
      vesselId: params.vesselId,
      poNumber: po.poNumber,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (existing) {
    await tx.purchaseOrdersOffline.update({
      where: { id: existing.id },
      data: payload,
    });
  } else {
    await tx.purchaseOrdersOffline.create({ data: payload });
  }

  return {
    poNumber: po.poNumber,
    hasVariance,
    receiptAmountVariance: amountVarianceByLines,
  };
}
