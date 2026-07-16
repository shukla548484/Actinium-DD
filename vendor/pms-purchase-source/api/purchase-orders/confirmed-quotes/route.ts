import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { RequisitionStatus } from '@/lib/types/requisition';
import { canIssuePurchaseOrders, PURCHASER_PO_ACCESS_LEVELS } from '@/lib/procurement/purchaser-access';
import { computeSplitAllocationTotal } from '@/lib/procurement/split-quote-slice';
import { resolveQuotePoDeepLink } from '@/lib/procurement/resolve-quote-po-deep-link';
import { resolvePoApprovalRequirement } from '@/lib/procurement/po-approval-requirement';
import {
  activePurchaseOrderWhere,
  quoteHasBlockingPurchaseOrder,
} from '@/lib/procurement/po-record-lookup';

/**
 * GET /api/purchase-orders/confirmed-quotes
 * Quotes / split groups awaiting PO issuance by purchaser (32/33).
 * - Single: requisition QUOTE_APPROVED + approved quote without PO
 * - Split: parent SPLIT — returned as one row per parent requisition
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userAccessLevel = currentUser.designationAccessLevel || 0;
    if (!canIssuePurchaseOrders(userAccessLevel)) {
      return NextResponse.json(
        {
          error: 'Insufficient permissions',
          userAccessLevel,
          requiredLevels: [...PURCHASER_PO_ACCESS_LEVELS],
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const vesselId = searchParams.get('vesselId');
    const quoteIdParam = searchParams.get('quoteId')?.trim() || null;
    const childRequisitionIdParam = searchParams.get('childRequisitionId')?.trim() || null;
    const revision = searchParams.get('revision') === '1';

    if (quoteIdParam) {
      const resolved = await resolveQuotePoDeepLink(
        quoteIdParam,
        childRequisitionIdParam,
        { revision }
      );
      return NextResponse.json({
        success: true,
        pendingItems: resolved.pendingItems,
        splitGroups: resolved.pendingItems.filter(
          (item) => (item as { kind?: string }).kind === 'split'
        ),
        confirmedQuotes: resolved.pendingItems.filter(
          (item) => (item as { kind?: string }).kind === 'single'
        ),
        count: resolved.pendingItems.length,
        deepLink: resolved.deepLink,
      });
    }

    const vesselFilter = vesselId ? { vesselId } : {};

    // —— Single-vendor: QUOTE_APPROVED requisitions ——
    const singleRequisitions = await prisma.requisition.findMany({
      where: {
        ...vesselFilter,
        parentRequisitionId: null,
        status: RequisitionStatus.QUOTE_APPROVED,
        vendorQuotes: {
          some: { status: 'APPROVED' },
        },
      },
      take: 100,
      orderBy: { dateOfCreation: 'desc' },
      include: {
        vessel: {
          select: { id: true, name: true, code: true, imoNumber: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        vendorQuotes: {
          where: { status: 'APPROVED' },
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
            quotedItems: { orderBy: { itemName: 'asc' } },
          },
        },
        purchaseOrders: { select: { id: true, quoteId: true, status: true } },
      },
    });

    const singleItems = (
      await Promise.all(
        singleRequisitions.flatMap((req) =>
          req.vendorQuotes.map(async (quote) => {
            const hasPo = quoteHasBlockingPurchaseOrder(req.purchaseOrders, quote.id);
            if (hasPo) return null;
            const poCheck = await prisma.purchaseOrder.findFirst({
              where: activePurchaseOrderWhere(quote.id, req.id),
              select: { id: true },
            });
            if (poCheck) return null;

            const approval = await resolvePoApprovalRequirement(
              null,
              req.vesselId,
              quote.totalAmount ? Number(quote.totalAmount) : 0
            );

            return {
              kind: 'single' as const,
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
                  unitPrice: it.unitPrice ? Number(it.unitPrice) : null,
                  totalPrice: it.totalPrice ? Number(it.totalPrice) : null,
                })),
              },
            };
          })
        )
      )
    ).filter(Boolean);

    // —— Split: parent SPLIT — one row per parent ——
    const splitParents = await prisma.requisition.findMany({
      where: {
        ...vesselFilter,
        parentRequisitionId: null,
        status: RequisitionStatus.SPLIT,
      },
      take: 100,
      orderBy: { updatedAt: 'desc' },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        vessel: {
          select: { id: true, name: true, code: true, imoNumber: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        splitAllocationsAsParent: {
          include: {
            allocationItems: {
              select: { requisitionItemId: true },
            },
            childRequisition: {
              select: {
                id: true,
                requisitionNumber: true,
                status: true,
              },
            },
            vendorQuote: {
              include: {
                vendor: {
                  select: {
                    id: true,
                    name: true,
                    primaryEmail: true,
                  },
                },
                quotedItems: { orderBy: { itemName: 'asc' } },
              },
            },
          },
        },
      },
    });

    const splitGroups = (
      await Promise.all(
        splitParents.map(async (parent) => {
          const children = await Promise.all(
            parent.splitAllocationsAsParent.map(async (alloc) => {
              const existingPo = await prisma.purchaseOrder.findFirst({
                where: {
                  quoteId: alloc.vendorQuoteId,
                  requisitionId: alloc.childRequisitionId,
                },
                select: { id: true, poNumber: true, workflowStatus: true },
              });
              const quote = alloc.vendorQuote;
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
                  additionalCharges: quote.additionalCharges != null ? Number(quote.additionalCharges) : null,
                  deliveryCharges: quote.deliveryCharges != null ? Number(quote.deliveryCharges) : null,
                },
                allocatedParentItemIds,
                parentItemRefs
              );
              return {
                childRequisitionId: alloc.childRequisitionId,
                childRequisitionNumber: alloc.childRequisition.requisitionNumber,
                childStatus: alloc.childRequisition.status,
                quoteId: alloc.vendorQuoteId,
                vendorId: alloc.vendorId,
                vendorName: quote.vendor.name,
                vendorEmail: quote.vendor.primaryEmail,
                totalAmount: allocationTotal,
                currency: quote.currency,
                poIssued: !!existingPo,
                poId: existingPo?.id ?? null,
                poNumber: existingPo?.poNumber ?? null,
                poWorkflowStatus: existingPo?.workflowStatus ?? null,
                poSentToVendor:
                  alloc.childRequisition.status === RequisitionStatus.QUOTE_CONFIRMED_PO_SENT,
                allocatedParentItemIds,
                quotedItems: quote.quotedItems.map((it) => ({
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
          if (pendingPoCount === 0) return null;

          const totalAmount = children
            .filter((c) => !c.poIssued)
            .reduce((sum, c) => sum + (c.totalAmount ?? 0), 0);
          const currency = children[0]?.currency ?? 'USD';

          return {
            kind: 'split' as const,
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
            totalAmount,
            currency,
            children,
          };
        })
      )
    ).filter(Boolean);

    const pendingItems = [...singleItems, ...splitGroups];

    // Backward-compatible flat list (single quotes only — used by DN status hook)
    const confirmedQuotes = singleItems;

    return NextResponse.json({
      success: true,
      pendingItems,
      splitGroups,
      confirmedQuotes,
      count: pendingItems.length,
    });
  } catch (error: unknown) {
    console.error('Error fetching pending PO quotes:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch quotes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
