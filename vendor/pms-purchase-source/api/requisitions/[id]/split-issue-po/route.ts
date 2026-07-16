import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { isAdminEquivalentAccessLevel } from '@/lib/admin-access-level';
import {
  issueSplitChildPO,
  resendSplitChildPOEmail,
  type SplitPoEmailOptions,
} from '@/lib/procurement/issue-split-child-po';

export const maxDuration = 60;

/**
 * POST /api/requisitions/[id]/split-issue-po
 * Issue or resend PO email for a single split child requisition / vendor.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: parentRequisitionId } = await context.params;

  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userAccessLevel = currentUser.designationAccessLevel || 0;
    const allowedLevels = [32, 33];
    if (!allowedLevels.includes(userAccessLevel) && !isAdminEquivalentAccessLevel(userAccessLevel)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Required: purchaser access level 32 or 33.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const quoteId = typeof body.quoteId === 'string' ? body.quoteId.trim() : '';
    const childRequisitionId =
      typeof body.childRequisitionId === 'string' ? body.childRequisitionId.trim() : '';
    const resend = body.resend === true;

    if (!quoteId || !childRequisitionId) {
      return NextResponse.json(
        { error: 'quoteId and childRequisitionId are required' },
        { status: 400 }
      );
    }

    if (resend && !currentUser.email?.trim()) {
      return NextResponse.json(
        {
          error:
            'Your account must have an email address. PO emails always CC the sender.',
        },
        { status: 400 }
      );
    }

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

    const result = resend
      ? await resendSplitChildPOEmail({
          parentRequisitionId,
          quoteId,
          childRequisitionId,
          performedById: currentUser.id,
          emailOptions,
        })
      : await issueSplitChildPO({
          parentRequisitionId,
          quoteId,
          childRequisitionId,
          performedById: currentUser.id,
          emailOptions,
          request,
        });

    return NextResponse.json({
      success: true,
      message: resend
        ? `PO email resent to ${result.vendorEmail}`
        : result.requiresApproval
          ? `PO ${result.purchaseOrder.poNumber} created — submitted for tier approval`
          : `PO ${result.purchaseOrder.poNumber} created — ready to send to vendor`,
      ...result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to process split PO';
    console.error('[split-issue-po]', message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
