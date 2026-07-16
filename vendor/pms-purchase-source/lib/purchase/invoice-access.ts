import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";

export type InvoiceApprovalLevelConfig = {
  level1AccessLevels: number[];
  level2AccessLevels: number[];
  level3AccessLevels: number[];
  level4AccessLevels: number[];
};

/** Client-safe default; server may override per company/vessel. */
export const DEFAULT_INVOICE_APPROVAL_LEVELS: InvoiceApprovalLevelConfig = {
  level1AccessLevels: [32, 33],
  level2AccessLevels: [37, 38, 39, 40],
  level3AccessLevels: [44],
  level4AccessLevels: [48],
};

/** Office purchasers who upload invoices (levels 32–33 only). */
export const INVOICE_UPLOADER_ACCESS_LEVELS = [32, 33] as const;

/** Default shore verifier tiers (config may override per company/vessel). */
export const INVOICE_VERIFIER_ACCESS_LEVELS = [37, 38, 39, 40, 44, 48] as const;

export function canUploadPurchaseInvoice(
  accessLevel: number | null | undefined
): boolean {
  const n = accessLevel ?? 0;
  return INVOICE_UPLOADER_ACCESS_LEVELS.includes(
    n as (typeof INVOICE_UPLOADER_ACCESS_LEVELS)[number]
  );
}

export function isInvoiceVerifierAccessLevel(
  accessLevel: number | null | undefined
): boolean {
  const n = accessLevel ?? 0;
  if (isAdminEquivalentAccessLevel(n)) return true;
  return INVOICE_VERIFIER_ACCESS_LEVELS.includes(
    n as (typeof INVOICE_VERIFIER_ACCESS_LEVELS)[number]
  );
}

/**
 * Verifier tier pending approval. Upload by purchasers (32/33) auto-completes L1,
 * so READY_FOR_APPROVAL / RETURNED are purchaser-correction stages — not verifier tiers.
 */
export function invoicePendingLevelFromStatus(
  status: string
): 1 | 2 | 3 | 4 | null {
  switch (status) {
    case "LEVEL_ONE_APPROVED":
      return 2;
    case "LEVEL_TWO_APPROVED":
      return 3;
    case "LEVEL_THREE_APPROVED":
      return 4;
    default:
      return null;
  }
}

export function invoiceNeedsPurchaserCorrection(status: string): boolean {
  return status === "READY_FOR_APPROVAL" || status === "RETURNED";
}

/** Fields applied when a purchaser uploads or re-submits after correction (auto L1). */
export function buildAutoLevelOneApprovalFields(
  userId: string,
  now: Date = new Date()
): {
  status: "LEVEL_ONE_APPROVED";
  currentApprovalLevel: "LEVEL_TWO";
  levelOneApprovedAt: Date;
  levelOneApprovedBy: string;
  lastReturnedBy: null;
  lastReturnedAt: null;
  lastReturnRemarks: null;
} {
  return {
    status: "LEVEL_ONE_APPROVED",
    currentApprovalLevel: "LEVEL_TWO",
    levelOneApprovedAt: now,
    levelOneApprovedBy: userId,
    // Clear return markers so the original returner can verify the resubmitted invoice.
    lastReturnedBy: null,
    lastReturnedAt: null,
    lastReturnRemarks: null,
  };
}

/**
 * User who referred an invoice back must not Verify the same cycle
 * (return resets status to L2-pending, which would otherwise allow them to approve again).
 */
export function hasUserReturnedInvoiceAwaitingResubmit(
  userId: string | null | undefined,
  invoice: { lastReturnedBy?: string | null } | null | undefined
): boolean {
  return Boolean(userId && invoice?.lastReturnedBy && invoice.lastReturnedBy === userId);
}

export function accessLevelsForInvoicePendingLevel(
  levels: InvoiceApprovalLevelConfig,
  pendingLevel: 1 | 2 | 3 | 4
): number[] {
  switch (pendingLevel) {
    case 1:
      return levels.level1AccessLevels;
    case 2:
      return levels.level2AccessLevels;
    case 3:
      return levels.level3AccessLevels;
    case 4:
      return levels.level4AccessLevels;
    default:
      return [];
  }
}

/** Whether this user may approve/reject at the invoice's current pending tier. */
export function canUserActOnInvoiceApproval(
  userAccessLevel: number | null | undefined,
  invoiceStatus: string,
  levels: InvoiceApprovalLevelConfig
): boolean {
  const n = userAccessLevel ?? 0;
  if (isAdminEquivalentAccessLevel(n)) return true;
  const pending = invoicePendingLevelFromStatus(invoiceStatus);
  if (!pending) return false;
  return accessLevelsForInvoicePendingLevel(levels, pending).includes(n);
}

/** User already completed their tier (e.g. L2 done for level-37 user). */
export function hasUserCompletedInvoiceApprovalTier(
  userAccessLevel: number | null | undefined,
  invoice: {
    status: string;
    levelOneApprovedAt?: string | null;
    levelTwoApprovedAt?: string | null;
    levelThreeApprovedAt?: string | null;
    levelFourApprovedAt?: string | null;
  },
  levels: InvoiceApprovalLevelConfig
): boolean {
  const n = userAccessLevel ?? 0;
  if (isAdminEquivalentAccessLevel(n)) return false;

  if (invoiceNeedsPurchaserCorrection(invoice.status)) {
    return false;
  }

  if (levels.level2AccessLevels.includes(n) && invoice.levelTwoApprovedAt) {
    return true;
  }
  if (levels.level3AccessLevels.includes(n) && invoice.levelThreeApprovedAt) {
    return true;
  }
  if (levels.level4AccessLevels.includes(n) && invoice.levelFourApprovedAt) {
    return true;
  }
  return false;
}

const PENDING_APPROVAL_TIER_LABELS: Record<2 | 3 | 4, string> = {
  2: "L2",
  3: "L3",
  4: "L4",
};

/** Why approve/reject is disabled for a verifier who cannot act on the current tier. */
export function invoiceApprovalBlockedReason(
  userAccessLevel: number | null | undefined,
  invoiceStatus: string,
  levels: InvoiceApprovalLevelConfig,
  canActOnApproval: boolean,
  tierCompleted: boolean
): string | undefined {
  if (tierCompleted) {
    return "You have already approved this invoice at your level.";
  }
  if (canActOnApproval || !isInvoiceVerifierAccessLevel(userAccessLevel)) {
    return undefined;
  }
  const pending = invoicePendingLevelFromStatus(invoiceStatus);
  if (!pending) return undefined;
  return `Pending ${PENDING_APPROVAL_TIER_LABELS[pending]} approval — not your tier yet.`;
}

export function invoicePendingApprovalDisplayStatus(invoiceStatus: string): string | null {
  const pending = invoicePendingLevelFromStatus(invoiceStatus);
  if (!pending) return null;
  return `L${pending} Aprvl Pend.`;
}

export function canViewInvoiceApprovalWorkbench(
  accessLevel: number | null | undefined
): boolean {
  return isInvoiceVerifierAccessLevel(accessLevel);
}
