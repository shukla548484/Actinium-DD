import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { approveInvoice } from '@/lib/services/invoice-approval.service';
import { markTaskNotificationsAsRead } from '@/lib/utils/mark-task-notifications-read';
import { prisma } from '@/lib/prisma';
import { getInvoiceApprovalLevels, buildApprovalLevelMap } from '@/lib/services/invoice-approval-config.service';
import { postInvoiceApprovalToGl } from '@/lib/services/gl-auto-post.service';
import { isAdminEquivalentAccessLevel } from '@/lib/admin-access-level';
import { isPurchaseOrderInvoiceBasedContract } from '@/lib/services/contract-invoice-po.service';
import {
  canApproveContractBasedInvoice,
  CONTRACT_INVOICE_APPROVAL_MIN_ACCESS,
} from '@/lib/contract-invoice-based';
import {
  notifyInvoiceApprovalPending,
  notifyInvoiceReadyForPayment,
  resolveNextInvoiceApproverLevels,
  invoicePendingLevelNumber,
} from '@/lib/procurement/approval-notifications';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/invoices/[id]/approve - Approve invoice at user's level (configurable by company/vessel)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const userAccessLevel = currentUser.designationAccessLevel || 0;

    const invoiceForConfig = await prisma.invoice.findUnique({
      where: { id },
      select: {
        purchaseOrderId: true,
        requisition: {
          select: {
            vesselId: true,
            vessel: { select: { companyId: true } },
          },
        },
      },
    });

    const isContractInvoice =
      invoiceForConfig?.purchaseOrderId != null &&
      (await isPurchaseOrderInvoiceBasedContract(invoiceForConfig.purchaseOrderId));

    let approvalLevelMap: ReturnType<typeof buildApprovalLevelMap> | undefined;

    if (isContractInvoice) {
      if (!canApproveContractBasedInvoice(userAccessLevel)) {
        return NextResponse.json(
          {
            error: 'Insufficient permissions',
            userAccessLevel,
            requiredMinAccess: CONTRACT_INVOICE_APPROVAL_MIN_ACCESS,
            message:
              'Invoice-based contract invoices require access level 37 or higher',
          },
          { status: 403 }
        );
      }
    } else {
      const companyId = invoiceForConfig?.requisition?.vessel?.companyId ?? null;
      const vesselId = invoiceForConfig?.requisition?.vesselId ?? null;
      const levels = await getInvoiceApprovalLevels(companyId, vesselId);
      approvalLevelMap = buildApprovalLevelMap(levels);
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
    }

    const result = await approveInvoice(
      id,
      currentUser.id,
      userAccessLevel,
      approvalLevelMap
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to approve invoice' },
        { status: 400 }
      );
    }

    // Auto-post to GL when invoice reaches READY_FOR_PAYMENT (all 4 levels approved)
    const invoiceAfterApprove = await prisma.invoice.findUnique({
      where: { id },
      select: { status: true },
    });
    if (invoiceAfterApprove?.status === 'READY_FOR_PAYMENT') {
      try {
        await postInvoiceApprovalToGl(id, currentUser.id);
      } catch (glErr: any) {
        console.error('GL auto-post after invoice approval failed:', glErr);
      }
    }

    // Notify next verifier or accounts when fully approved
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: {
          requisition: { include: { vessel: { select: { companyId: true } } } },
          purchaseOrder: true,
        },
      });

      if (invoice && !isContractInvoice) {
        const companyId = invoice.requisition?.vessel?.companyId ?? null;
        const vesselId = invoice.requisition?.vesselId ?? null;
        const levels = await getInvoiceApprovalLevels(companyId, vesselId);

        const notifyCtx = {
          request,
          actorUserId: currentUser.id,
          vesselId,
          companyId,
          requisitionNumber: invoice.requisition?.requisitionNumber,
          purchaseOrderNumber: invoice.purchaseOrder?.poNumber,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
        };

        if (invoice.status === "READY_FOR_PAYMENT") {
          await notifyInvoiceReadyForPayment(notifyCtx);
        } else {
          const nextLevels = resolveNextInvoiceApproverLevels(levels, invoice.status);
          const levelNum = invoicePendingLevelNumber(invoice.status);
          if (nextLevels?.length && levelNum) {
            await notifyInvoiceApprovalPending({
              ...notifyCtx,
              approvalLevel: levelNum,
              targetAccessLevels: nextLevels,
            });
          }
        }
      } else if (invoice?.status === "READY_FOR_PAYMENT" && isContractInvoice) {
        await notifyInvoiceReadyForPayment({
          request,
          actorUserId: currentUser.id,
          vesselId: invoice.requisition?.vesselId,
          companyId: invoice.requisition?.vessel?.companyId,
          requisitionNumber: invoice.requisition?.requisitionNumber,
          purchaseOrderNumber: invoice.purchaseOrder?.poNumber,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
        });
      }

      if (invoice) {
        await markTaskNotificationsAsRead(currentUser.id, id);
        if (invoice.invoiceNumber) {
          await markTaskNotificationsAsRead(currentUser.id, invoice.invoiceNumber);
        }
      }
    } catch (activityError: unknown) {
      console.error('Error sending invoice approval notification:', activityError);
    }

    return NextResponse.json({
      success: true,
      message: 'Invoice approved successfully',
    });
  } catch (error: any) {
    console.error('Error approving invoice:', error);
    return NextResponse.json(
      { error: 'Failed to approve invoice', details: error.message },
      { status: 500 }
    );
  }
}












