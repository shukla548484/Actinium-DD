import "server-only";

import { prisma } from "@/lib/prisma";
import { RequisitionStatus } from "@/lib/types/requisition";
import { computeSplitAllocationTotal } from "@/lib/procurement/split-quote-slice";
import { quoteSendPoPath } from "@/lib/procurement/quote-po-navigation";
import { resolvePoApprovalRequirement } from "@/lib/procurement/po-approval-requirement";
import { activePurchaseOrderWhere } from "@/lib/procurement/po-record-lookup";
import { PurchaseOrderWorkflowStatus } from "@/lib/types/purchase-order-workflow";

export type QuotePoDeepLinkResult = {
  pendingItems: unknown[];
  deepLink: {
    found: boolean;
    quoteId: string;
    vesselId?: string;
    poExists?: boolean;
    poId?: string;
    poNumber?: string;
    redirectPath?: string;
    reason?: string;
  };
};

async function buildSinglePendingItem(
  req: Awaited<ReturnType<typeof loadQuoteForDeepLink>>["requisition"],
  quote: NonNullable<Awaited<ReturnType<typeof loadQuoteForDeepLink>>>,
  options?: { allowDespiteActivePo?: boolean }
) {
  if (!req) return null;

  const existingPo = await prisma.purchaseOrder.findFirst({
    where: activePurchaseOrderWhere(quote.id, req.id),
    select: { id: true, poNumber: true },
  });
  if (existingPo && !options?.allowDespiteActivePo) return null;

  const approval = await resolvePoApprovalRequirement(
    null,
    req.vessel?.id ?? null,
    quote.totalAmount ? Number(quote.totalAmount) : 0
  );

  return {
    kind: "single" as const,
    quoteId: quote.id,
    requisitionId: req.id,
    requisitionNumber: req.requisitionNumber,
    manualReqNumber: req.manualReqNumber,
    heading: req.heading,
    description: req.description,
    portOfSupply: req.portOfSupply,
    requisitionType: req.requisitionType,
    vessel: req.vessel,
    createdBy: req.createdBy,
    requiresApproval: approval.requiresApproval,
    requiresThreeApprovals: approval.requiresThreeApprovals,
    quote: {
      id: quote.id,
      totalAmount: quote.totalAmount ? Number(quote.totalAmount) : null,
      currency: quote.currency,
      validUntil: quote.validUntil,
      receivedAt: quote.receivedAt,
      vendor: quote.vendor,
      quotedItems: quote.quotedItems.map((it) => ({
        ...it,
        quantity: Number(it.quantity),
        unitPrice: it.unitPrice ? Number(it.unitPrice) : null,
        totalPrice: it.totalPrice ? Number(it.totalPrice) : null,
      })),
    },
  };
}

async function loadQuoteForDeepLink(quoteId: string) {
  return prisma.vendorQuote.findUnique({
    where: { id: quoteId },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          primaryEmail: true,
          secondaryEmail: true,
          contactPerson: true,
          phone: true,
          address: true,
        },
      },
      quotedItems: { orderBy: { itemName: "asc" } },
      requisition: {
        include: {
          vessel: { select: { id: true, name: true, code: true, imoNumber: true } },
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          items: { orderBy: { createdAt: "asc" } },
          parentRequisition: {
            include: {
              vessel: { select: { id: true, name: true, code: true, imoNumber: true } },
              createdBy: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
              items: { orderBy: { createdAt: "asc" } },
              splitAllocationsAsParent: {
                where: { vendorQuoteId: quoteId },
                include: {
                  allocationItems: { select: { requisitionItemId: true } },
                  childRequisition: {
                    select: { id: true, requisitionNumber: true, status: true },
                  },
                  vendorQuote: {
                    include: {
                      vendor: { select: { id: true, name: true, primaryEmail: true } },
                      quotedItems: { orderBy: { itemName: "asc" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

function poIsReadyForSendWorkflow(workflowStatus: string | null | undefined): boolean {
  const workflow = workflowStatus ?? PurchaseOrderWorkflowStatus.PO_CREATED;
  return (
    workflow === PurchaseOrderWorkflowStatus.PO_CONFIRMED ||
    workflow === PurchaseOrderWorkflowStatus.PO_SENT
  );
}

export async function resolveQuotePoDeepLink(
  quoteId: string,
  childRequisitionId?: string | null,
  options?: { revision?: boolean }
): Promise<QuotePoDeepLinkResult> {
  const quote = await loadQuoteForDeepLink(quoteId);
  if (!quote) {
    return {
      pendingItems: [],
      deepLink: { found: false, quoteId, reason: "quote_not_found" },
    };
  }

  const poWhere = childRequisitionId
    ? { quoteId, requisitionId: childRequisitionId }
    : { quoteId, status: "ACTIVE" as const };

  const existingPo = await prisma.purchaseOrder.findFirst({
    where: poWhere,
    select: { id: true, poNumber: true, workflowStatus: true },
  });

  if (existingPo) {
    const revisionMode = options?.revision === true;
    const readyToSend = poIsReadyForSendWorkflow(existingPo.workflowStatus);

    if (revisionMode && !readyToSend) {
      const req = quote.requisition;
      if (req) {
        const singleItem = await buildSinglePendingItem(req, quote, {
          allowDespiteActivePo: true,
        });
        if (singleItem) {
          return {
            pendingItems: [singleItem],
            deepLink: {
              found: true,
              quoteId,
              vesselId: req.vessel?.id,
              poExists: true,
              poId: existingPo.id,
              poNumber: existingPo.poNumber ?? undefined,
            },
          };
        }
      }
    }

    if (readyToSend || !revisionMode) {
      return {
        pendingItems: [],
        deepLink: {
          found: true,
          quoteId,
          poExists: true,
          poId: existingPo.id,
          poNumber: existingPo.poNumber ?? undefined,
          redirectPath: quoteSendPoPath(quoteId, {
            from: "notification",
            childRequisitionId,
          }),
        },
      };
    }
  }

  const req = quote.requisition;
  if (!req) {
    return {
      pendingItems: [],
      deepLink: { found: false, quoteId, reason: "requisition_not_found" },
    };
  }

  if (req.parentRequisitionId && req.parentRequisition?.splitAllocationsAsParent?.length) {
    const parent = req.parentRequisition;
    const alloc = parent.splitAllocationsAsParent[0];
    const allocatedParentItemIds = alloc.allocationItems.map((ai) => ai.requisitionItemId);
    const parentItemRefs = parent.items.map((i) => ({
      id: i.id,
      itemName: i.itemName,
      quantity: Number(i.quantity),
      unit: i.unit,
    }));
    const allocationTotal = computeSplitAllocationTotal(
      {
        quotedItems: quote.quotedItems.map((it) => ({
          id: it.id,
          requisitionItemId: it.requisitionItemId,
          itemName: it.itemName,
          quantity: it.quantity != null ? Number(it.quantity) : null,
          unit: it.unit,
          unitPrice: it.unitPrice != null ? Number(it.unitPrice) : null,
          totalPrice: it.totalPrice != null ? Number(it.totalPrice) : null,
        })),
        additionalCharges:
          quote.additionalCharges != null ? Number(quote.additionalCharges) : null,
        deliveryCharges: quote.deliveryCharges != null ? Number(quote.deliveryCharges) : null,
      },
      allocatedParentItemIds,
      parentItemRefs
    );

    const children = await Promise.all(
      parent.splitAllocationsAsParent.map(async (row) => {
        const childPo = await prisma.purchaseOrder.findFirst({
          where: { quoteId: row.vendorQuoteId, requisitionId: row.childRequisitionId },
          select: { id: true, poNumber: true },
        });
        const q = row.vendorQuote;
        const ids = row.allocationItems.map((ai) => ai.requisitionItemId);
        const total = computeSplitAllocationTotal(
          {
            quotedItems: q.quotedItems.map((it) => ({
              id: it.id,
              requisitionItemId: it.requisitionItemId,
              itemName: it.itemName,
              quantity: it.quantity != null ? Number(it.quantity) : null,
              unit: it.unit,
              unitPrice: it.unitPrice != null ? Number(it.unitPrice) : null,
              totalPrice: it.totalPrice != null ? Number(it.totalPrice) : null,
            })),
            additionalCharges: q.additionalCharges != null ? Number(q.additionalCharges) : null,
            deliveryCharges: q.deliveryCharges != null ? Number(q.deliveryCharges) : null,
          },
          ids,
          parentItemRefs
        );
        return {
          childRequisitionId: row.childRequisitionId,
          childRequisitionNumber: row.childRequisition.requisitionNumber,
          childStatus: row.childRequisition.status,
          quoteId: row.vendorQuoteId,
          vendorId: row.vendorId,
          vendorName: q.vendor.name,
          vendorEmail: q.vendor.primaryEmail,
          totalAmount: total,
          currency: q.currency,
          poIssued: !!childPo,
          poId: childPo?.id ?? null,
          poNumber: childPo?.poNumber ?? null,
          quotedItems: q.quotedItems.map((it) => ({
            id: it.id,
            itemName: it.itemName,
            quantity: Number(it.quantity),
            unit: it.unit,
            unitPrice: it.unitPrice ? Number(it.unitPrice) : null,
            totalPrice: it.totalPrice ? Number(it.totalPrice) : null,
          })),
        };
      })
    );

    const pendingPoCount = children.filter((c) => !c.poIssued).length;
    if (pendingPoCount === 0) {
      return {
        pendingItems: [],
        deepLink: {
          found: true,
          quoteId,
          poExists: true,
          redirectPath: quoteSendPoPath(quoteId, {
            from: "notification",
            childRequisitionId: childRequisitionId ?? req.id,
          }),
        },
      };
    }

    const splitItem = {
      kind: "split" as const,
      parentRequisitionId: parent.id,
      parentRequisitionNumber: parent.requisitionNumber,
      manualReqNumber: parent.manualReqNumber,
      heading: parent.heading,
      description: parent.description,
      portOfSupply: parent.portOfSupply,
      requisitionType: parent.requisitionType,
      vessel: parent.vessel,
      createdBy: parent.createdBy,
      vendorCount: children.length,
      pendingPoCount,
      issuedPoCount: children.length - pendingPoCount,
      totalAmount: children.filter((c) => !c.poIssued).reduce((s, c) => s + (c.totalAmount ?? 0), 0),
      currency: children[0]?.currency ?? quote.currency,
      children,
    };

    return {
      pendingItems: [splitItem],
      deepLink: {
        found: true,
        quoteId,
        vesselId: parent.vessel?.id,
      },
    };
  }

  if (req.status !== RequisitionStatus.QUOTE_APPROVED && quote.status !== "APPROVED") {
    return {
      pendingItems: [],
      deepLink: { found: false, quoteId, reason: "quote_not_awaiting_po" },
    };
  }

  const singleItem = await buildSinglePendingItem(req, quote, {
    allowDespiteActivePo: options?.revision === true,
  });
  if (!singleItem) {
    const activePo = await prisma.purchaseOrder.findFirst({
      where: { quoteId, status: "ACTIVE" },
      select: { id: true, poNumber: true, workflowStatus: true },
    });
    if (activePo) {
      const revisionMode = options?.revision === true;
      const readyToSend = poIsReadyForSendWorkflow(activePo.workflowStatus);
      if (!revisionMode || readyToSend) {
        return {
          pendingItems: [],
          deepLink: {
            found: true,
            quoteId,
            poExists: true,
            poId: activePo.id,
            poNumber: activePo.poNumber ?? undefined,
            redirectPath: quoteSendPoPath(quoteId, { from: "notification" }),
          },
        };
      }
    }
  }

  return {
    pendingItems: [singleItem],
    deepLink: {
      found: true,
      quoteId,
      vesselId: req.vessel?.id,
    },
  };
}
