import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { getGoogleCloudStorageService } from '@/lib/google-cloud-storage';
import { recordInvoiceHistory, InvoiceHistoryActionType } from '@/lib/services/invoice-history.service';
import {
  isAllowedInvoiceFile,
  invoiceFileExtension,
  resolveInvoiceFileContentType,
} from '@/lib/invoice-file-upload';
import { convertInvoiceAmountToUsd } from '@/lib/purchase-invoice-currency-server';
import { BASE_CURRENCY, convertCurrency } from '@/lib/utils/currency';
import { canModifyUploadedInvoice } from '@/lib/purchase/invoice-workbench';
import {
  buildAutoLevelOneApprovalFields,
  invoiceNeedsPurchaserCorrection,
} from '@/lib/purchase/invoice-access';
import { isUnbudgetedPurchase } from '@/lib/purchase/po-budget-classification';
import { getInvoiceApprovalLevels } from '@/lib/services/invoice-approval-config.service';
import { notifyInvoiceApprovalPending } from '@/lib/procurement/approval-notifications';
import { attachPoCostComparisonSummaries } from '@/lib/accounts/po-invoice-cost-comparison';
import { resolveEffectiveIsBudgeted } from '@/lib/purchase/po-budget-classification';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/invoices/[id] - Get invoice details
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    
    if (!id) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    console.log('[GET /api/invoices/[id]] Fetching invoice:', id);

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        requisition: {
          include: {
            vessel: {
              include: {
                company: {
                  select: {
                    id: true,
                    name: true,
                    address: true,
                  },
                },
              },
            },
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            items: true,
          },
        },
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            dateOfIssue: true,
            totalAmount: true,
            currency: true,
            isBudgeted: true,
            contract: {
              select: {
                id: true,
                contractNumber: true,
                contractType: true,
                title: true,
              },
            },
          },
        },
        quote: {
          include: {
            vendor: true,
            quotedItems: true,
          },
        },
        vendor: true,
        items: true,
        accountCode: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            accountType: true,
          },
        },
        levelOneApprover: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        levelTwoApprover: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        levelThreeApprover: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        levelFourApprover: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        lastReturner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        payer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        history: {
          include: {
            performedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!invoice) {
      console.log('[GET /api/invoices/[id]] Invoice not found:', id);
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    console.log('[GET /api/invoices/[id]] Invoice found successfully:', invoice.invoiceNumber);

    const [costSummary] = await attachPoCostComparisonSummaries(prisma, [
      {
        id: invoice.id,
        invoiceAmount: invoice.invoiceAmount,
        quoteAmount: invoice.quoteAmount,
        currency: invoice.currency,
        quoteId: invoice.quoteId,
        purchaseOrder: invoice.purchaseOrder,
        requisition: { vesselId: invoice.requisition.vesselId },
      },
    ]);
    
    const effectiveIsBudgeted =
      invoice.isBudgeted ??
      resolveEffectiveIsBudgeted(
        invoice.purchaseOrder?.isBudgeted,
        invoice.requisition?.isBudgeted
      );

    return NextResponse.json({
      success: true,
      invoice: {
        ...invoice,
        effectiveIsBudgeted,
        poAmount: costSummary.poAmount,
        vesselConfirmedAmount: costSummary.vesselConfirmedAmount,
        hasVesselReceipt: costSummary.hasVesselReceipt,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/invoices/[id]] Error fetching invoice:', error);
    console.error('[GET /api/invoices/[id]] Error stack:', error.stack);
    console.error('[GET /api/invoices/[id]] Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch invoice', 
        details: error.message,
        code: error.code,
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/invoices/[id] - Update invoice
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    
    // Check if request is FormData (file upload) or JSON
    const contentType = request.headers.get('content-type') || '';
    let body: any;
    let invoiceFile: File | null = null;
    let ownerApprovalFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      body = {
        invoiceNumber: formData.get('invoiceNumber'),
        invoiceAmount: formData.get('invoiceAmount'),
        invoiceCurrency: formData.get('invoiceCurrency'),
        invoiceDate: formData.get('invoiceDate'),
        accountType: formData.get('accountType'),
      };
      invoiceFile = formData.get('invoiceFile') as File | null;
      ownerApprovalFile = formData.get('ownerApprovalFile') as File | null;
    } else {
      body = await request.json();
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        requisition: {
          include: {
            vessel: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (
      !canModifyUploadedInvoice({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate.toISOString(),
        invoiceAmount: Number(invoice.invoiceAmount),
        currency: invoice.currency,
        accountType: invoice.accountType,
        status: invoice.status,
        invoiceFileUrl: invoice.invoiceFileUrl,
        levelOneApprovedAt: invoice.levelOneApprovedAt?.toISOString() ?? null,
        purchaseOrderId: invoice.purchaseOrderId,
        createdAt: invoice.createdAt.toISOString(),
        vendor: { id: invoice.vendorId, name: '' },
      })
    ) {
      return NextResponse.json(
        {
          error:
            'Cannot update invoice after L2 approval. Return the invoice to the purchaser before editing.',
        },
        { status: 400 }
      );
    }

    // Only allow updates if invoice is not fully approved
    if (invoice.status === 'LEVEL_FOUR_APPROVED' || invoice.status === 'PAID') {
      return NextResponse.json(
        { error: 'Cannot update invoice that is fully approved or paid' },
        { status: 400 }
      );
    }

    const previousStatus = invoice.status;
    const updateData: any = {};
    const needsAutoL1 = invoiceNeedsPurchaserCorrection(invoice.status);

    const parsedEditDate = body.invoiceDate
      ? new Date(body.invoiceDate as string)
      : invoice.invoiceDate;

    if (body.invoiceDate) updateData.invoiceDate = parsedEditDate;
    if (body.invoiceNumber) updateData.invoiceNumber = String(body.invoiceNumber).trim();

    const editCurrency = (
      (body.invoiceCurrency as string) ||
      body.currency ||
      invoice.currency
    )
      .toString()
      .trim()
      .toUpperCase();

    if (body.invoiceAmount !== undefined && body.invoiceAmount !== '') {
      const originalParsed = Number(body.invoiceAmount);
      const conversion = await convertInvoiceAmountToUsd(
        originalParsed,
        editCurrency,
        parsedEditDate
      );
      updateData.invoiceAmount = conversion.usdAmount;
      updateData.originalInvoiceAmount = conversion.originalAmount;
      updateData.fxRateToUsd = conversion.fxRateToUsd;
      updateData.fxRateSource = conversion.fxRateSource;
      updateData.currency = conversion.originalCurrency;

      const quote = await prisma.vendorQuote.findUnique({
        where: { id: invoice.quoteId },
        select: { totalAmount: true, currency: true },
      });
      if (quote?.totalAmount) {
        const quoteAmount = Number(quote.totalAmount);
        const quoteAmountUsd = await convertCurrency(
          quoteAmount,
          quote.currency || BASE_CURRENCY,
          BASE_CURRENCY,
          parsedEditDate
        );
        updateData.differenceAmount = conversion.usdAmount - quoteAmountUsd;
        updateData.differencePercent =
          quoteAmountUsd > 0
            ? ((conversion.usdAmount - quoteAmountUsd) / quoteAmountUsd) * 100
            : 0;
        updateData.quoteAmount = quoteAmountUsd;
      }
    } else if (body.invoiceCurrency || body.currency) {
      updateData.currency = editCurrency;
    }
    if (body.accountType !== undefined) updateData.accountType = body.accountType;
    if (body.dnStatus !== undefined) updateData.dnStatus = body.dnStatus;
    if (body.placeOfDelivery !== undefined) updateData.placeOfDelivery = body.placeOfDelivery;
    if (body.shipStaffRemarks !== undefined) updateData.shipStaffRemarks = body.shipStaffRemarks;
    if (body.ownerApprovalFileUrl !== undefined) {
      updateData.ownerApprovalFileUrl = body.ownerApprovalFileUrl;
    }
    if (body.ownerApprovalFileName !== undefined) {
      updateData.ownerApprovalFileName = body.ownerApprovalFileName;
    }

    // Handle file upload if provided
    if (invoiceFile) {
      const fileCheck = isAllowedInvoiceFile(invoiceFile);
      if (!fileCheck.ok) {
        return NextResponse.json({ error: fileCheck.error }, { status: 400 });
      }
      const gcs = getGoogleCloudStorageService();
      const arrayBuffer = await invoiceFile.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);
      const timestamp = Date.now();
      const ext = invoiceFileExtension(invoiceFile.name) || "pdf";
      const fileName = `invoice_${invoice.invoiceNumber.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}.${ext}`;

      const uploadResult = await gcs.uploadFile(
        fileBuffer,
        fileName,
        resolveInvoiceFileContentType(invoiceFile),
        {
          vesselId: invoice.requisition.vesselId,
          category: "invoices",
          subfolder: invoice.purchaseOrderId ? `purchase-orders/${invoice.purchaseOrderId}` : undefined,
        }
      );

      updateData.invoiceFileUrl = uploadResult.fileUrl;
    } else if (body.invoiceFileUrl !== undefined) {
      updateData.invoiceFileUrl = body.invoiceFileUrl;
    }

    if (ownerApprovalFile?.size) {
      const fileCheck = isAllowedInvoiceFile(ownerApprovalFile);
      if (!fileCheck.ok) {
        return NextResponse.json({ error: fileCheck.error }, { status: 400 });
      }
      const gcs = getGoogleCloudStorageService();
      const arrayBuffer = await ownerApprovalFile.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);
      const timestamp = Date.now();
      const ext = invoiceFileExtension(ownerApprovalFile.name) || "pdf";
      const fileName = `owner_approval_${invoice.invoiceNumber.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}.${ext}`;

      const uploadResult = await gcs.uploadFile(
        fileBuffer,
        fileName,
        resolveInvoiceFileContentType(ownerApprovalFile),
        {
          vesselId: invoice.requisition.vesselId,
          category: "invoices",
          subfolder: invoice.purchaseOrderId
            ? `purchase-orders/${invoice.purchaseOrderId}/owner-approval`
            : undefined,
        }
      );

      updateData.ownerApprovalFileUrl = uploadResult.fileUrl;
      updateData.ownerApprovalFileName = ownerApprovalFile.name;
    }

    if (invoice.purchaseOrderId) {
      const purchaseOrder = await prisma.purchaseOrder.findUnique({
        where: { id: invoice.purchaseOrderId },
        select: {
          isBudgeted: true,
          requisition: { select: { isBudgeted: true } },
        },
      });
      if (purchaseOrder) {
        const ownerApprovalUrl =
          updateData.ownerApprovalFileUrl !== undefined
            ? updateData.ownerApprovalFileUrl
            : invoice.ownerApprovalFileUrl;
        if (
          isUnbudgetedPurchase({
            poIsBudgeted: purchaseOrder.isBudgeted,
            requisitionIsBudgeted: purchaseOrder.requisition.isBudgeted,
          }) &&
          !ownerApprovalUrl?.trim()
        ) {
          return NextResponse.json(
            {
              error:
                "Owner's approval attachment is required for un-budgeted requisitions",
            },
            { status: 400 }
          );
        }
      }
    }

    // Update items if provided
    if (body.items) {
      // Delete existing items
      await prisma.invoiceItem.deleteMany({
        where: { invoiceId: id },
      });

      // Create new items
      await prisma.invoiceItem.createMany({
        data: body.items.map((item: any) => ({
          invoiceId: id,
          itemName: item.itemName,
          description: item.description || null,
          quantity: Number(item.quantity),
          unit: item.unit,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
        })),
      });
    }

    if (needsAutoL1) {
      Object.assign(updateData, buildAutoLevelOneApprovalFields(currentUser.id));
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
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

    // Record history
    await recordInvoiceHistory({
      invoiceId: id,
      actionType: needsAutoL1
        ? InvoiceHistoryActionType.LEVEL_ONE_APPROVED
        : InvoiceHistoryActionType.UPDATED,
      performedById: currentUser.id,
      actionDescription: needsAutoL1
        ? 'Invoice corrected and re-submitted — L1 auto-approved on upload'
        : 'Invoice updated',
      previousStatus,
      newStatus: updatedInvoice.status,
    });

    if (needsAutoL1) {
      try {
        const companyId = updatedInvoice.requisition?.vessel?.companyId ?? null;
        const vesselId = updatedInvoice.requisition?.vesselId ?? null;
        const levels = await getInvoiceApprovalLevels(companyId, vesselId);
        await notifyInvoiceApprovalPending({
          request,
          actorUserId: currentUser.id,
          vesselId,
          companyId,
          requisitionNumber: updatedInvoice.requisition?.requisitionNumber,
          purchaseOrderNumber: undefined,
          invoiceId: updatedInvoice.id,
          invoiceNumber: updatedInvoice.invoiceNumber,
          approvalLevel: 2,
          targetAccessLevels: levels.level2AccessLevels,
        });
      } catch (notifyErr) {
        console.error('Invoice correction L2 notification failed:', notifyErr);
      }
    }

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice,
      message: 'Invoice updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to update invoice', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/invoices/[id] - Delete invoice
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Only allow deletion before L2 approval
    if (
      invoice.status !== 'READY_FOR_APPROVAL' &&
      invoice.status !== 'RETURNED' &&
      !(invoice.status === 'LEVEL_ONE_APPROVED' && !invoice.levelTwoApprovedAt)
    ) {
      return NextResponse.json(
        { error: 'Cannot delete invoice that has passed L2 approval' },
        { status: 400 }
      );
    }

    // Record history before deletion
    await recordInvoiceHistory({
      invoiceId: id,
      actionType: InvoiceHistoryActionType.CANCELLED,
      performedById: currentUser.id,
      actionDescription: 'Invoice deleted',
      previousStatus: invoice.status,
    });

    const purchaseOrderId = invoice.purchaseOrderId;

    await prisma.invoice.delete({
      where: { id },
    });

    // Update PO completion status if PO exists
    if (purchaseOrderId) {
      const { updatePOCompletionStatus } = await import('@/lib/services/po-completion.service');
      await updatePOCompletionStatus(purchaseOrderId);
    }

    return NextResponse.json({
      success: true,
      message: 'Invoice deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting invoice:', error);
    return NextResponse.json(
      { error: 'Failed to delete invoice', details: error.message },
      { status: 500 }
    );
  }
}

