import { prisma } from "@/lib/prisma";

/**
 * Default freight GL account from InvoiceApprovalConfig (vessel → company → default).
 */
export async function getDefaultFreightAccountCodeId(
  companyId: string | null,
  vesselId: string | null
): Promise<string | null> {
  const orConditions: Array<Record<string, unknown>> = [
    { vesselId: null, companyId: null, isDefault: true },
  ];
  if (companyId) orConditions.push({ vesselId: null, companyId });
  if (vesselId && companyId) orConditions.push({ vesselId, companyId });

  const configs = await prisma.invoiceApprovalConfig.findMany({
    where: { OR: orConditions },
    orderBy: [{ vesselId: "desc" }, { companyId: "desc" }],
    take: 1,
    select: { defaultFreightAccountCodeId: true },
  });

  return configs[0]?.defaultFreightAccountCodeId ?? null;
}

export async function getDefaultFreightAccount(
  companyId: string | null,
  vesselId: string | null
) {
  const accountId = await getDefaultFreightAccountCodeId(companyId, vesselId);
  if (!accountId) return null;
  return prisma.chartOfAccount.findUnique({
    where: { id: accountId },
    select: { id: true, accountCode: true, accountName: true },
  });
}
