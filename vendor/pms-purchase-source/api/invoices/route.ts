import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { recordInvoiceHistory, InvoiceHistoryActionType } from '@/lib/services/invoice-history.service';
import { getInvoiceApprovalLevels } from '@/lib/services/invoice-approval-config.service';
import { notifyInvoiceApprovalPending } from '@/lib/procurement/approval-notifications';
import {
  DELIVERY_NOTE_UPLOADED_STATUS_FILTER,
  isDeliveryNoteUploaded,
} from '@/lib/purchase/delivery-note-status';
import { INVOICE_PENDING_APPROVAL_STATUSES } from '@/lib/accounts/invoice-accounts-status';
import { buildAutoLevelOneApprovalFields } from '@/lib/purchase/invoice-access';

/**
 * GET /api/invoices - List invoices with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const requisitionId = searchParams.get('requisitionId');
    const parentRequisitionId = searchParams.get('parentRequisitionId');
    const parentRequisitionNumber = searchParams.get('parentRequisitionNumber');
    const vendorId = searchParams.get('vendorId');
    const vesselId = searchParams.get('vesselId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      const normalized = status.trim().toUpperCase();
      if (normalized === 'PENDING' || normalized === 'PENDING_APPROVAL') {
        where.status = { in: [...INVOICE_PENDING_APPROVAL_STATUSES] };
      } else {
        where.status = status;
      }
    }

    if (requisitionId) {
      where.requisitionId = requisitionId;
    }

    const parentFilter =
      parentRequisitionId
        ? [
            { requisitionId: parentRequisitionId },
            { requisition: { parentRequisitionId } },
          ]
        : parentRequisitionNumber
          ? [
              { requisition: { requisitionNumber: { contains: parentRequisitionNumber, mode: 'insensitive' } } },
              { requisition: { parentRequisition: { requisitionNumber: { contains: parentRequisitionNumber, mode: 'insensitive' } } } },
            ]
          : null;

    if (parentFilter) {
      where.OR = parentFilter;
    }

    if (vendorId) {
      where.vendorId = vendorId;
    }

    if (vesselId) {
      where.requisition = where.requisition
        ? { ...where.requisition, vesselId }
        : { vesselId };
    }

    if (search) {
      const searchOr = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { requisition: { requisitionNumber: { contains: search, mode: 'insensitive' } } },
        { vendor: { name: { contains: search, mode: 'insensitive' } } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchOr }];
        delete where.OR;
      } else {
        where.OR = searchOr;
      }
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          requisition: {
            select: {
              id: true,
              requisitionNumber: true,
              heading: true,
              parentRequisitionId: true,
              parentRequisition: {
                select: { id: true, requisitionNumber: true },
              },
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
            select: {
              id: true,
              totalAmount: true,
              currency: true,
            },
          },
          vendor: {
            select: {
              id: true,
              name: true,
              primaryEmail: true,
            },
          },
          levelOneApprover: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          levelTwoApprover: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          levelThreeApprover: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          levelFourApprover: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
            },
          },
        },
        orderBy: { invoiceDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/invoices - Create new invoice
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      invoiceNumber,
      requisitionId,
      purchaseOrderId,
      quoteId,
      vendorId,
      invoiceDate,
      invoiceAmount,
      currency = 'USD',
      invoiceFileUrl,
      dnStatus,
      placeOfDelivery,
      shipStaffRemarks,
      items,
    } = body;

    // Validate required fields
    if (!invoiceNumber || !requisitionId || !quoteId || !vendorId || !invoiceDate || !invoiceAmount) {
      return NextResponse.json(
        { error: 'Missing required fields: invoiceNumber, requisitionId, quoteId, vendorId, invoiceDate, invoiceAmount' },
        { status: 400 }
      );
    }

    // Get quote and requisition to check DN requirements
    const quote = await prisma.vendorQuote.findUnique({
      where: { id: quoteId },
      include: {
        requisition: {
          select: {
            requisitionType: true,
          },
        },
        deliveryNotes: {
          where: DELIVERY_NOTE_UPLOADED_STATUS_FILTER,
          orderBy: {
            uploadedAt: 'desc',
          },
          take: 1,
        },
      },
      select: { 
        totalAmount: true, 
        currency: true,
        requisition: true,
        deliveryNotes: true,
      },
    });

    if (!quote || !quote.totalAmount) {
      return NextResponse.json({ error: 'Quote not found or has no amount' }, { status: 404 });
    }

    // Check DN requirements
    // Requisition types where DN is NOT mandatory: Service (SER), Repair (REP), Communication (CTM), Other (OTR)
    const DN_NOT_MANDATORY_TYPES = ['SER', 'REP', 'CTM', 'OTR'];
    const requisitionType = quote.requisition?.requisitionType || '';
    const isDNMandatory = !DN_NOT_MANDATORY_TYPES.includes(requisitionType);

    // If DN is mandatory, check that it has been uploaded (verification not required for invoice)
    if (isDNMandatory) {
      const uploadedDN = quote.deliveryNotes?.[0];
      if (!uploadedDN || !isDeliveryNoteUploaded(uploadedDN.status)) {
        return NextResponse.json(
          { 
            error: 'Delivery note upload required before invoice processing',
            details: 'A delivery note must be uploaded for this requisition type before an invoice can be processed.',
          },
          { status: 400 }
        );
      }
    }

    const quoteAmount = Number(quote.totalAmount);
    const invoiceAmountNum = Number(invoiceAmount);
    const differenceAmount = invoiceAmountNum - quoteAmount;
    const differencePercent = quoteAmount > 0 ? (differenceAmount / quoteAmount) * 100 : 0;

    // Check if this is a part invoice (multiple invoices for same PO)
    let isPartInvoice = false;
    if (purchaseOrderId) {
      const existingInvoices = await prisma.invoice.count({
        where: {
          purchaseOrderId: purchaseOrderId,
          status: {
            not: 'CANCELLED',
          },
        },
      });
      isPartInvoice = existingInvoices > 0;
    }

    const autoL1 = buildAutoLevelOneApprovalFields(currentUser.id);

    // Create invoice (upload auto-completes L1; verification starts at L2)
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        requisitionId,
        purchaseOrderId: purchaseOrderId || null,
        quoteId,
        vendorId,
        invoiceDate: new Date(invoiceDate),
        invoiceAmount: invoiceAmountNum,
        currency,
        invoiceFileUrl: invoiceFileUrl || null,
        quoteAmount,
        differenceAmount,
        differencePercent,
        dnStatus: dnStatus || null,
        placeOfDelivery: placeOfDelivery || null,
        shipStaffRemarks: shipStaffRemarks || null,
        ...autoL1,
        isPartInvoice: isPartInvoice,
        items: {
          create: (items || []).map((item: any) => ({
            itemName: item.itemName,
            description: item.description || null,
            quantity: Number(item.quantity),
            unit: item.unit,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
          })),
        },
      },
      include: {
        requisition: {
          include: {
            vessel: true,
          },
        },
        quote: {
          include: {
            vendor: true,
          },
        },
        items: true,
      },
    });

    // Update PO completion status if PO exists
    if (purchaseOrderId) {
      const { updatePOStatusOnInvoiceCreate } = await import('@/lib/services/po-completion.service');
      await updatePOStatusOnInvoiceCreate(purchaseOrderId);
    }

    // Record history
    await recordInvoiceHistory({
      invoiceId: invoice.id,
      actionType: InvoiceHistoryActionType.LEVEL_ONE_APPROVED,
      performedById: currentUser.id,
      actionDescription: 'Invoice uploaded — L1 auto-approved on upload',
      newStatus: 'LEVEL_ONE_APPROVED',
    });

    // Notify L2 invoice verifiers
    try {
      const companyId = invoice.requisition?.vessel?.companyId ?? null;
      const vesselId = invoice.requisition?.vesselId ?? null;
      const levels = await getInvoiceApprovalLevels(companyId, vesselId);
      await notifyInvoiceApprovalPending({
        request,
        actorUserId: currentUser.id,
        vesselId,
        companyId,
        requisitionNumber: invoice.requisition.requisitionNumber,
        purchaseOrderNumber: invoice.purchaseOrder?.poNumber,
        invoiceId: invoice.id,
        invoiceNumber,
        approvalLevel: 2,
        targetAccessLevels: levels.level2AccessLevels,
        metadata: {
          invoiceAmount,
          currency,
        },
      });
    } catch (activityError: unknown) {
      console.error('Error logging invoice upload notification:', activityError);
    }

    return NextResponse.json({
      success: true,
      invoice,
      message: 'Invoice created successfully',
    });
  } catch (error: any) {
    console.error('Error creating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to create invoice', details: error.message },
      { status: 500 }
    );
  }
}

