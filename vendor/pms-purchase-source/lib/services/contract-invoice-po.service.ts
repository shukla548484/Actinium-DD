import { QuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CONTRACT_TYPE_INVOICE_BASED,
  isInvoiceBasedContractType,
} from "@/lib/contract-invoice-based";
import { generatePONumber } from "@/lib/services/po-number-generator";
import { hasAtLeastOneQuotedCost } from "@/lib/quote-status-utils";

export class ContractInvoicePoError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "ContractInvoicePoError";
  }
}

export async function loadInvoiceBasedContractForVessel(
  contractId: string,
  vesselId: string
) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      vendor: { select: { id: true, name: true, primaryEmail: true } },
    },
  });

  if (!contract) {
    throw new ContractInvoicePoError("Contract not found", 404);
  }
  if (!isInvoiceBasedContractType(contract.contractType)) {
    throw new ContractInvoicePoError(
      "Selected contract is not an invoice-based contract",
      400
    );
  }
  if (contract.status !== "ACTIVE") {
    throw new ContractInvoicePoError(
      `Contract must be ACTIVE to receive invoices (current: ${contract.status})`,
      400
    );
  }
  if (!contract.isGlobal && !contract.applicableVesselIds.includes(vesselId)) {
    throw new ContractInvoicePoError("Contract does not apply to the selected vessel", 400);
  }

  const vessel = await prisma.vessel.findUnique({
    where: { id: vesselId },
    select: { id: true, name: true, code: true },
  });
  if (!vessel) {
    throw new ContractInvoicePoError("Vessel not found", 404);
  }

  return { contract, vessel };
}

/**
 * Creates req → quote → PO for an invoice-based contract upload.
 * PO is pre-approved (all approval timestamps set); only the invoice needs approval (level 37+).
 */
export async function createPurchaseOrderForContractInvoice(params: {
  contractId: string;
  vesselId: string;
  invoiceAmount: number;
  currency: string;
  invoiceNumber: string;
  performedById: string;
  accountType?: string;
}): Promise<{
  purchaseOrderId: string;
  poNumber: string;
  quoteId: string;
  requisitionId: string;
}> {
  const { contract, vessel } = await loadInvoiceBasedContractForVessel(
    params.contractId,
    params.vesselId
  );

  const requisitionType = "SER";
  const now = new Date();
  const reqSuffix = params.invoiceNumber.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || Date.now().toString(36);

  const requisition = await prisma.requisition.create({
    data: {
      requisitionNumber: `CTR-${contract.contractNumber}-${reqSuffix}`.slice(0, 80),
      heading: `Contract invoice: ${contract.title}`,
      description: `Auto-generated for invoice-based contract ${contract.contractNumber} · Invoice ${params.invoiceNumber}`,
      requisitionType,
      vesselId: vessel.id,
      contractId: contract.id,
      createdById: params.performedById,
      status: "QUOTE_CONFIRMED_PO_SENT",
      budgetCode: params.accountType ?? undefined,
    },
  });

  const amount = params.invoiceAmount;
  const canApproveQuote = hasAtLeastOneQuotedCost([
    { unitPrice: amount, totalPrice: amount },
  ]);

  const quote = await prisma.vendorQuote.create({
    data: {
      requisitionId: requisition.id,
      vendorId: contract.vendorId,
      quoteNumber: `CTR-Q-${reqSuffix}`.slice(0, 50),
      totalAmount: amount,
      currency: params.currency || contract.currency || "USD",
      status: canApproveQuote ? QuoteStatus.APPROVED : QuoteStatus.RECEIVED,
      receivedAt: canApproveQuote ? now : null,
      sentAt: now,
      uniqueEmailId: `CTR-INV-${Date.now().toString(36).toUpperCase()}`,
      notes: `Invoice-based contract ${contract.contractNumber}`,
      quotedItems: {
        create: [
          {
            itemName: contract.title.slice(0, 200) || "Contract service",
            description: `Invoice ${params.invoiceNumber}`,
            quantity: 1,
            unit: "LS",
            unitPrice: amount,
            totalPrice: amount,
          },
        ],
      },
    },
  });

  const poNumber = await generatePONumber(vessel.id, requisitionType);

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      requisitionId: requisition.id,
      quoteId: quote.id,
      vesselId: vessel.id,
      vesselName: vessel.name || "Unknown Vessel",
      dateOfIssue: now,
      totalAmount: amount,
      currency: params.currency || contract.currency || "USD",
      status: "ACTIVE",
      completionStatus: "OPEN",
      contractId: contract.id,
      budgetCode: params.accountType ?? undefined,
      levelOneApprovedAt: now,
      levelOneApprovedBy: params.performedById,
      levelTwoApprovedAt: now,
      levelTwoApprovedBy: params.performedById,
      levelThreeApprovedAt: now,
      levelThreeApprovedBy: params.performedById,
    },
  });

  await prisma.purchaseOrderHistory.create({
    data: {
      purchaseOrderId: purchaseOrder.id,
      actionType: "CREATED",
      actionDescription: `PO ${poNumber} auto-created for invoice-based contract ${contract.contractNumber} (no PO approval required)`,
      newStatus: "ACTIVE",
      performedById: params.performedById,
    },
  });

  return {
    purchaseOrderId: purchaseOrder.id,
    poNumber: purchaseOrder.poNumber,
    quoteId: quote.id,
    requisitionId: requisition.id,
  };
}

export async function isPurchaseOrderInvoiceBasedContract(
  purchaseOrderId: string
): Promise<boolean> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    select: {
      contract: { select: { contractType: true } },
    },
  });
  return isInvoiceBasedContractType(po?.contract?.contractType);
}
