import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { returnInvoice } from '@/lib/services/invoice-approval.service';
import { markTaskNotificationsAsRead } from '@/lib/utils/mark-task-notifications-read';
import { prisma } from '@/lib/prisma';
import { getInvoiceApprovalLevels, buildApprovalLevelMap } from '@/lib/services/invoice-approval-config.service';
import { notifyInvoiceReturnedForCorrection } from '@/lib/procurement/approval-notifications';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/invoices/[id]/return - Return invoice with remarks
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { remarks } = body;

    if (!remarks || remarks.trim().length === 0) {
      return NextResponse.json(
        { error: 'Remarks are required when returning an invoice' },
        { status: 400 }
      );
    }

    const userAccessLevel = currentUser.designationAccessLevel || 0;

    const invoiceForConfig = await prisma.invoice.findUnique({
      where: { id },
      select: {
        requisition: {
          select: {
            vesselId: true,
            vessel: { select: { companyId: true } },
          },
        },
      },
    });
    const companyId = invoiceForConfig?.requisition?.vessel?.companyId ?? null;
    const vesselId = invoiceForConfig?.requisition?.vesselId ?? null;
    const levels = await getInvoiceApprovalLevels(companyId, vesselId);
    const approvalLevelMap = buildApprovalLevelMap(levels);
    const validLevels = [
      ...levels.level2AccessLevels,
      ...levels.level3AccessLevels,
      ...levels.level4AccessLevels,
    ];
    if (!validLevels.includes(userAccessLevel)) {
      return NextResponse.json(
        {
          error: 'Insufficient permissions',
          userAccessLevel,
          requiredLevels: validLevels,
        },
        { status: 403 }
      );
    }

    const result = await returnInvoice(
      id,
      currentUser.id,
      userAccessLevel,
      remarks.trim(),
      approvalLevelMap
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to return invoice' },
        { status: 400 }
      );
    }

    if (result.newStatus) {
      try {
        const invoice = await prisma.invoice.findUnique({
          where: { id },
          include: {
            requisition: {
              include: {
                vessel: { select: { id: true, companyId: true } },
              },
            },
            purchaseOrder: { select: { poNumber: true } },
          },
        });

        if (invoice) {
          const companyId = invoice.requisition?.vessel?.companyId ?? null;
          const vesselId = invoice.requisition?.vesselId ?? null;
          const levels = await getInvoiceApprovalLevels(companyId, vesselId);

          await notifyInvoiceReturnedForCorrection({
            request,
            actorUserId: currentUser.id,
            vesselId,
            companyId,
            requisitionNumber: invoice.requisition?.requisitionNumber,
            purchaseOrderNumber: invoice.purchaseOrder?.poNumber,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            newStatus: result.newStatus,
            returnRemarks: remarks.trim(),
            approvalLevels: levels,
          });
        }
      } catch (notifyErr) {
        console.error('Invoice return notification failed:', notifyErr);
      }
    }

    await markTaskNotificationsAsRead(currentUser.id, id);
    return NextResponse.json({
      success: true,
      message: 'Invoice returned successfully. Email sent to vendor.',
    });
  } catch (error: any) {
    console.error('Error returning invoice:', error);
    return NextResponse.json(
      { error: 'Failed to return invoice', details: error.message },
      { status: 500 }
    );
  }
}
