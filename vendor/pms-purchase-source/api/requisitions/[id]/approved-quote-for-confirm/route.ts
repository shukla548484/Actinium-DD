import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { isAdminEquivalentAccessLevel } from '@/lib/admin-access-level';
import { resolveApprovedQuoteForConfirm } from '@/lib/procurement/split-child-confirm-context';

/**
 * GET /api/requisitions/[id]/approved-quote-for-confirm
 * Resolve the approved vendor quote for PO confirmation (including split child requisitions).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userAccessLevel = currentUser.designationAccessLevel || 0;
    const allowedLevels = [32, 33, 50, 99, 100];
    if (!allowedLevels.includes(userAccessLevel) && !isAdminEquivalentAccessLevel(userAccessLevel)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id: requisitionId } = await context.params;
    const resolved = await resolveApprovedQuoteForConfirm(requisitionId);

    if (!resolved) {
      return NextResponse.json(
        { error: 'No approved quote found for this requisition' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, ...resolved });
  } catch (error) {
    console.error('[approved-quote-for-confirm]', error);
    return NextResponse.json(
      { error: 'Failed to resolve approved quote' },
      { status: 500 }
    );
  }
}
