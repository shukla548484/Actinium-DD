import { prisma } from '@/lib/prisma';

export interface InvoiceApprovalLevels {
  level1AccessLevels: number[];
  level2AccessLevels: number[];
  level3AccessLevels: number[];
  level4AccessLevels: number[];
}

const DEFAULT_LEVELS: InvoiceApprovalLevels = {
  level1AccessLevels: [32, 33],
  level2AccessLevels: [37, 38, 39, 40],
  level3AccessLevels: [44],
  level4AccessLevels: [48],
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
 * Get invoice approval level config for a company/vessel. Falls back to default when no config exists.
 */
export async function getInvoiceApprovalLevels(
  companyId: string | null,
  vesselId: string | null
): Promise<InvoiceApprovalLevels> {
  const orConditions: Array<Record<string, unknown>> = [
    { vesselId: null, companyId: null, isDefault: true },
  ];
  if (companyId) orConditions.push({ vesselId: null, companyId });
  if (vesselId && companyId) orConditions.push({ vesselId, companyId });

  const configs = await prisma.invoiceApprovalConfig.findMany({
    where: { OR: orConditions },
    orderBy: [
      { vesselId: 'desc' },
      { companyId: 'desc' },
    ],
    take: 1,
  });

  const row = configs[0];
  if (!row) return DEFAULT_LEVELS;

  return {
    level1AccessLevels: parseJsonNumberArray(row.level1AccessLevels).length
      ? parseJsonNumberArray(row.level1AccessLevels)
      : DEFAULT_LEVELS.level1AccessLevels,
    level2AccessLevels: parseJsonNumberArray(row.level2AccessLevels).length
      ? parseJsonNumberArray(row.level2AccessLevels)
      : DEFAULT_LEVELS.level2AccessLevels,
    level3AccessLevels: parseJsonNumberArray(row.level3AccessLevels).length
      ? parseJsonNumberArray(row.level3AccessLevels)
      : DEFAULT_LEVELS.level3AccessLevels,
    level4AccessLevels: parseJsonNumberArray(row.level4AccessLevels).length
      ? parseJsonNumberArray(row.level4AccessLevels)
      : DEFAULT_LEVELS.level4AccessLevels,
  };
}

/** Build APPROVAL_LEVEL_MAP from config: accessLevel -> 'LEVEL_ONE' | 'LEVEL_TWO' | ... */
export function buildApprovalLevelMap(levels: InvoiceApprovalLevels): Record<number, 'LEVEL_ONE' | 'LEVEL_TWO' | 'LEVEL_THREE' | 'LEVEL_FOUR'> {
  const map: Record<number, 'LEVEL_ONE' | 'LEVEL_TWO' | 'LEVEL_THREE' | 'LEVEL_FOUR'> = {};
  levels.level1AccessLevels.forEach((l) => { map[l] = 'LEVEL_ONE'; });
  levels.level2AccessLevels.forEach((l) => { map[l] = 'LEVEL_TWO'; });
  levels.level3AccessLevels.forEach((l) => { map[l] = 'LEVEL_THREE'; });
  levels.level4AccessLevels.forEach((l) => { map[l] = 'LEVEL_FOUR'; });
  return map;
}
