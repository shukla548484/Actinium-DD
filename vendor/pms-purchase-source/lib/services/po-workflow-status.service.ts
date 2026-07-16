import type { PoApprovalPolicy } from "@/lib/services/po-approval-policy.service";
import {
  PurchaseOrderWorkflowStatus,
  PO_LEGACY_ACTIVE,
  PO_LEGACY_CANCELLED,
} from "@/lib/types/purchase-order-workflow";

export type PoApprovalTierState = {
  levelOneApprovedAt: Date | null;
  levelTwoApprovedAt: Date | null;
  levelThreeApprovedAt: Date | null;
};

export function poRequiresTierApproval(
  totalAmount: number,
  policy: PoApprovalPolicy
): boolean {
  return totalAmount >= policy.thresholdLevel2;
}

export function poRequiresThreeTiers(
  totalAmount: number,
  policy: PoApprovalPolicy
): boolean {
  return totalAmount >= policy.thresholdLevel3;
}

/** Initial workflow when purchaser (32/33) creates a PO record — always awaits L1 before send. */
export function resolveWorkflowStatusOnCreate(
  _totalAmount: number,
  _policy: PoApprovalPolicy
): PurchaseOrderWorkflowStatus {
  return PurchaseOrderWorkflowStatus.PO_CREATED;
}

/** @deprecated Use {@link resolveWorkflowStatusOnCreate} — PO stays at PO_CREATED until L1 approves. */
export function resolveWorkflowAfterCreateRouting(
  totalAmount: number,
  policy: PoApprovalPolicy
): PurchaseOrderWorkflowStatus {
  return resolveWorkflowStatusOnCreate(totalAmount, policy);
}

/** Workflow status after a tier approval is recorded. */
export function resolveWorkflowStatusAfterApproval(
  po: PoApprovalTierState,
  totalAmount: number,
  policy: PoApprovalPolicy
): PurchaseOrderWorkflowStatus {
  const needsTwo = poRequiresTierApproval(totalAmount, policy);
  const needsThree = poRequiresThreeTiers(totalAmount, policy);

  if (!po.levelOneApprovedAt) {
    return PurchaseOrderWorkflowStatus.PO_CREATED;
  }
  if (!needsTwo) {
    return PurchaseOrderWorkflowStatus.PO_CONFIRMED;
  }
  if (!po.levelTwoApprovedAt) {
    return PurchaseOrderWorkflowStatus.PO_LVL2_APPROVAL;
  }
  if (needsThree && !po.levelThreeApprovedAt) {
    return PurchaseOrderWorkflowStatus.PO_LVL3_APPROVAL;
  }
  return PurchaseOrderWorkflowStatus.PO_CONFIRMED;
}

/** Which approval level (1–3) matches the current workflow status. */
export function approvalLevelForWorkflowStatus(
  workflowStatus: string
): 1 | 2 | 3 | null {
  switch (workflowStatus) {
    case PurchaseOrderWorkflowStatus.PO_CREATED:
    case PurchaseOrderWorkflowStatus.PO_LVL1_APPROVAL:
      return 1;
    case PurchaseOrderWorkflowStatus.PO_LVL2_APPROVAL:
      return 2;
    case PurchaseOrderWorkflowStatus.PO_LVL3_APPROVAL:
      return 3;
    default:
      return null;
  }
}

/** Access levels allowed to reject at the current workflow stage. */
export function rejectAccessLevelsForWorkflow(
  workflowStatus: string,
  policy: PoApprovalPolicy
): number[] {
  const level = approvalLevelForWorkflowStatus(workflowStatus);
  if (level === 1) return [...policy.level1AccessLevels, 50, 99, 100];
  if (level === 2) return [...policy.level2AccessLevels, 50, 99, 100];
  if (level === 3) return [...policy.level3AccessLevels, 50, 99, 100];
  return [];
}

export type PoRejectWorkflowResult = {
  workflowStatus: PurchaseOrderWorkflowStatus;
  clearLevelOne: boolean;
  clearLevelTwo: boolean;
  clearLevelThree: boolean;
  /** Any tier rejection removes the PO and returns work to purchaser (32/33) to re-create. */
  removePo: boolean;
};

/** Workflow + tier fields after rejection at a level — always returns to purchaser for new PO. */
export function resolveWorkflowStatusAfterReject(
  _rejectedLevel: 1 | 2 | 3
): PoRejectWorkflowResult {
  return {
    workflowStatus: PurchaseOrderWorkflowStatus.CANCELLED,
    clearLevelOne: true,
    clearLevelTwo: true,
    clearLevelThree: true,
    removePo: true,
  };
}

export function legacyStatusForWorkflow(
  workflowStatus: PurchaseOrderWorkflowStatus
): string {
  return workflowStatus === PurchaseOrderWorkflowStatus.CANCELLED
    ? PO_LEGACY_CANCELLED
    : PO_LEGACY_ACTIVE;
}

/** Infer workflow from tier timestamps when column missing (read paths). */
export function inferWorkflowStatusFromTiers(
  po: PoApprovalTierState & {
    workflowStatus?: string | null;
    status?: string | null;
  },
  totalAmount: number,
  policy: PoApprovalPolicy,
  requisitionStatus?: string | null
): PurchaseOrderWorkflowStatus {
  if (po.workflowStatus && po.workflowStatus in PurchaseOrderWorkflowStatus) {
    return po.workflowStatus as PurchaseOrderWorkflowStatus;
  }
  if (po.status === PO_LEGACY_CANCELLED) {
    return PurchaseOrderWorkflowStatus.CANCELLED;
  }
  if (requisitionStatus === "QUOTE_CONFIRMED_PO_SENT") {
    return PurchaseOrderWorkflowStatus.PO_SENT;
  }
  return resolveWorkflowStatusAfterApproval(po, totalAmount, policy);
}
