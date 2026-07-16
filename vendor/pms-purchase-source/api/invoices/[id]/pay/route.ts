import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { recordInvoiceHistory, InvoiceHistoryActionType } from '@/lib/services/invoice-history.service';
import { updatePOStatusOnInvoicePayment } from '@/lib/services/po-completion.service';
import { logActivityFromRequestWithNotification } from '@/lib/utils/enhanced-activity-logger';
import { postPaymentToGl } from '@/lib/services/gl-auto-post.service';
import { INVOICE_READY_FOR_ACCOUNTS_PAYMENT_STATUSES } from '@/lib/accounts/invoice-accounts-status';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/invoices/[id]/pay - Mark invoice as paid
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { paymentReference, paidAmount } = body;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const payableStatuses = new Set<string>(INVOICE_READY_FOR_ACCOUNTS_PAYMENT_STATUSES);
    if (!payableStatuses.has(invoice.status)) {
      return NextResponse.json(
        {
          error: 'Invoice must be ready for payment (all 4 levels approved) before payment',
          currentStatus: invoice.status,
        },
        { status: 400 }
      );
    }

    // Check if already paid
    if (invoice.status === 'PAID') {
      return NextResponse.json(
        { error: 'Invoice is already marked as paid' },
        { status: 400 }
      );
    }

    const previousStatus = invoice.status;
    const paidAmountValue = paidAmount ? Number(paidAmount) : Number(invoice.invoiceAmount);

    // Update invoice to paid
    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paidBy: currentUser.id,
        paymentReference: paymentReference || null,
        paidAmount: paidAmountValue,
      },
      include: {
        purchaseOrder: true,
      },
    });

    // Record history
    await recordInvoiceHistory({
      invoiceId: id,
      actionType: InvoiceHistoryActionType.PAID,
      performedById: currentUser.id,
      actionDescription: `Invoice marked as paid${paymentReference ? ` - Reference: ${paymentReference}` : ''}`,
      previousStatus,
      newStatus: 'PAID',
      newValue: {
        paidAmount: paidAmountValue,
        paymentReference: paymentReference || null,
        paidAt: new Date().toISOString(),
      },
    });

    // Update PO completion status if PO exists
    if (invoice.purchaseOrderId) {
      await updatePOStatusOnInvoicePayment(id, paidAmountValue, currentUser.id);
    }

    // Auto-post payment to GL and create invoice_payments record
    try {
      await postPaymentToGl(
        id,
        currentUser.id,
        paidAmountValue,
        invoice.currency || 'USD',
        new Date(),
        paymentReference || null
      );
    } catch (glErr: any) {
      console.error('GL auto-post on payment failed:', glErr);
    }

    // Log activity
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.actinium-sm.org";
      await logActivityFromRequestWithNotification(
        request,
        currentUser.id,
        "PAY_INVOICE",
        `Recorded payment for invoice ${invoice.invoiceNumber}`,
        {
          module: "Accounts",
          page: "/accounts/pending-invoices",
          requisitionNumber: invoice.requisition?.requisitionNumber,
          purchaseOrderNumber: invoice.purchaseOrder?.poNumber,
          vesselId: invoice.requisition?.vesselId,
          metadata: {
            invoiceNumber: invoice.invoiceNumber,
            paidAmount: paidAmountValue,
            paymentReference,
            currency: invoice.currency,
          },
          createNotification: false, // Payment is final, no follow-up needed
        }
      );
    } catch (activityError: any) {
      console.error('Error logging activity:', activityError);
    }

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice,
      message: 'Invoice marked as paid successfully',
    });
  } catch (error: any) {
    console.error('Error marking invoice as paid:', error);
    return NextResponse.json(
      { error: 'Failed to mark invoice as paid', details: error.message },
      { status: 500 }
    );
  }
}

