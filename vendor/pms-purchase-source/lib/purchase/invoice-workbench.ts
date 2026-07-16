import { isDeliveryNoteUploaded } from "@/lib/purchase/delivery-note-status";
import { purchaseOrderDetailsText } from "@/lib/purchase/po-requisition-display";
import {
  canUploadPurchaseInvoice,
  canViewInvoiceApprovalWorkbench,
  canUserActOnInvoiceApproval,
  hasUserCompletedInvoiceApprovalTier,
  invoiceApprovalBlockedReason,
  invoiceNeedsPurchaserCorrection,
  invoicePendingApprovalDisplayStatus,
} from "@/lib/purchase/invoice-access";
import type { InvoiceApprovalLevelConfig } from "@/lib/purchase/invoice-access";

export const DN_NOT_MANDATORY_TYPES = ["SER", "REP", "CTM", "OTR"] as const;

export type InvoiceWorkbenchInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceAmount: number;
  originalInvoiceAmount?: number | null;
  fxRateToUsd?: number | null;
  fxRateSource?: string | null;
  currency: string;
  accountType: string | null;
  status: string;
  invoiceFileUrl: string | null;
  ownerApprovalFileUrl?: string | null;
  ownerApprovalFileName?: string | null;
  levelOneApprovedAt?: string | null;
  levelTwoApprovedAt?: string | null;
  levelThreeApprovedAt?: string | null;
  levelFourApprovedAt?: string | null;
  purchaseOrderId: string | null;
  createdAt: string;
  vendor: { id: string; name: string };
};

export type InvoiceWorkbenchPo = {
  id: string;
  poNumber: string;
  totalAmount?: number | null;
  currency?: string;
  requisition: {
    id: string;
    requisitionNumber: string;
    heading: string;
    description?: string | null;
    requisitionType: string;
    portOfSupply?: string | null;
    vessel?: { id?: string; name: string; code: string } | null;
  };
  quote: {
    id: string;
    vendor: { id: string; name: string };
  };
  deliveryNote?: {
    id: string;
    status: string;
    deliveryNoteNumber?: string;
  } | null;
};

export type InvoiceWorkbenchRow = {
  purchaseOrderId: string;
  poNumber: string;
  requisitionNumber: string;
  poDetails: string;
  vendorName: string;
  vesselId: string;
  vesselName: string;
  poIssuedAmount: number | null;
  poIssuedCurrency: string;
  quoteId: string;
  deliveryNoteId: string | null;
  invoice: InvoiceWorkbenchInvoice | null;
  displayStatus: string;
  unreadVendorReplyCount?: number;
  actions: {
    canUploadInvoice: boolean;
    canEdit: boolean;
    canReloadEdit: boolean;
    canReuploadDn: boolean;
    reloadEditBlockedReason?: string;
    canViewDownload: boolean;
    canViewDetails: boolean;
    canApproveReject: boolean;
    approveRejectBlockedReason?: string;
    canEmailSupplier: boolean;
    canEmailVessel: boolean;
    canViewPlatformMessages: boolean;
  };
};

export function isDnReadyForInvoicing(
  deliveryNote: { status: string } | null | undefined,
  requisitionType: string
): boolean {
  if (DN_NOT_MANDATORY_TYPES.includes(requisitionType as (typeof DN_NOT_MANDATORY_TYPES)[number])) {
    return true;
  }
  return deliveryNote != null && isDeliveryNoteUploaded(deliveryNote.status);
}

export function isInvoiceBeyondPurchaserEditStage(
  invoice: InvoiceWorkbenchInvoice
): boolean {
  if (invoiceNeedsPurchaserCorrection(invoice.status)) return false;
  if (invoice.levelTwoApprovedAt) return true;
  return (
    invoice.status === "LEVEL_TWO_APPROVED" ||
    invoice.status === "LEVEL_THREE_APPROVED" ||
    invoice.status === "LEVEL_FOUR_APPROVED" ||
    invoice.status === "READY_FOR_PAYMENT" ||
    invoice.status === "PAID"
  );
}

/** @deprecated Use isInvoiceBeyondPurchaserEditStage — kept for callers expecting the old name. */
export function hasInvoicePassedLevelOne(invoice: InvoiceWorkbenchInvoice): boolean {
  return isInvoiceBeyondPurchaserEditStage(invoice);
}

export function canModifyUploadedInvoice(invoice: InvoiceWorkbenchInvoice | null): boolean {
  if (!invoice) return false;
  if (invoice.status === "CANCELLED" || invoice.status === "PAID") return false;
  if (invoice.status === "READY_FOR_PAYMENT") return false;
  if (invoiceNeedsPurchaserCorrection(invoice.status)) return true;
  if (invoice.status === "LEVEL_ONE_APPROVED" && !invoice.levelTwoApprovedAt) {
    return true;
  }
  return false;
}

export function invoiceWorkbenchDisplayStatus(invoice: InvoiceWorkbenchInvoice | null): string {
  if (!invoice) return "Awaiting invoice upload";
  if (invoiceNeedsPurchaserCorrection(invoice.status)) {
    return "Returned — pending correction";
  }
  const pendingLabel = invoicePendingApprovalDisplayStatus(invoice.status);
  if (pendingLabel) return pendingLabel;
  const labels: Record<string, string> = {
    LEVEL_ONE_APPROVED: "L1 approved — awaiting L2",
    LEVEL_TWO_APPROVED: "L2 approved",
    LEVEL_THREE_APPROVED: "L3 approved",
    LEVEL_FOUR_APPROVED: "L4 approved",
    READY_FOR_PAYMENT: "Ready for payment",
    PAID: "Paid",
    CANCELLED: "Cancelled",
  };
  return labels[invoice.status] ?? invoice.status.replace(/_/g, " ");
}

export function buildInvoiceWorkbenchRow(
  po: InvoiceWorkbenchPo,
  invoice: InvoiceWorkbenchInvoice | null,
  options?: {
    userAccessLevel?: number | null;
    approvalLevels?: InvoiceApprovalLevelConfig;
  }
): InvoiceWorkbenchRow {
  const userLevel = options?.userAccessLevel ?? null;
  const levels = options?.approvalLevels;
  const isUploader = canUploadPurchaseInvoice(userLevel);
  const isVerifier = canViewInvoiceApprovalWorkbench(userLevel);

  const canModify = isUploader && canModifyUploadedInvoice(invoice);
  const beyondPurchaserEdit =
    invoice != null && isInvoiceBeyondPurchaserEditStage(invoice);

  const canActOnApproval =
    invoice != null &&
    levels != null &&
    isVerifier &&
    canUserActOnInvoiceApproval(userLevel, invoice.status, levels) &&
    !hasUserCompletedInvoiceApprovalTier(userLevel, invoice, levels);

  const tierCompleted =
    invoice != null &&
    levels != null &&
    isVerifier &&
    hasUserCompletedInvoiceApprovalTier(userLevel, invoice, levels);

  return {
    purchaseOrderId: po.id,
    poNumber: po.poNumber,
    requisitionNumber: po.requisition.requisitionNumber,
    poDetails: purchaseOrderDetailsText(po.requisition),
    vendorName: po.quote.vendor.name,
    vesselId: po.requisition.vessel?.id ?? "",
    vesselName: po.requisition.vessel
      ? `${po.requisition.vessel.name} (${po.requisition.vessel.code})`
      : "",
    poIssuedAmount: po.totalAmount ?? null,
    poIssuedCurrency: (po.currency || "USD").toUpperCase(),
    quoteId: po.quote.id,
    deliveryNoteId: po.deliveryNote?.id ?? null,
    invoice,
    displayStatus: invoiceWorkbenchDisplayStatus(invoice),
    actions: {
      canUploadInvoice: isUploader && !invoice,
      canEdit: canModify,
      canReloadEdit: canModify,
      canReuploadDn: isUploader && Boolean(po.deliveryNote?.id),
      reloadEditBlockedReason: beyondPurchaserEdit
        ? "L2 approval completed — invoice cannot be edited or reloaded."
        : invoice && isUploader && !canModify
          ? "Invoice cannot be edited in its current approval stage."
          : undefined,
      canViewDownload: Boolean(invoice?.invoiceFileUrl),
      canViewDetails: Boolean(invoice),
      canApproveReject: Boolean(canActOnApproval),
      approveRejectBlockedReason:
        invoice != null && levels != null && isVerifier
          ? invoiceApprovalBlockedReason(
              userLevel,
              invoice.status,
              levels,
              Boolean(canActOnApproval),
              Boolean(tierCompleted)
            )
          : undefined,
      canEmailSupplier: Boolean(invoice),
      canEmailVessel: Boolean(invoice),
      canViewPlatformMessages: Boolean(invoice),
    },
  };
}

export function isPoEligibleForInvoiceWorkbench(
  po: InvoiceWorkbenchPo,
  invoice: InvoiceWorkbenchInvoice | null,
  userAccessLevel?: number | null
): boolean {
  if (!isDnReadyForInvoicing(po.deliveryNote, po.requisition.requisitionType)) {
    return false;
  }

  if (canViewInvoiceApprovalWorkbench(userAccessLevel)) {
    if (!invoice) return false;
    if (invoice.status === "CANCELLED" || invoice.status === "PAID") return false;
    if (invoice.status === "READY_FOR_PAYMENT") return true;
    return (
      invoice.status === "READY_FOR_APPROVAL" ||
      invoice.status === "RETURNED" ||
      invoice.status.startsWith("LEVEL_")
    );
  }

  if (!canUploadPurchaseInvoice(userAccessLevel)) {
    return false;
  }

  if (!invoice) return true;
  if (invoice.status === "CANCELLED" || invoice.status === "PAID") return false;
  if (invoice.status === "READY_FOR_PAYMENT") return false;
  return canModifyUploadedInvoice(invoice);
}

export function buildInvoiceWorkbenchRows(
  purchaseOrders: InvoiceWorkbenchPo[],
  invoices: InvoiceWorkbenchInvoice[],
  options?: {
    userAccessLevel?: number | null;
    approvalLevels?: InvoiceApprovalLevelConfig;
  }
): InvoiceWorkbenchRow[] {
  const latestByPo = new Map<string, InvoiceWorkbenchInvoice>();
  for (const inv of invoices) {
    const poId = inv.purchaseOrderId;
    if (!poId || inv.status === "CANCELLED") continue;
    const existing = latestByPo.get(poId);
    if (!existing || new Date(inv.createdAt) > new Date(existing.createdAt)) {
      latestByPo.set(poId, inv);
    }
  }

  return purchaseOrders
    .map((po) => {
      const invoice = latestByPo.get(po.id) ?? null;
      if (!isPoEligibleForInvoiceWorkbench(po, invoice, options?.userAccessLevel)) {
        return null;
      }
      return buildInvoiceWorkbenchRow(po, invoice, options);
    })
    .filter((row): row is InvoiceWorkbenchRow => row != null)
    .sort((a, b) => a.poNumber.localeCompare(b.poNumber));
}

export function mapPoListRecordToWorkbenchPo(po: Record<string, unknown>): InvoiceWorkbenchPo {
  const requisition = (po.requisition ?? {}) as Record<string, unknown>;
  const quote = (po.quote ?? {}) as Record<string, unknown>;
  const vendor = (quote.vendor ?? {}) as Record<string, unknown>;
  const dn = po.deliveryNote as Record<string, unknown> | null | undefined;

  return {
    id: String(po.id),
    poNumber: String(po.poNumber),
    totalAmount: po.totalAmount != null ? Number(po.totalAmount) : null,
    currency: po.currency != null ? String(po.currency) : undefined,
    requisition: {
      id: String(requisition.id ?? ""),
      requisitionNumber: String(requisition.requisitionNumber ?? ""),
      heading: String(requisition.heading ?? ""),
      description: (requisition.description as string) || null,
      requisitionType: String(requisition.requisitionType ?? ""),
      portOfSupply: (requisition.portOfSupply as string) || null,
      vessel: requisition.vessel
        ? {
            id: String((requisition.vessel as { id?: string }).id ?? ""),
            name: String((requisition.vessel as { name?: string }).name ?? ""),
            code: String((requisition.vessel as { code?: string }).code ?? ""),
          }
        : null,
    },
    quote: {
      id: String(quote.id ?? ""),
      vendor: {
        id: String(vendor.id ?? ""),
        name: String(vendor.name ?? ""),
      },
    },
    deliveryNote: dn
      ? {
          id: String(dn.id ?? ""),
          status: String(dn.status ?? ""),
          deliveryNoteNumber: dn.deliveryNoteNumber as string | undefined,
        }
      : null,
  };
}
