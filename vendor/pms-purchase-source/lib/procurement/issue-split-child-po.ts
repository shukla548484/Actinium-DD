import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { storeEmailMessage } from '@/lib/email-storage';
import {
  buildPurchaseOrderEmailCc,
  sendPurchaseOrderEmail,
} from '@/lib/purchase-order-resend';
import { RequisitionStatus } from '@/lib/types/requisition';
import { recordPurchaseHistory, PurchaseHistoryActionType } from '@/lib/services/purchase-history.service';
import { generatePONumber, reservePONumber } from '@/lib/services/po-number-generator';
import { generatePOPDF } from '@/lib/services/po-pdf-generator';
import { getGoogleCloudStorageService } from '@/lib/google-cloud-storage';
import { buildSplitQuoteSlice } from '@/lib/procurement/split-quote-slice';
import { getPoApprovalPolicy } from '@/lib/services/po-approval-policy.service';
import {
  poRequiresTierApproval,
  resolveWorkflowStatusOnCreate,
} from '@/lib/services/po-workflow-status.service';
import { PurchaseOrderWorkflowStatus } from '@/lib/types/purchase-order-workflow';
import {
  notifyPoApprovalPending,
  notifyPoReadyToSend,
} from '@/lib/procurement/approval-notifications';
import { purgeCancelledPurchaseOrdersForQuote } from '@/lib/procurement/purge-purchase-order';
import type { Requisition, RequisitionItem, VendorQuote, Vendor, VendorQuoteItem } from '@prisma/client';

export type SplitPoEmailOptions = {
  ccEmails?: string | string[];
  includeUserEmailInCc?: boolean;
  userRemarks?: string;
  vendorRemarks?: string;
  conditions?: string;
  leadTime?: string;
  portOfDelivery?: string;
  agentDetails?: string;
  senderEmail?: string | null;
  senderName?: string;
};

type QuoteWithDetails = VendorQuote & {
  vendor: Vendor;
  quotedItems: VendorQuoteItem[];
};

type ParentRequisition = Requisition & {
  items: RequisitionItem[];
  vessel: { name: string; code: string | null; company?: { name: string } | null } | null;
};

function parseCcList(options: SplitPoEmailOptions): string[] {
  if (!options.senderEmail?.trim()) {
    throw new Error(
      'Sender email is required. PO emails always CC the user who sends the PO.'
    );
  }
  return buildPurchaseOrderEmailCc({
    senderEmail: options.senderEmail,
    additionalCc: options.ccEmails,
  });
}

function buildQuoteSlice(
  quote: QuoteWithDetails,
  requisitionItemIds: string[],
  parentItems: RequisitionItem[]
) {
  const parentItemRefs = parentItems.map((i) => ({
    id: i.id,
    itemName: i.itemName,
    quantity: Number(i.quantity),
    unit: i.unit,
  }));
  const { quoteSlice, sliceTotal } = buildSplitQuoteSlice(
    {
      quotedItems: quote.quotedItems.map((qi) => ({
        id: qi.id,
        requisitionItemId: qi.requisitionItemId,
        itemName: qi.itemName,
        quantity: qi.quantity != null ? Number(qi.quantity) : null,
        unit: qi.unit,
        unitPrice: qi.unitPrice != null ? Number(qi.unitPrice) : null,
        totalPrice: qi.totalPrice != null ? Number(qi.totalPrice) : null,
        remarks: qi.remarks,
        itemRemarks: qi.itemRemarks,
      })),
      additionalCharges: quote.additionalCharges != null ? Number(quote.additionalCharges) : null,
      deliveryCharges: quote.deliveryCharges != null ? Number(quote.deliveryCharges) : null,
      packingCharges: quote.packingCharges != null ? Number(quote.packingCharges) : null,
      totalAmount: quote.totalAmount != null ? Number(quote.totalAmount) : null,
      currency: quote.currency,
    },
    requisitionItemIds,
    parentItemRefs
  );

  return {
    quoteSlice: {
      ...quote,
      quotedItems: quote.quotedItems.map((orig) => {
        const sliced = quoteSlice.quotedItems.find(
          (s) =>
            (s.id && s.id === orig.id) ||
            s.itemName?.toLowerCase().trim() === orig.itemName?.toLowerCase().trim()
        );
        if (!sliced) {
          return {
            ...orig,
            quantity: 0 as typeof orig.quantity,
            unitPrice: orig.unitPrice != null ? (0 as typeof orig.unitPrice) : orig.unitPrice,
            totalPrice: orig.totalPrice != null ? (0 as typeof orig.totalPrice) : orig.totalPrice,
          };
        }
        return {
          ...orig,
          quantity: sliced.quantity != null ? (sliced.quantity as typeof orig.quantity) : orig.quantity,
          unitPrice:
            sliced.unitPrice != null ? (sliced.unitPrice as typeof orig.unitPrice) : orig.unitPrice,
          totalPrice:
            sliced.totalPrice != null ? (sliced.totalPrice as typeof orig.totalPrice) : orig.totalPrice,
        };
      }),
      totalAmount: sliceTotal as typeof quote.totalAmount,
    },
    sliceTotal,
  };
}

function enrichRequisitionForPoPdf<T extends { vessel?: { company?: unknown } | null }>(
  childReq: T,
  parentVessel?: { company?: unknown } | null
): T {
  if (!parentVessel) return childReq;
  if (!childReq.vessel) {
    return { ...childReq, vessel: parentVessel };
  }
  if (childReq.vessel.company) return childReq;
  return {
    ...childReq,
    vessel: { ...childReq.vessel, company: parentVessel.company },
  };
}

function buildSplitPoEmail(params: {
  poNumber: string;
  childRequisitionNumber: string;
  parentRequisitionNumber: string;
  vesselName: string;
  vendorName: string;
  vendorContact?: string | null;
  vendorId?: string | null;
  currency: string;
  totalAmount: number;
  dateOfIssue: Date;
  emailOptions: SplitPoEmailOptions;
}) {
  const {
    poNumber,
    childRequisitionNumber,
    parentRequisitionNumber,
    vesselName,
    vendorName,
    vendorContact,
    currency,
    totalAmount,
    dateOfIssue,
    emailOptions,
  } = params;

  const vendorIdDisplay = params.vendorId?.trim() || '';
  const subject = vendorIdDisplay
    ? `Purchase Order ${poNumber} - ${childRequisitionNumber} | Vendor ID: ${vendorIdDisplay}`
    : `Purchase Order ${poNumber} - ${childRequisitionNumber} (split from ${parentRequisitionNumber})`;

  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">Purchase Order — split requisition</h2>
          <p>Dear ${vendorContact || 'Sir/Madam'},</p>
          <p>Please find attached the Purchase Order for your allocated items on this split requisition.</p>
          <table style="border-collapse: collapse; width: 100%; margin: 20px 0; border: 1px solid #ddd;">
            <tr><td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; background-color: #f5f5f5;">PO Number</td><td style="border: 1px solid #ddd; padding: 8px;">${poNumber}</td></tr>
            <tr><td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; background-color: #f5f5f5;">Child requisition</td><td style="border: 1px solid #ddd; padding: 8px;">${childRequisitionNumber}</td></tr>
            <tr><td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; background-color: #f5f5f5;">Main requisition</td><td style="border: 1px solid #ddd; padding: 8px;">${parentRequisitionNumber}</td></tr>
            <tr><td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; background-color: #f5f5f5;">Vessel</td><td style="border: 1px solid #ddd; padding: 8px;">${vesselName}</td></tr>
            <tr><td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; background-color: #f5f5f5;">Vendor</td><td style="border: 1px solid #ddd; padding: 8px;">${vendorName}</td></tr>
            <tr><td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; background-color: #f5f5f5;">Total amount</td><td style="border: 1px solid #ddd; padding: 8px;">${currency} ${totalAmount.toLocaleString()}</td></tr>
            <tr><td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; background-color: #f5f5f5;">Date of issue</td><td style="border: 1px solid #ddd; padding: 8px;">${dateOfIssue.toLocaleDateString()}</td></tr>
          </table>
          ${emailOptions.userRemarks ? `<div style="background:#f5f5f5;padding:12px;border-left:4px solid #2563eb;margin:16px 0;"><strong>Remarks:</strong><p style="white-space:pre-wrap;margin:8px 0 0;">${emailOptions.userRemarks}</p></div>` : ''}
          ${emailOptions.vendorRemarks ? `<div style="background:#f5f5f5;padding:12px;margin:16px 0;"><strong>Vendor remarks:</strong><p style="white-space:pre-wrap;margin:8px 0 0;">${emailOptions.vendorRemarks}</p></div>` : ''}
          ${emailOptions.conditions ? `<div style="background:#f5f5f5;padding:12px;margin:16px 0;"><strong>Conditions:</strong><p style="white-space:pre-wrap;margin:8px 0 0;">${emailOptions.conditions}</p></div>` : ''}
          ${emailOptions.leadTime ? `<p><strong>Lead time:</strong> ${emailOptions.leadTime}</p>` : ''}
          ${emailOptions.portOfDelivery ? `<p><strong>Port of delivery:</strong> ${emailOptions.portOfDelivery}</p>` : ''}
          ${emailOptions.agentDetails ? `<p><strong>Agent details:</strong> ${emailOptions.agentDetails}</p>` : ''}
          <p>Please proceed as per the attached Purchase Order PDF.</p>
          <p>Best regards,<br>${emailOptions.senderName || 'Procurement Team'}<br>Actinium-sm</p>
        </div>
      </body>
    </html>
  `;

  const text = [
    `Purchase Order ${poNumber}`,
    `Child requisition: ${childRequisitionNumber}`,
    `Main requisition: ${parentRequisitionNumber}`,
    `Vessel: ${vesselName}`,
    `Total: ${currency} ${totalAmount.toLocaleString()}`,
    emailOptions.conditions ? `Conditions: ${emailOptions.conditions}` : '',
    emailOptions.leadTime ? `Lead time: ${emailOptions.leadTime}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}

async function sendSplitPoEmail(params: {
  quote: QuoteWithDetails;
  childRequisitionId: string;
  poNumber: string;
  fileName: string;
  pdfBuffer: Buffer;
  parent: ParentRequisition;
  childRequisitionNumber: string;
  sliceTotal: number;
  emailOptions: SplitPoEmailOptions;
}) {
  const { subject, html, text } = buildSplitPoEmail({
    poNumber: params.poNumber,
    childRequisitionNumber: params.childRequisitionNumber,
    parentRequisitionNumber: params.parent.requisitionNumber,
    vesselName: params.parent.vessel?.name ?? 'Unknown Vessel',
    vendorName: params.quote.vendor.name,
    vendorContact: params.quote.vendor.contactPerson,
    currency: params.quote.currency,
    totalAmount: params.sliceTotal,
    dateOfIssue: new Date(),
    emailOptions: params.emailOptions,
    vendorId: params.quote.vendor.vendorId,
  });

  const cc = parseCcList(params.emailOptions);
  const emailResult = await sendPurchaseOrderEmail({
    to: params.quote.vendor.primaryEmail,
    cc,
    subject,
    html,
    text,
    attachments: [
      {
        filename: params.fileName,
        content: params.pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  if (emailResult?.messageId) {
    await storeEmailMessage(emailResult.messageId, 'PO_CONFIRMATION', params.childRequisitionId, params.quote.id);
  }

  return emailResult;
}

export async function createSplitChildPurchaseOrder(params: {
  parentRequisitionId: string;
  quoteId: string;
  childRequisitionId: string;
  performedById: string;
  emailOptions?: SplitPoEmailOptions;
  request?: NextRequest;
  ifExists?: 'throw' | 'skip';
}) {
  const emailOptions = params.emailOptions ?? {};
  const ifExists = params.ifExists ?? 'throw';

  const parent = (await prisma.requisition.findUnique({
    where: { id: params.parentRequisitionId },
    include: {
      items: { orderBy: { createdAt: 'asc' } },
      vessel: { include: { company: true } },
    },
  })) as ParentRequisition | null;

  if (!parent) {
    throw new Error('Parent requisition not found');
  }
  if (parent.status !== RequisitionStatus.SPLIT) {
    throw new Error('Requisition must be in SPLIT status');
  }

  const allocation = await prisma.requisitionSplitAllocation.findFirst({
    where: {
      parentRequisitionId: parent.id,
      childRequisitionId: params.childRequisitionId,
      vendorQuoteId: params.quoteId,
    },
    include: {
      allocationItems: true,
      vendorQuote: { include: { vendor: true, quotedItems: true } },
      childRequisition: true,
    },
  });

  if (!allocation) {
    throw new Error('Split allocation not found for this child requisition and quote');
  }

  const existingPO = await prisma.purchaseOrder.findFirst({
    where: { quoteId: params.quoteId, requisitionId: params.childRequisitionId },
    select: { id: true, poNumber: true, workflowStatus: true },
  });
  if (existingPO) {
    if (ifExists === 'skip') {
      return {
        purchaseOrder: { id: existingPO.id, poNumber: existingPO.poNumber },
        vendorEmail: allocation.vendorQuote.vendor.primaryEmail,
        childRequisitionNumber: allocation.childRequisition.requisitionNumber,
        workflowStatus: existingPO.workflowStatus ?? PurchaseOrderWorkflowStatus.PO_CREATED,
        requiresApproval: false,
        readyToSend: existingPO.workflowStatus === PurchaseOrderWorkflowStatus.PO_CONFIRMED,
        skipped: true as const,
      };
    }
    throw new Error(`PO ${existingPO.poNumber} already exists for this vendor.`);
  }

  const quote = allocation.vendorQuote as QuoteWithDetails;
  const requisitionItemIds = allocation.allocationItems.map((ai) => ai.requisitionItemId);

  const childReq = await prisma.requisition.findUnique({
    where: { id: params.childRequisitionId },
    include: {
      items: true,
      createdBy: true,
      vessel: { include: { company: true } },
    },
  });
  if (!childReq) {
    throw new Error('Child requisition not found');
  }

  await purgeCancelledPurchaseOrdersForQuote({
    quoteId: params.quoteId,
    requisitionId: params.childRequisitionId,
    performedById: params.performedById,
    reason: 'Auto-cleanup of cancelled purchase order before re-issue',
  });

  const { quoteSlice, sliceTotal } = buildQuoteSlice(quote, requisitionItemIds, parent.items);
  const dateOfIssue = new Date();
  const companyId = parent.vessel?.companyId ?? null;
  const vesselId = parent.vesselId ?? null;
  const policy = await getPoApprovalPolicy(companyId, vesselId);
  const requiresApproval = poRequiresTierApproval(sliceTotal, policy);
  const workflowStatus = resolveWorkflowStatusOnCreate(sliceTotal, policy);
  const readyToSend = workflowStatus === PurchaseOrderWorkflowStatus.PO_CONFIRMED;

  const poNumber = await generatePONumber(parent.vesselId, parent.requisitionType);
  await reservePONumber(parent.vesselId, parent.requisitionType, poNumber, params.performedById);

  const pdfBuffer = await generatePOPDF({
    poNumber,
    dateOfIssue,
    requisition: enrichRequisitionForPoPdf(childReq, parent.vessel) as any,
    quote: quoteSlice as any,
    userRemarks: emailOptions.userRemarks,
    vendorRemarks: emailOptions.vendorRemarks,
    conditions: emailOptions.conditions,
    leadTime: emailOptions.leadTime,
    portOfDelivery: emailOptions.portOfDelivery,
    agentDetails: emailOptions.agentDetails,
  });

  const fileName = `PO_${poNumber}_${childReq.vessel?.code || parent.vessel?.code || 'UNKNOWN'}_${dateOfIssue.toISOString().split('T')[0]}.pdf`;
  const gcs = getGoogleCloudStorageService();
  const uploadResult = await gcs.uploadFile(pdfBuffer, fileName, 'application/pdf', {
    vesselId: parent.vesselId,
    category: 'purchase-orders' as any,
  });

  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      requisitionId: childReq.id,
      quoteId: quote.id,
      vesselId: parent.vesselId,
      vesselName: childReq.vessel?.name ?? parent.vessel?.name ?? 'Unknown Vessel',
      parentRequisitionId: parent.id,
      dateOfIssue,
      originalPdfUrl: uploadResult.publicUrl,
      totalAmount: quoteSlice.totalAmount,
      currency: quote.currency,
      status: 'ACTIVE',
      workflowStatus,
      completionStatus: 'OPEN',
    },
  });

  try {
    await prisma.purchaseOrderHistory.create({
      data: {
        purchaseOrderId: po.id,
        actionType: 'CREATED',
        actionDescription: `Split PO ${poNumber} created (awaiting L1 approval)`,
        newStatus: workflowStatus,
        newValue: JSON.stringify({
          poNumber,
          totalAmount: sliceTotal,
          currency: quote.currency,
          workflowStatus,
          parentRequisitionNumber: parent.requisitionNumber,
        }),
        comments: emailOptions.userRemarks || undefined,
        performedById: params.performedById,
      },
    });
  } catch {
    /* non-critical */
  }

  try {
    await recordPurchaseHistory({
      requisitionId: childReq.id,
      actionType: PurchaseHistoryActionType.STATUS_CHANGED,
      performedById: params.performedById,
      actionDescription: `Split PO ${poNumber} created for vendor ${quote.vendor.name}`,
      previousStatus: childReq.status,
      newStatus: childReq.status,
      newValue: { quoteId: quote.id, vendorId: quote.vendorId, poNumber, workflowStatus },
    });
  } catch {
    /* non-critical */
  }

  if (params.request) {
    try {
      await notifyPoApprovalPending({
        request: params.request,
        actorUserId: params.performedById,
        vesselId,
        companyId,
        requisitionNumber: childReq.requisitionNumber,
        purchaseOrderNumber: poNumber,
        quoteId: quote.id,
        poId: po.id,
        approvalLevel: 1,
        targetAccessLevels: policy.level1AccessLevels,
        metadata: {
          totalAmount: sliceTotal,
          currency: quote.currency,
          splitParentRequisitionNumber: parent.requisitionNumber,
        },
      });
    } catch (notifyErr) {
      console.error('[createSplitChildPurchaseOrder] notification failed:', notifyErr);
    }
  }

  return {
    purchaseOrder: { id: po.id, poNumber: po.poNumber },
    vendorEmail: quote.vendor.primaryEmail,
    childRequisitionNumber: childReq.requisitionNumber,
    workflowStatus,
    requiresApproval,
    readyToSend,
    skipped: false as const,
  };
}

export async function issueSplitChildPO(params: {
  parentRequisitionId: string;
  quoteId: string;
  childRequisitionId: string;
  performedById: string;
  emailOptions?: SplitPoEmailOptions;
  request?: NextRequest;
}) {
  const result = await createSplitChildPurchaseOrder({
    ...params,
    ifExists: 'throw',
  });

  return {
    purchaseOrder: result.purchaseOrder,
    vendorEmail: result.vendorEmail,
    childRequisitionNumber: result.childRequisitionNumber,
    requiresApproval: result.requiresApproval,
    readyToSend: result.readyToSend,
    workflowStatus: result.workflowStatus,
  };
}

export async function resendSplitChildPOEmail(params: {
  parentRequisitionId: string;
  quoteId: string;
  childRequisitionId: string;
  performedById: string;
  emailOptions?: SplitPoEmailOptions;
}) {
  const emailOptions = params.emailOptions ?? {};

  const po = await prisma.purchaseOrder.findFirst({
    where: { quoteId: params.quoteId, requisitionId: params.childRequisitionId },
    select: { id: true, poNumber: true, workflowStatus: true, dateOfIssue: true },
  });
  if (!po) {
    throw new Error('No purchase order found for this child requisition');
  }

  const childReq = await prisma.requisition.findUnique({
    where: { id: params.childRequisitionId },
    include: {
      items: true,
      createdBy: true,
      vessel: { include: { company: true } },
    },
  });
  if (!childReq) {
    throw new Error('Child requisition not found');
  }

  const sentToVendor =
    childReq.status === RequisitionStatus.QUOTE_CONFIRMED_PO_SENT ||
    po.workflowStatus === PurchaseOrderWorkflowStatus.PO_SENT;
  if (!sentToVendor) {
    throw new Error(
      'Purchase Order has not been sent to the vendor yet. Complete approvals and send from the PO status page.'
    );
  }

  const parent = (await prisma.requisition.findUnique({
    where: { id: params.parentRequisitionId },
    include: {
      items: { orderBy: { createdAt: 'asc' } },
      vessel: { include: { company: true } },
    },
  })) as ParentRequisition | null;

  if (!parent) {
    throw new Error('Parent requisition not found');
  }

  const allocation = await prisma.requisitionSplitAllocation.findFirst({
    where: {
      parentRequisitionId: parent.id,
      childRequisitionId: params.childRequisitionId,
      vendorQuoteId: params.quoteId,
    },
    include: {
      allocationItems: true,
      vendorQuote: { include: { vendor: true, quotedItems: true } },
    },
  });

  if (!allocation) {
    throw new Error('Split allocation not found');
  }

  const quote = allocation.vendorQuote as QuoteWithDetails;

  const { quoteSlice, sliceTotal } = buildQuoteSlice(
    quote,
    allocation.allocationItems.map((ai) => ai.requisitionItemId),
    parent.items
  );

  const pdfBuffer = await generatePOPDF({
    poNumber: po.poNumber,
    dateOfIssue: po.dateOfIssue,
    requisition: enrichRequisitionForPoPdf(childReq, parent.vessel) as any,
    quote: quoteSlice as any,
    userRemarks: emailOptions.userRemarks,
    vendorRemarks: emailOptions.vendorRemarks,
    conditions: emailOptions.conditions,
    leadTime: emailOptions.leadTime,
    portOfDelivery: emailOptions.portOfDelivery,
    agentDetails: emailOptions.agentDetails,
  });

  const fileName = `PO_${po.poNumber}_${childReq.vessel?.code || parent.vessel?.code || 'UNKNOWN'}.pdf`;

  await sendSplitPoEmail({
    quote,
    childRequisitionId: childReq.id,
    poNumber: po.poNumber,
    fileName,
    pdfBuffer,
    parent,
    childRequisitionNumber: childReq.requisitionNumber,
    sliceTotal,
    emailOptions,
  });

  return {
    purchaseOrder: { id: po.id, poNumber: po.poNumber },
    vendorEmail: quote.vendor.primaryEmail,
    childRequisitionNumber: childReq.requisitionNumber,
  };
}
