import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { QuoteStatus } from '@prisma/client';
import { RequisitionStatus } from '@/lib/types/requisition';
import { recordPurchaseHistory, PurchaseHistoryActionType } from '@/lib/services/purchase-history.service';
import { logActivityFromRequestWithNotification } from '@/lib/utils/enhanced-activity-logger';
import { resolveTaskDedupeKey } from '@/lib/notifications/task-dedupe';
import { isAdminEquivalentAccessLevel } from '@/lib/admin-access-level';
import {
  applyConfirmedQuoteQuantities,
  parseConfirmedQuantities,
} from '@/lib/procurement/apply-confirmed-quote-quantities';

export const maxDuration = 60;

interface AllocationInput {
  vendorId: string;
  quoteId: string;
  requisitionItemIds: string[];
}

/**
 * POST /api/requisitions/[id]/split-and-approve
 * Split requisition across multiple vendors and approve each vendor's quote.
 * Does NOT create purchase orders or email vendors — purchasers (access 32/33) issue POs separately.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: parentRequisitionId } = await context.params;
  let errorStep = 'Initialization';

  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userAccessLevel = currentUser.designationAccessLevel || 0;
    const allowedLevels = [37, 39, 50, 99, 100];
    if (!allowedLevels.includes(userAccessLevel) && !isAdminEquivalentAccessLevel(userAccessLevel)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to split and approve quotes' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const allocations: AllocationInput[] = Array.isArray(body.allocations) ? body.allocations : [];
    if (allocations.length < 2) {
      return NextResponse.json(
        { error: 'At least two vendor allocations are required for a split' },
        { status: 400 }
      );
    }

    errorStep = 'Fetch parent requisition';
    const parent = await prisma.requisition.findUnique({
      where: { id: parentRequisitionId },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        vessel: true,
      },
    });

    if (!parent) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    const confirmedQuantities = parseConfirmedQuantities(
      body.confirmedQuantities,
      new Set(parent.items.map((i) => i.id))
    );
    const qtyByItemId = new Map(confirmedQuantities.map((row) => [row.requisitionItemId, row.quantity]));

    if (parent.parentRequisitionId) {
      return NextResponse.json(
        { error: 'Cannot split a child requisition' },
        { status: 400 }
      );
    }

    if (parent.status === RequisitionStatus.SPLIT) {
      return NextResponse.json(
        { error: 'Requisition has already been split and approved' },
        { status: 400 }
      );
    }

    const existingPO = await prisma.purchaseOrder.findFirst({
      where: {
        OR: [
          { requisitionId: parentRequisitionId },
          { parentRequisitionId: parentRequisitionId },
        ],
      },
    });
    if (existingPO) {
      return NextResponse.json(
        {
          error:
            'A purchase order already exists for this requisition. Split approval is only allowed before any PO is issued.',
        },
        { status: 400 }
      );
    }

    const allowedStatuses = [
      RequisitionStatus.SENT_FOR_QUOTE,
      RequisitionStatus.QUOTE_RECEIVED,
      RequisitionStatus.PARTIAL_QUOTE_RECEIVED,
    ];
    if (!allowedStatuses.includes(parent.status as RequisitionStatus)) {
      return NextResponse.json(
        {
          error: `Requisition must be in Sent for Quote or Quote Received status to split and approve. Current: ${parent.status}`,
        },
        { status: 400 }
      );
    }

    const parentItemIds = new Set(parent.items.map((i) => i.id));
    const assignedItemIds = new Set<string>();

    for (const a of allocations) {
      if (
        !a.quoteId ||
        !a.vendorId ||
        !Array.isArray(a.requisitionItemIds) ||
        a.requisitionItemIds.length === 0
      ) {
        return NextResponse.json(
          { error: 'Each allocation must have vendorId, quoteId, and non-empty requisitionItemIds' },
          { status: 400 }
        );
      }
      for (const reqItemId of a.requisitionItemIds) {
        if (!parentItemIds.has(reqItemId)) {
          return NextResponse.json(
            { error: `Requisition item ${reqItemId} does not belong to this requisition` },
            { status: 400 }
          );
        }
        if (assignedItemIds.has(reqItemId)) {
          return NextResponse.json(
            { error: 'Each requisition item can only be assigned to one vendor' },
            { status: 400 }
          );
        }
        assignedItemIds.add(reqItemId);
      }
    }

    const unassigned = parent.items.filter((i) => !assignedItemIds.has(i.id));
    if (unassigned.length > 0) {
      return NextResponse.json(
        { error: `All items must be assigned. Unassigned: ${unassigned.length} item(s)` },
        { status: 400 }
      );
    }

    errorStep = 'Fetch quotes and validate';
    const quotes = await prisma.vendorQuote.findMany({
      where: {
        id: { in: allocations.map((a) => a.quoteId) },
        requisitionId: parentRequisitionId,
        status: QuoteStatus.RECEIVED,
      },
      include: { vendor: true },
    });

    if (quotes.length !== allocations.length) {
      return NextResponse.json(
        {
          error:
            'One or more quotes not found or not in RECEIVED status for this requisition',
        },
        { status: 400 }
      );
    }

    const parentItemsById = new Map(parent.items.map((i) => [i.id, i]));
    const childRequisitions: Array<{ id: string; requisitionNumber: string; quoteId: string; vendorName: string }> =
      [];

    errorStep = 'Create child requisitions, approve quotes (transaction)';
    await prisma.$transaction(async (tx) => {
      let splitIndex = 0;
      for (const alloc of allocations) {
        splitIndex += 1;
        const letterSuffix = (() => {
          let n = splitIndex;
          let s = '';
          while (n > 0) {
            n--;
            s = String.fromCharCode(65 + (n % 26)) + s;
            n = Math.floor(n / 26);
          }
          return s;
        })();
        const childRequisitionNumber = `${parent.requisitionNumber}${letterSuffix}`;

        const quote = quotes.find((q) => q.id === alloc.quoteId)!;

        const childRequisition = await tx.requisition.create({
          data: {
            requisitionNumber: childRequisitionNumber,
            manualReqNumber: parent.manualReqNumber,
            heading: parent.heading,
            description: parent.description,
            portOfSupply: parent.portOfSupply,
            requisitionType: parent.requisitionType,
            generationStatus: parent.generationStatus,
            status: RequisitionStatus.QUOTE_APPROVED,
            portAgentDetails: parent.portAgentDetails,
            isEditable: false,
            createdById: parent.createdById,
            approvedById: parent.approvedById,
            approvedAt: parent.approvedAt,
            vesselId: parent.vesselId,
            contractId: parent.contractId,
            budgetCode: parent.budgetCode,
            glCode: parent.glCode,
            costCenter: parent.costCenter,
            linkedReason: parent.linkedReason,
            linkedReasonType: parent.linkedReasonType,
            linkedReasonId: parent.linkedReasonId,
            priority: parent.priority,
            reasonForRequisition: parent.reasonForRequisition,
            requisitionPurpose: parent.requisitionPurpose,
            isBudgeted: parent.isBudgeted,
            dryDockTaskId: parent.dryDockTaskId,
            parentRequisitionId: parent.id,
            splitIndex,
            items: {
              create: alloc.requisitionItemIds.map((reqItemId) => {
                const src = parentItemsById.get(reqItemId)!;
                return {
                  itemName: src.itemName,
                  description: src.description,
                  quantity: qtyByItemId.get(reqItemId) ?? src.quantity,
                  unit: src.unit,
                  urgency: src.urgency,
                  remarks: src.remarks,
                  impaNumber: src.impaNumber,
                  defectId: src.defectId,
                  addToInventory: src.addToInventory,
                  currentRob: src.currentRob,
                  drawingNumber: src.drawingNumber,
                  itemNumber: src.itemNumber,
                  machineryInstanceId: src.machineryInstanceId,
                  manualMachineryName: src.manualMachineryName,
                  oilGrade: src.oilGrade,
                  paintBrand: src.paintBrand,
                  paintCategory: src.paintCategory,
                  paintColorGrade: src.paintColorGrade,
                  paintColorHex: src.paintColorHex,
                  paintColorName: src.paintColorName,
                  paintProductName: src.paintProductName,
                  paintType: src.paintType,
                  partName: src.partName,
                  partNumber: src.partNumber,
                  sourceRequisitionItemId: src.id,
                };
              }),
            },
          },
          include: { items: true },
        });

        childRequisitions.push({
          id: childRequisition.id,
          requisitionNumber: childRequisition.requisitionNumber,
          quoteId: quote.id,
          vendorName: quote.vendor.name,
        });

        await tx.vendorQuote.update({
          where: { id: quote.id },
          data: { status: QuoteStatus.APPROVED },
        });

        if (confirmedQuantities.length > 0) {
          await applyConfirmedQuoteQuantities({
            quoteId: quote.id,
            confirmedQuantities,
            allocatedRequisitionItemIds: alloc.requisitionItemIds,
            tx,
          });
        }

        const allocationRecord = await tx.requisitionSplitAllocation.create({
          data: {
            parentRequisitionId: parent.id,
            childRequisitionId: childRequisition.id,
            vendorQuoteId: quote.id,
            vendorId: quote.vendorId,
            createdById: currentUser.id,
          },
        });

        const parentToChildItem = new Map<string, string>();
        childRequisition.items.forEach((childItem) => {
          if (childItem.sourceRequisitionItemId) {
            parentToChildItem.set(childItem.sourceRequisitionItemId, childItem.id);
          }
        });

        await tx.requisitionSplitAllocationItem.createMany({
          data: alloc.requisitionItemIds.map((reqItemId) => ({
            splitAllocationId: allocationRecord.id,
            requisitionItemId: reqItemId,
            childRequisitionItemId: parentToChildItem.get(reqItemId)!,
          })),
        });
      }

      await tx.requisition.update({
        where: { id: parent.id },
        data: { status: RequisitionStatus.SPLIT, isEditable: false },
      });
    });

    try {
      await recordPurchaseHistory({
        requisitionId: parent.id,
        actionType: PurchaseHistoryActionType.STATUS_CHANGED,
        performedById: currentUser.id,
        actionDescription: `Requisition split and quotes approved across ${allocations.length} vendor(s). Child requisitions: ${childRequisitions.map((c) => c.requisitionNumber).join(', ')}. PO issuance pending purchaser action.`,
        previousStatus: parent.status,
        newStatus: RequisitionStatus.SPLIT,
        newValue: { childRequisitions },
      });
    } catch (_) {}

    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.actinium-sm.org';
      await logActivityFromRequestWithNotification(
        request,
        currentUser.id,
        'APPROVE_SPLIT_QUOTES',
        `Split and approved quotes for ${parent.requisitionNumber} across ${allocations.length} vendors`,
        {
          module: 'Purchase',
          page: '/purchase/requisitions/[id]/quotes',
          requisitionNumber: parent.requisitionNumber,
          vesselId: parent.vesselId,
          metadata: {
            parentRequisitionId: parent.id,
            childRequisitions,
            dedupeKey: resolveTaskDedupeKey('APPROVE_SPLIT_QUOTES', {
              parentRequisitionId: parent.id,
            }),
          },
          createNotification: true,
          notificationType: 'TASK_ASSIGNED',
          actionUrl: `${baseUrl}/purchase/create-po`,
          targetAccessLevels: [32, 33, 50, 99, 100],
        }
      );
    } catch (activityError: unknown) {
      console.error('[split-and-approve] activity log failed:', activityError);
    }

    return NextResponse.json({
      success: true,
      message: `Split approved. ${childRequisitions.length} child requisition(s) created. Purchasers will issue POs separately.`,
      childRequisitions,
    });
  } catch (error: unknown) {
    console.error('[split-and-approve]', errorStep, error);
    const message = error instanceof Error ? error.message : 'Failed to split and approve';
    return NextResponse.json({ error: message, step: errorStep }, { status: 500 });
  }
}
