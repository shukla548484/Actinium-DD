import { prisma } from '@/lib/prisma';

export interface PoApprovalPolicy {
  thresholdLevel2: number;
  thresholdLevel3: number;
  level1AccessLevels: number[];
  level2AccessLevels: number[];
  level3AccessLevels: number[];
  currency: string;
}

const DEFAULT_POLICY: PoApprovalPolicy = {
  thresholdLevel2: 3000,
  thresholdLevel3: 10000,
  level1AccessLevels: [37, 39, 50],
  level2AccessLevels: [41, 44, 50],
  level3AccessLevels: [46, 47, 48, 50],
  currency: 'USD',
};

function parseJsonNumberArray(value: unknown): number[] {
  if (Array.isArray(value)) return value.filter((n): n is number => typeof n === 'number');
  if (typeof value === 'string') {
    try {
      const arr = JSON.parse(value);
      return Array.isArray(arr) ? arr.filter((n: unknown): n is number => typeof n === 'number') : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Get PO approval policy for a company/vessel. Falls back to default when no policy is configured.
 */
export async function getPoApprovalPolicy(
  companyId: string | null,
  vesselId: string | null
): Promise<PoApprovalPolicy> {
  const orConditions: Array<Record<string, unknown>> = [
    { vesselId: null, companyId: null, isDefault: true },
  ];
  if (companyId) orConditions.push({ vesselId: null, companyId });
  if (vesselId && companyId) orConditions.push({ vesselId, companyId });

  const policies = await prisma.poApprovalPolicy.findMany({
    where: { OR: orConditions },
    orderBy: [
      { vesselId: 'desc' },
      { companyId: 'desc' },
    ],
    take: 1,
  });

  const row = policies[0];
  if (!row) return DEFAULT_POLICY;

  return {
    thresholdLevel2: Number(row.thresholdLevel2) || DEFAULT_POLICY.thresholdLevel2,
    thresholdLevel3: Number(row.thresholdLevel3) || DEFAULT_POLICY.thresholdLevel3,
    level1AccessLevels: parseJsonNumberArray(row.level1AccessLevels).length
      ? parseJsonNumberArray(row.level1AccessLevels)
      : DEFAULT_POLICY.level1AccessLevels,
    level2AccessLevels: parseJsonNumberArray(row.level2AccessLevels).length
      ? parseJsonNumberArray(row.level2AccessLevels)
      : DEFAULT_POLICY.level2AccessLevels,
    level3AccessLevels: parseJsonNumberArray(row.level3AccessLevels).length
      ? parseJsonNumberArray(row.level3AccessLevels)
      : DEFAULT_POLICY.level3AccessLevels,
    currency: row.currency || DEFAULT_POLICY.currency,
  };
}
