import { QuoteStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildSplitQuoteSlice } from '@/lib/procurement/split-quote-slice';
import type { Requisition, RequisitionItem, VendorQuote, VendorQuoteItem, Vendor } from '@prisma/client';

export type ApprovedQuoteForConfirm = {
  quoteId: string;
  childRequisitionId: string | null;
  parentRequisitionId: string | null;
  isSplitChild: boolean;
  hasPurchaseOrder: boolean;
};

type QuoteWithDetails = VendorQuote & {
  vendor: Vendor;
  quotedItems: VendorQuoteItem[];
};

type ParentRequisition = Requisition & {
  items: RequisitionItem[];
  vessel: { id: string; name: string; code: string | null } | null;
};

type ChildRequisition = Requisition & {
  items: RequisitionItem[];
  vessel: { id: string; name: string; code: string | null } | null;
  createdBy: { id: string; firstName: string; lastName: string; email: string } | null;
};

export type SplitChildConfirmContext = {
  parentRequisitionId: string;
  childRequisitionId: string;
  parentRequisition: ParentRequisition;
  childRequisition: ChildRequisition;
  quote: QuoteWithDetails;
  quoteForPo: QuoteWithDetails;
  effectiveTotalAmount: number;
};

function buildSlicedQuote(
  quote: QuoteWithDetails,
  requisitionItemIds: string[],
  parentItems: RequisitionItem[]
): { quoteForPo: QuoteWithDetails; effectiveTotalAmount: number } {
  const parentItemRefs = parentItems.map((i) => ({
    id: i.id,
    itemName: i.itemName,
    quantity: Number(i.quantity),
    unit: i.unit,
  }));

  const { quoteSlice, sliceTotal } = buildSplitQuoteSlice(
    {
      quotedItems: quote.quotedItems.map((qi) => ({
        id: qi.id,
        requisitionItemId: qi.requisitionItemId,
        itemName: qi.itemName,
        quantity: qi.quantity != null ? Number(qi.quantity) : null,
        unit: qi.unit,
        unitPrice: qi.unitPrice != null ? Number(qi.unitPrice) : null,
        totalPrice: qi.totalPrice != null ? Number(qi.totalPrice) : null,
        remarks: qi.remarks,
        itemRemarks: qi.itemRemarks,
      })),
      additionalCharges: quote.additionalCharges != null ? Number(quote.additionalCharges) : null,
      deliveryCharges: quote.deliveryCharges != null ? Number(quote.deliveryCharges) : null,
      packingCharges: quote.packingCharges != null ? Number(quote.packingCharges) : null,
      totalAmount: quote.totalAmount != null ? Number(quote.totalAmount) : null,
      currency: quote.currency,
    },
    requisitionItemIds,
    parentItemRefs
  );

  const quoteForPo: QuoteWithDetails = {
    ...quote,
    quotedItems: quote.quotedItems.map((orig) => {
      const sliced = quoteSlice.quotedItems.find(
        (s) =>
          (s.id && s.id === orig.id) ||
          s.itemName?.toLowerCase().trim() === orig.itemName?.toLowerCase().trim()
      );
      if (!sliced) {
        return {
          ...orig,
          quantity: 0 as typeof orig.quantity,
          unitPrice: orig.unitPrice != null ? (0 as typeof orig.unitPrice) : orig.unitPrice,
          totalPrice: orig.totalPrice != null ? (0 as typeof orig.totalPrice) : orig.totalPrice,
        };
      }
      return {
        ...orig,
        quantity: sliced.quantity != null ? (sliced.quantity as typeof orig.quantity) : orig.quantity,
        unitPrice:
          sliced.unitPrice != null ? (sliced.unitPrice as typeof orig.unitPrice) : orig.unitPrice,
        totalPrice:
          sliced.totalPrice != null ? (sliced.totalPrice as typeof orig.totalPrice) : orig.totalPrice,
      };
    }),
    totalAmount: sliceTotal as typeof quote.totalAmount,
  };

  return { quoteForPo, effectiveTotalAmount: sliceTotal };
}

/** Resolve the approved vendor quote used to confirm / send a PO for a requisition row. */
export async function resolveApprovedQuoteForConfirm(
  requisitionId: string
): Promise<ApprovedQuoteForConfirm | null> {
  const requisition = await prisma.requisition.findUnique({
    where: { id: requisitionId },
    select: { id: true, parentRequisitionId: true },
  });

  if (!requisition) return null;

  if (!requisition.parentRequisitionId) {
    const approvedQuote = await prisma.vendorQuote.findFirst({
      where: {
        requisitionId,
        status: QuoteStatus.APPROVED,
      },
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!approvedQuote) return null;

    const existingPo = await prisma.purchaseOrder.findFirst({
      where: { quoteId: approvedQuote.id, status: 'ACTIVE' },
      select: { id: true },
    });

    return {
      quoteId: approvedQuote.id,
      childRequisitionId: null,
      parentRequisitionId: null,
      isSplitChild: false,
      hasPurchaseOrder: !!existingPo,
    };
  }

  const allocation = await prisma.requisitionSplitAllocation.findFirst({
    where: { childRequisitionId: requisitionId },
    include: {
      vendorQuote: { select: { id: true, status: true } },
    },
  });

  if (!allocation || allocation.vendorQuote.status !== QuoteStatus.APPROVED) {
    return null;
  }

  const existingPo = await prisma.purchaseOrder.findFirst({
    where: {
      quoteId: allocation.vendorQuoteId,
      requisitionId: requisitionId,
      status: 'ACTIVE',
    },
    select: { id: true },
  });

  return {
    quoteId: allocation.vendorQuoteId,
    childRequisitionId: requisitionId,
    parentRequisitionId: allocation.parentRequisitionId,
    isSplitChild: true,
    hasPurchaseOrder: !!existingPo,
  };
}

/** Load split-child context for PO preview / confirmation (quote remains on parent requisition). */
export async function loadSplitChildConfirmContext(
  quoteId: string,
  childRequisitionId: string
): Promise<SplitChildConfirmContext | null> {
  const allocation = await prisma.requisitionSplitAllocation.findFirst({
    where: {
      childRequisitionId,
      vendorQuoteId: quoteId,
    },
    include: {
      allocationItems: true,
      vendorQuote: { include: { vendor: true, quotedItems: true } },
      parentRequisition: {
        include: {
          items: { orderBy: { createdAt: 'asc' } },
          vessel: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  if (!allocation) return null;

  const childRequisition = (await prisma.requisition.findUnique({
    where: { id: childRequisitionId },
    include: {
      items: true,
      vessel: { select: { id: true, name: true, code: true } },
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  })) as ChildRequisition | null;

  if (!childRequisition) return null;

  const quote = allocation.vendorQuote as QuoteWithDetails;
  if (quote.status !== QuoteStatus.APPROVED) return null;

  const requisitionItemIds = allocation.allocationItems.map((ai) => ai.requisitionItemId);
  const { quoteForPo, effectiveTotalAmount } = buildSlicedQuote(
    quote,
    requisitionItemIds,
    allocation.parentRequisition.items
  );

  return {
    parentRequisitionId: allocation.parentRequisitionId,
    childRequisitionId,
    parentRequisition: allocation.parentRequisition as ParentRequisition,
    childRequisition,
    quote,
    quoteForPo,
    effectiveTotalAmount,
  };
}

/**
 * Resolve split PO context from quote id, optionally scoped to a child requisition.
 * When childRequisitionId is omitted, auto-detects via split allocation (notifications / direct links).
 */
export async function resolveSplitContextForQuoteConfirm(
  quoteId: string,
  childRequisitionId?: string | null
): Promise<SplitChildConfirmContext | null> {
  if (childRequisitionId) {
    return loadSplitChildConfirmContext(quoteId, childRequisitionId);
  }

  const allocation = await prisma.requisitionSplitAllocation.findFirst({
    where: { vendorQuoteId: quoteId },
    orderBy: { createdAt: 'asc' },
  });

  if (!allocation) return null;

  return loadSplitChildConfirmContext(quoteId, allocation.childRequisitionId);
}
