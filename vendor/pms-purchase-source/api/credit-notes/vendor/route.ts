import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';

/**
 * GET /api/credit-notes/vendor?vendorId=xxx&purchaseOrderId=xxx
 * Get credit notes for a specific vendor or purchase order
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get('vendorId');
    const purchaseOrderId = searchParams.get('purchaseOrderId');
    const invoiceId = searchParams.get('invoiceId');

    if (!vendorId && !purchaseOrderId && !invoiceId) {
      return NextResponse.json(
        { error: 'vendorId, purchaseOrderId, or invoiceId is required' },
        { status: 400 }
      );
    }

    const where: any = {};

    // If invoiceId provided, get vendor from invoice
    if (invoiceId) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          quote: {
            include: {
              vendor: true,
            },
          },
          purchaseOrder: true,
        },
      });

      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }

      if (invoice.purchaseOrderId) {
        where.purchaseOrderId = invoice.purchaseOrderId;
      } else if (invoice.quote?.vendorId) {
        where.purchaseOrder = {
          quote: {
            vendorId: invoice.quote.vendorId,
          },
        };
      }
    } else if (purchaseOrderId) {
      where.purchaseOrderId = purchaseOrderId;
    } else if (vendorId) {
      where.purchaseOrder = {
        quote: {
          vendorId: vendorId,
        },
      };
    }

    // Only get confirmed credit notes for payment adjustment
    where.status = 'CONFIRMED';

    const creditNotes = await prisma.creditNote.findMany({
      where,
      include: {
        purchaseOrder: {
          include: {
            requisition: {
              include: {
                vessel: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
            quote: {
              include: {
                vendor: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Calculate total credit note amount
    const totalCreditAmount = creditNotes.reduce((sum, cn) => {
      // Only sum credit notes in the same currency as the invoice (if provided)
      return sum + Number(cn.amount);
    }, 0);

    return NextResponse.json({
      success: true,
      creditNotes: creditNotes.map((cn) => ({
        id: cn.id,
        creditNoteNumber: cn.creditNoteNumber,
        amount: Number(cn.amount),
        currency: cn.currency,
        date: cn.date,
        pdfUrl: cn.pdfUrl,
        pdfFileName: cn.pdfFileName,
        description: cn.description,
        status: cn.status || 'PENDING',
        vendorConfirmedAt: cn.vendorConfirmedAt,
        purchaseOrder: {
          id: cn.purchaseOrder.id,
          poNumber: cn.purchaseOrder.poNumber,
          requisition: {
            id: cn.purchaseOrder.requisition.id,
            requisitionNumber: cn.purchaseOrder.requisition.requisitionNumber,
            heading: cn.purchaseOrder.requisition.heading,
            vessel: cn.purchaseOrder.requisition.vessel,
          },
          quote: {
            vendor: cn.purchaseOrder.quote.vendor,
          },
        },
        uploadedBy: {
          id: cn.uploadedBy.id,
          firstName: cn.uploadedBy.firstName,
          lastName: cn.uploadedBy.lastName,
          employeeId: cn.uploadedBy.employeeId,
        },
        createdAt: cn.createdAt,
        updatedAt: cn.updatedAt,
      })),
      totalCreditAmount,
      count: creditNotes.length,
    });
  } catch (error: any) {
    console.error('Error fetching vendor credit notes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit notes', details: error.message },
      { status: 500 }
    );
  }
}

