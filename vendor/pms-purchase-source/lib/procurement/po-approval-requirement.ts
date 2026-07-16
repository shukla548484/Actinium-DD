import { getPoApprovalPolicy } from "@/lib/services/po-approval-policy.service";

export type PoApprovalRequirement = {
  requiresApproval: boolean;
  requiresThreeApprovals: boolean;
  thresholdLevel2: number;
  thresholdLevel3: number;
  policyCurrency: string;
};

export async function resolvePoApprovalRequirement(
  companyId: string | null,
  vesselId: string | null,
  totalAmount: number | null | undefined
): Promise<PoApprovalRequirement> {
  const policy = await getPoApprovalPolicy(companyId, vesselId);
  const amt = totalAmount != null ? Number(totalAmount) : 0;
  return {
    requiresApproval: amt >= policy.thresholdLevel2,
    requiresThreeApprovals: amt >= policy.thresholdLevel3,
    thresholdLevel2: policy.thresholdLevel2,
    thresholdLevel3: policy.thresholdLevel3,
    policyCurrency: policy.currency,
  };
}
