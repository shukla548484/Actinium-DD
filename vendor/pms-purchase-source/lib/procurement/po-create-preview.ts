import type { PurchaseWorkflowStep } from "@/lib/procurement/purchase-workflow-step";

/** Workflow steps shown on Create PO before the PO record exists. */
export function buildPoCreatePreviewSteps(
  requiresApproval: boolean,
  requiresThreeApprovals: boolean,
  vendorName?: string
): PurchaseWorkflowStep[] {
  const steps: PurchaseWorkflowStep[] = [
    {
      step: 1,
      title: "Quote Approved",
      description: vendorName ? `Vendor: ${vendorName}` : "Vendor quote approved",
      status: "completed",
    },
    {
      step: 2,
      title: "PO Created",
      description: "Create purchase order record",
      status: "current",
    },
  ];

  let stepNum = 3;

  steps.push({
    step: stepNum++,
    title: "PO L1 Approval",
    description: "Level 37 / 39",
    status: "pending",
    poApprovalLevel: 1,
  });

  if (requiresApproval) {
    steps.push({
      step: stepNum++,
      title: "PO L2 Approval",
      description: "Level 41 / 44",
      status: "pending",
      poApprovalLevel: 2,
    });
    if (requiresThreeApprovals) {
      steps.push({
        step: stepNum++,
        title: "PO L3 Approval",
        description: "Level 46 / 47 / 48",
        status: "pending",
        poApprovalLevel: 3,
      });
    }
  }

  steps.push({
    step: stepNum++,
    title: "PO Confirmed",
    description: "Ready to send to vendor",
    status: "pending",
  });

  steps.push({
    step: stepNum,
    title: "PO Sent",
    description: "Emailed to vendor",
    status: "pending",
  });

  return steps;
}
