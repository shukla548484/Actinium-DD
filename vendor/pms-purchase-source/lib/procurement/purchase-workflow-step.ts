export type PurchaseWorkflowStep = {
  step: number;
  title: string;
  description: string;
  approverName?: string;
  approvedAt?: string;
  status: "completed" | "current" | "pending" | "waiting" | "not_required";
  /** PO tier level (1–3) when this step supports tier approval actions. */
  poApprovalLevel?: number;
};

export function workflowMatrixCurrentStep(steps: PurchaseWorkflowStep[]): number {
  const current = steps.find((s) => s.status === "current");
  if (current) return current.step;
  if (steps.every((s) => s.status === "completed" || s.status === "not_required")) {
    return steps.length;
  }
  const firstPending = steps.find((s) => s.status === "pending");
  return firstPending ? Math.max(1, firstPending.step - 1) : 1;
}
