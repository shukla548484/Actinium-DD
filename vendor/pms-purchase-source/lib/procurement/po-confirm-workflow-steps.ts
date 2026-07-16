import "server-only";

import { prisma } from "@/lib/prisma";
import { PurchaseOrderWorkflowStatus } from "@/lib/types/purchase-order-workflow";
import { PurchaseHistoryActionType } from "@/lib/services/purchase-history.service";
import type { PurchaseWorkflowStep } from "@/lib/procurement/purchase-workflow-step";

export type { PurchaseWorkflowStep } from "@/lib/procurement/purchase-workflow-step";

type ApprovalStatus = {
  level: number;
  status: "PENDING" | "APPROVED" | "NOT_REQUIRED";
  approverName?: string;
  approvedAt?: string;
};

function employeeName(
  row: { firstName: string; lastName: string } | null | undefined
): string | undefined {
  if (!row) return undefined;
  const name = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim();
  return name || undefined;
}

function tierStepStatus(
  tier: ApprovalStatus | undefined,
  priorComplete: boolean
): PurchaseWorkflowStep["status"] {
  if (!tier) return "pending";
  if (tier.status === "APPROVED") return "completed";
  if (tier.status === "NOT_REQUIRED") {
    // Prior tier incomplete — blocked, not skipped.
    return priorComplete ? "not_required" : "waiting";
  }
  if (priorComplete) return "current";
  return "pending";
}

export async function buildPoConfirmWorkflowSteps(input: {
  requisitionId: string;
  quoteId: string;
  poId: string | null;
  poNumber: string | null;
  vendorName?: string;
  requiresApproval: boolean;
  requiresThreeApprovals: boolean;
  approvalStatus: ApprovalStatus[];
  workflowStatus: string | null;
  readyToSend: boolean;
}): Promise<PurchaseWorkflowStep[]> {
  const quoteApproval = await prisma.purchaseHistory.findFirst({
    where: {
      requisitionId: input.requisitionId,
      actionType: PurchaseHistoryActionType.QUOTE_APPROVED,
    },
    orderBy: { createdAt: "desc" },
    include: {
      performedBy: { select: { firstName: true, lastName: true, designation: true } },
    },
  });

  let poCreatedAt: string | undefined;
  let poCreatedByName: string | undefined;
  if (input.poId) {
    const created = await prisma.purchaseOrderHistory.findFirst({
      where: { purchaseOrderId: input.poId, actionType: "CREATED" },
      orderBy: { createdAt: "asc" },
      include: {
        performedBy: { select: { firstName: true, lastName: true } },
      },
    });
    poCreatedAt = created?.createdAt?.toISOString();
    poCreatedByName = employeeName(created?.performedBy);
  }

  const quoteApprover =
    employeeName(quoteApproval?.performedBy) ??
    quoteApproval?.performedBy?.designation ??
    "Quote approver";

  const steps: PurchaseWorkflowStep[] = [];
  let stepNum = 1;

  steps.push({
    step: stepNum++,
    title: "Quote Approved",
    description: input.vendorName ? `Vendor: ${input.vendorName}` : "Vendor quote approved",
    approverName: quoteApprover,
    approvedAt: quoteApproval?.createdAt?.toISOString(),
    status: quoteApproval ? "completed" : input.poId ? "completed" : "pending",
  });

  const poCreated = Boolean(input.poId);
  steps.push({
    step: stepNum++,
    title: "PO Created",
    description: input.poNumber ? `PO ${input.poNumber}` : "Purchase order record",
    approverName: poCreatedByName,
    approvedAt: poCreatedAt,
    status: poCreated ? "completed" : "pending",
  });

  const l1 = input.approvalStatus.find((s) => s.level === 1);
  const l2 = input.approvalStatus.find((s) => s.level === 2);
  const l3 = input.approvalStatus.find((s) => s.level === 3);

  const l1Status = tierStepStatus(l1, true);
  steps.push({
    step: stepNum++,
    title: "PO L1 Approval",
    description: "Level 37 / 39",
    approverName: l1?.approverName,
    approvedAt: l1?.approvedAt,
    status: l1Status,
    poApprovalLevel: 1,
  });

  if (input.requiresApproval) {
    const l2Status = tierStepStatus(l2, l1?.status === "APPROVED");
    steps.push({
      step: stepNum++,
      title: "PO L2 Approval",
      description: "Level 41 / 44",
      approverName: l2?.approverName,
      approvedAt: l2?.approvedAt,
      status: l2Status,
      poApprovalLevel: 2,
    });
    if (input.requiresThreeApprovals) {
      const l3Status = tierStepStatus(l3, l2?.status === "APPROVED");
      steps.push({
        step: stepNum++,
        title: "PO L3 Approval",
        description: "Level 46 / 47 / 48",
        approverName: l3?.approverName,
        approvedAt: l3?.approvedAt,
        status: l3Status,
        poApprovalLevel: 3,
      });
    }
  }

  const sent = input.workflowStatus === PurchaseOrderWorkflowStatus.PO_SENT;
  const confirmed = input.readyToSend || sent;

  steps.push({
    step: stepNum++,
    title: "PO Confirmed",
    description: "Ready to send to vendor",
    status: sent ? "completed" : confirmed ? "completed" : "pending",
  });

  steps.push({
    step: stepNum++,
    title: "PO Sent",
    description: "Emailed to vendor",
    status: sent ? "completed" : confirmed ? "current" : "pending",
  });

  if (!steps.some((s) => s.status === "current")) {
    const firstPending = steps.find((s) => s.status === "pending");
    if (firstPending) firstPending.status = "current";
  }

  return steps;
}
