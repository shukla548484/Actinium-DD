/** PO workflow statuses per procurement spec (Created → L1 → L2 → L3 → Confirmed → Sent). */
export const PurchaseOrderWorkflowStatus = {
  PO_CREATED: "PO_CREATED",
  PO_LVL1_APPROVAL: "PO_LVL1_APPROVAL",
  PO_LVL2_APPROVAL: "PO_LVL2_APPROVAL",
  PO_LVL3_APPROVAL: "PO_LVL3_APPROVAL",
  PO_CONFIRMED: "PO_CONFIRMED",
  PO_SENT: "PO_SENT",
  CANCELLED: "CANCELLED",
} as const;

export type PurchaseOrderWorkflowStatus =
  (typeof PurchaseOrderWorkflowStatus)[keyof typeof PurchaseOrderWorkflowStatus];

export const PO_WORKFLOW_STATUS_LABELS: Record<PurchaseOrderWorkflowStatus, string> = {
  PO_CREATED: "PO Created",
  PO_LVL1_APPROVAL: "PO LVL1 Approval",
  PO_LVL2_APPROVAL: "PO LVL2 Approval",
  PO_LVL3_APPROVAL: "PO LVL3 Approval",
  PO_CONFIRMED: "PO Confirmed",
  PO_SENT: "PO Sent",
  CANCELLED: "Cancelled",
};

/** Legacy `status` column: ACTIVE unless cancelled. */
export const PO_LEGACY_ACTIVE = "ACTIVE";
export const PO_LEGACY_CANCELLED = "CANCELLED";

export const PO_OPEN_WORKFLOW_STATUSES: PurchaseOrderWorkflowStatus[] = [
  PurchaseOrderWorkflowStatus.PO_CREATED,
  PurchaseOrderWorkflowStatus.PO_LVL1_APPROVAL,
  PurchaseOrderWorkflowStatus.PO_LVL2_APPROVAL,
  PurchaseOrderWorkflowStatus.PO_LVL3_APPROVAL,
  PurchaseOrderWorkflowStatus.PO_CONFIRMED,
  PurchaseOrderWorkflowStatus.PO_SENT,
];

export function isPoWorkflowCancelled(
  workflowStatus: string | null | undefined
): boolean {
  return workflowStatus === PurchaseOrderWorkflowStatus.CANCELLED;
}

export function isPoSent(workflowStatus: string | null | undefined): boolean {
  return workflowStatus === PurchaseOrderWorkflowStatus.PO_SENT;
}

export function poWorkflowStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return (
    PO_WORKFLOW_STATUS_LABELS[status as PurchaseOrderWorkflowStatus] ?? status
  );
}

export type PoListStatusInput = {
  workflowStatus?: string | null;
  status?: string | null;
  levelOneApprovedAt?: Date | string | null;
  levelTwoApprovedAt?: Date | string | null;
  levelThreeApprovedAt?: Date | string | null;
  /** True when at least one invoice is linked to the PO. */
  hasInvoice?: boolean;
};

/** User-facing PO stage for list pages (L1/L2/L3 approved, awaiting tier, sent, etc.). */
export function poListDisplayStatus(po: PoListStatusInput): string {
  const l1 = Boolean(po.levelOneApprovedAt);
  const l2 = Boolean(po.levelTwoApprovedAt);
  const l3 = Boolean(po.levelThreeApprovedAt);
  const workflow = po.workflowStatus ?? PurchaseOrderWorkflowStatus.PO_CREATED;

  if (
    po.workflowStatus === PurchaseOrderWorkflowStatus.CANCELLED ||
    po.status === PO_LEGACY_CANCELLED
  ) {
    return "Cancelled";
  }
  if (po.workflowStatus === PurchaseOrderWorkflowStatus.PO_SENT) {
    if (l3) return "L3 Approved · Sent to Vendor";
    if (l2) return "L2 Approved · Sent to Vendor";
    if (l1) return "L1 Approved · Sent to Vendor";
    return "PO Sent to Vendor";
  }

  if (workflow === PurchaseOrderWorkflowStatus.PO_CONFIRMED) {
    if (l3) return "L3 Approved · Ready to Send";
    if (l2) return "L2 Approved · Ready to Send";
    if (l1) return "L1 Approved · Ready to Send";
    return "PO Confirmed";
  }

  if (l3) return "L3 Approved";
  if (l2) {
    if (workflow === PurchaseOrderWorkflowStatus.PO_LVL3_APPROVAL) {
      return "L2 Approved · Awaiting L3";
    }
    return "L2 Approved";
  }
  if (l1) {
    if (workflow === PurchaseOrderWorkflowStatus.PO_LVL2_APPROVAL) {
      return "L1 Approved · Awaiting L2";
    }
    return "L1 Approved";
  }

  if (workflow === PurchaseOrderWorkflowStatus.PO_LVL3_APPROVAL) {
    return "Awaiting L3 Approval";
  }
  if (workflow === PurchaseOrderWorkflowStatus.PO_LVL2_APPROVAL) {
    return "Awaiting L2 Approval";
  }
  return "Awaiting L1 Approval";
}

export function poWorkflowBadgeVariant(
  workflowStatus: string | null | undefined
): "default" | "secondary" | "destructive" {
  if (workflowStatus === PurchaseOrderWorkflowStatus.CANCELLED) return "destructive";
  if (workflowStatus === PurchaseOrderWorkflowStatus.PO_SENT) return "default";
  if (workflowStatus === PurchaseOrderWorkflowStatus.PO_CONFIRMED) return "default";
  return "secondary";
}

/** Badge variant for PO list rows: green sent, orange awaiting approval, blue invoiced. */
export function poListBadgeVariant(
  po: PoListStatusInput
): "success" | "warning" | "info" | "destructive" {
  if (
    po.workflowStatus === PurchaseOrderWorkflowStatus.CANCELLED ||
    po.status === PO_LEGACY_CANCELLED
  ) {
    return "destructive";
  }
  if (po.hasInvoice) {
    return "info";
  }
  if (po.workflowStatus === PurchaseOrderWorkflowStatus.PO_SENT) {
    return "success";
  }
  return "warning";
}
