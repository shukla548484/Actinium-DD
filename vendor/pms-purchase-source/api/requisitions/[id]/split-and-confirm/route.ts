import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { isAdminEquivalentAccessLevel } from '@/lib/admin-access-level';
import { RequisitionStatus } from '@/lib/types/requisition';
import { recordPurchaseHistory, PurchaseHistoryActionType } from '@/lib/services/purchase-history.service';
import {
  createSplitChildPurchaseOrder,
  type SplitPoEmailOptions,
} from '@/lib/procurement/issue-split-child-po';

export const maxDuration = 60;

/**
 * POST /api/requisitions/[id]/split-and-confirm
 * Create PO records for an already split requisition (one PO per child requisition / vendor).
 * POs are submitted for tier approval when required — they are not emailed to vendors from here.
 * Requires purchaser access level 32 or 33. Split approval must be done first via split-and-approve.
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
    const allowedLevels = [32, 33];
    if (!allowedLevels.includes(userAccessLevel) && !isAdminEquivalentAccessLevel(userAccessLevel)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create split POs. Required: purchaser access level 32 or 33.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const emailOptions: SplitPoEmailOptions = {
      ccEmails: body.ccEmails,
      includeUserEmailInCc: body.includeUserEmailInCc !== false,
      userRemarks: body.userRemarks,
      vendorRemarks: body.vendorRemarks,
      conditions: body.conditions,
      leadTime: body.leadTime,
      portOfDelivery: body.portOfDelivery,
      agentDetails: body.agentDetails,
      senderEmail: currentUser.email,
      senderName: [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ') || undefined,
    };

    errorStep = 'Fetch parent requisition';
    const parent = await prisma.requisition.findUnique({
      where: { id: parentRequisitionId },
      select: { id: true, status: true, requisitionNumber: true },
    });

    if (!parent) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    if (parent.status !== RequisitionStatus.SPLIT) {
      return NextResponse.json(
        {
          error:
            'Requisition must be split and approved before POs can be created. Use split-and-approve on Bid Comparison first.',
        },
        { status: 400 }
      );
    }

    errorStep = 'Load existing split allocations';
    const existingSplitAllocations = await prisma.requisitionSplitAllocation.findMany({
      where: { parentRequisitionId: parent.id },
      include: { childRequisition: true },
    });

    if (existingSplitAllocations.length === 0) {
      return NextResponse.json(
        {
          error:
            'Requisition is marked as split but no split allocations were found. Please contact support.',
        },
        { status: 400 }
      );
    }

    errorStep = 'Create split PO records';
    const purchaseOrders: Array<{ id: string; poNumber: string }> = [];
    let createdCount = 0;
    let approvalCount = 0;

    for (const alloc of existingSplitAllocations) {
      const created = await createSplitChildPurchaseOrder({
        parentRequisitionId: parent.id,
        quoteId: alloc.vendorQuoteId,
        childRequisitionId: alloc.childRequisitionId,
        performedById: currentUser.id,
        emailOptions,
        request,
        ifExists: 'skip',
      });

      if (!purchaseOrders.some((p) => p.id === created.purchaseOrder.id)) {
        purchaseOrders.push(created.purchaseOrder);
      }
      if (!created.skipped) {
        createdCount += 1;
        if (created.requiresApproval) approvalCount += 1;
      }
    }

    const childRequisitions = existingSplitAllocations.map((sa) => ({
      id: sa.childRequisitionId,
      requisitionNumber: sa.childRequisition.requisitionNumber,
    }));

    try {
      await recordPurchaseHistory({
        requisitionId: parent.id,
        actionType: PurchaseHistoryActionType.STATUS_CHANGED,
        performedById: currentUser.id,
        actionDescription: `PO records created for split requisition across ${existingSplitAllocations.length} vendor(s). Child requisitions: ${childRequisitions.map((c) => c.requisitionNumber).join(', ')}`,
        previousStatus: parent.status,
        newStatus: RequisitionStatus.SPLIT,
        newValue: { childRequisitions, purchaseOrders },
      });
    } catch {
      /* non-critical */
    }

    const message =
      createdCount === 0
        ? 'All POs for this split requisition have already been created.'
        : approvalCount > 0
          ? `Created ${createdCount} PO(s) — ${approvalCount} submitted for tier approval.`
          : `Created ${createdCount} PO(s) — ready to send to vendor after review.`;

    return NextResponse.json({
      success: true,
      message,
      childRequisitions,
      purchaseOrders,
    });
  } catch (error: unknown) {
    console.error('[split-and-confirm]', errorStep, error);

    const message = error instanceof Error ? error.message : 'Failed to create split POs';
    const hint =
      message.includes('parent_requisition_id') || message.includes('P2022')
        ? ' Database may be missing the split migration (20260225000000_requisition_split_multi_vendor).'
        : '';

    return NextResponse.json(
      { error: message + hint, step: errorStep },
      { status: 500 }
    );
  }
}
