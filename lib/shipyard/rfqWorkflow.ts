import type { YardRfqWorkflowStage } from "@/lib/shipyard/workflow";
import { YARD_RFQ_WORKFLOW_STAGES, inferWorkflowStageFromInvite } from "@/lib/shipyard/workflow";

export type YardRfqPriority = "low" | "normal" | "high" | "urgent";

export const YARD_RFQ_PRIORITIES: YardRfqPriority[] = ["low", "normal", "high", "urgent"];

const STAGE_ORDER = Object.fromEntries(
  YARD_RFQ_WORKFLOW_STAGES.map((s) => [s.key, s.order]),
) as Record<YardRfqWorkflowStage, number>;

type InviteWorkflowFields = {
  status: string;
  workflowStage: string | null;
};

export function resolveYardInviteWorkflowStage(invite: InviteWorkflowFields): YardRfqWorkflowStage {
  if (invite.workflowStage && isYardRfqWorkflowStage(invite.workflowStage)) {
    return invite.workflowStage;
  }
  return inferWorkflowStageFromInvite(invite.status);
}

export function isYardRfqWorkflowStage(value: string): value is YardRfqWorkflowStage {
  return YARD_RFQ_WORKFLOW_STAGES.some((s) => s.key === value);
}

/** Suggested next stage for inbox quick actions. */
export function suggestedNextWorkflowStage(
  current: YardRfqWorkflowStage,
): YardRfqWorkflowStage | null {
  switch (current) {
    case "received":
      return "review";
    case "review":
      return "assign_estimator";
    case "assign_estimator":
      return "cost_estimate";
    case "cost_estimate":
      return "internal_approval";
    case "internal_approval":
      return "submit_quotation";
    default:
      return null;
  }
}

export function canAdvanceWorkflowStage(
  from: YardRfqWorkflowStage,
  to: YardRfqWorkflowStage,
): boolean {
  if (from === to) return true;
  const fromOrder = STAGE_ORDER[from] ?? 0;
  const toOrder = STAGE_ORDER[to] ?? 0;
  return toOrder >= fromOrder && toOrder <= fromOrder + 2;
}

export function workflowActionLabel(stage: YardRfqWorkflowStage): string {
  const match = YARD_RFQ_WORKFLOW_STAGES.find((s) => s.key === stage);
  return match?.label ?? stage;
}
