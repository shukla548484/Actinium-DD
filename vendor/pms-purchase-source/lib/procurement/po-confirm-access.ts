import {
  isAdminEquivalentAccessLevel,
  normalizeDesignationAccessLevel,
} from "@/lib/admin-access-level";

/** Purchasers who create / send POs. */
export const PO_CONFIRM_PURCHASER_LEVELS = [32, 33] as const;

/** Tier approvers who approve POs before vendor send. */
export const PO_TIER_APPROVER_LEVELS = [37, 39, 41, 44, 46, 47, 48] as const;

export function isPoTierApproverLevel(
  level: number | string | null | undefined
): boolean {
  const n = normalizeDesignationAccessLevel(level);
  return n != null && (PO_TIER_APPROVER_LEVELS as readonly number[]).includes(n);
}

export function isPoConfirmPurchaserLevel(
  level: number | string | null | undefined
): boolean {
  const n = normalizeDesignationAccessLevel(level);
  return n != null && (PO_CONFIRM_PURCHASER_LEVELS as readonly number[]).includes(n);
}

/** View confirm / approval page. Purchasers always; tier approvers only when a PO exists. */
export function canAccessPoConfirmData(
  level: number | string | null | undefined,
  options: { poExists: boolean }
): boolean {
  const n = normalizeDesignationAccessLevel(level);
  if (n == null) return false;
  if (isAdminEquivalentAccessLevel(n)) return true;
  if (isPoConfirmPurchaserLevel(n)) return true;
  if (options.poExists && isPoTierApproverLevel(n)) return true;
  return false;
}

/** Send PO email to vendor — purchasers and admins only. */
export function canSendPoToVendor(
  level: number | string | null | undefined
): boolean {
  const n = normalizeDesignationAccessLevel(level);
  if (n == null) return false;
  if (isAdminEquivalentAccessLevel(n)) return true;
  return isPoConfirmPurchaserLevel(n);
}

export function poConfirmAccessMode(
  level: number | string | null | undefined,
  options: { poExists: boolean }
): "admin" | "purchaser" | "approver" | "denied" {
  const n = normalizeDesignationAccessLevel(level);
  if (n == null || !canAccessPoConfirmData(n, options)) return "denied";
  if (isAdminEquivalentAccessLevel(n)) return "admin";
  if (isPoConfirmPurchaserLevel(n)) return "purchaser";
  return "approver";
}

type PoApprovalTierStatus = {
  level: number;
  status: "PENDING" | "APPROVED" | "NOT_REQUIRED" | string;
};

/** First tier still awaiting approval. */
export function resolvePendingPoApprovalLevel(
  approvalStatus: ReadonlyArray<PoApprovalTierStatus>
): number | null {
  const pending = approvalStatus.find((s) => s.status === "PENDING");
  return pending?.level ?? null;
}

/** Whether the signed-in user may approve the current pending PO tier. */
export function canUserApprovePendingPoLevel(
  userAccessLevel: number | string | null | undefined,
  approvalStatus: ReadonlyArray<PoApprovalTierStatus>,
  policy?: {
    level1AccessLevels: number[];
    level2AccessLevels: number[];
    level3AccessLevels: number[];
  }
): { canApprove: boolean; level: number | null } {
  const n = normalizeDesignationAccessLevel(userAccessLevel);
  if (n == null) return { canApprove: false, level: null };

  const pendingLevel = resolvePendingPoApprovalLevel(approvalStatus);
  if (pendingLevel == null) return { canApprove: false, level: null };

  if (isAdminEquivalentAccessLevel(n)) {
    return { canApprove: true, level: pendingLevel };
  }

  const level1 = policy?.level1AccessLevels ?? [37, 39];
  const level2 = policy?.level2AccessLevels ?? [41, 44];
  const level3 = policy?.level3AccessLevels ?? [46, 47, 48];

  if (pendingLevel === 1 && level1.includes(n)) {
    return { canApprove: true, level: 1 };
  }
  if (pendingLevel === 2 && level2.includes(n)) {
    return { canApprove: true, level: 2 };
  }
  if (pendingLevel === 3 && level3.includes(n)) {
    return { canApprove: true, level: 3 };
  }
  return { canApprove: false, level: pendingLevel };
}
