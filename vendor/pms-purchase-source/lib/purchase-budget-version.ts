import prisma from "@/lib/prisma";
import type { PurchaseBudgetScope, PurchaseBudgetVersionStatus } from "@prisma/client";
import { findPurchaseBudgetsCompat } from "@/lib/purchase-budget-schema-compat";

export type BudgetVersionSummary = {
  id: string;
  versionNumber: number;
  status: PurchaseBudgetVersionStatus;
  budgetPeriodCode: string;
  budgetYear: number;
  budgetYearEnd: number | null;
  declaredAt: string;
  lineCount: number;
  declaredByName: string;
};

export async function listPurchaseBudgetVersions(params: {
  vesselId: string;
  budgetPeriodCode?: string | null;
}): Promise<BudgetVersionSummary[]> {
  const rows = await prisma.purchaseBudgetVersion.findMany({
    where: {
      vesselId: params.vesselId,
      ...(params.budgetPeriodCode ? { budgetPeriodCode: params.budgetPeriodCode } : {}),
    },
    orderBy: [{ budgetPeriodCode: "desc" }, { versionNumber: "desc" }],
    include: {
      declaredBy: { select: { firstName: true, lastName: true } },
      _count: { select: { lines: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    versionNumber: r.versionNumber,
    status: r.status,
    budgetPeriodCode: r.budgetPeriodCode,
    budgetYear: r.budgetYear,
    budgetYearEnd: r.budgetYearEnd,
    declaredAt: r.declaredAt.toISOString(),
    lineCount: r._count.lines,
    declaredByName: `${r.declaredBy.firstName} ${r.declaredBy.lastName}`.trim(),
  }));
}

export async function loadBudgetVersionLinesAsCompat(versionId: string) {
  const version = await prisma.purchaseBudgetVersion.findUnique({
    where: { id: versionId },
    include: {
      lines: true,
      vessel: { select: { id: true, name: true, code: true } },
    },
  });
  if (!version) return null;

  return version.lines.map((line) => ({
    id: line.id,
    vesselId: version.vesselId,
    vessel: version.vessel,
    dryDockProjectId: version.dryDockProjectId,
    budgetYear: version.budgetYear,
    budgetYearEnd: version.budgetYearEnd ?? version.budgetYear,
    budgetMonth: null,
    budgetQuarter: null,
    budgetPeriodType: null,
    budgetPeriodCode: version.budgetPeriodCode,
    monthlyAmount: line.monthlyAmount,
    yearlyAmount: line.yearlyAmount,
    dailyAmount: line.yearlyAmount,
    currency: line.currency,
    createdBy: null,
    budgetType: {
      id: line.budgetTypeId,
      code: line.budgetCode,
      name: line.budgetTypeName,
      description: null,
      level: 2,
      fundType: "OPEX" as const,
      parent: line.l1Code
        ? {
            id: `version-l1:${line.l1Code}`,
            code: line.l1Code,
            name: line.l1Name ?? line.l1Code,
            level: 1,
          }
        : null,
    },
  }));
}

/** Snapshot current live budgets before a mutation (original on first save, revised thereafter). */
export async function snapshotPurchaseBudgetVersion(params: {
  vesselId: string;
  budgetPeriodCode: string;
  budgetYear: number;
  budgetYearEnd: number;
  budgetScope: PurchaseBudgetScope;
  dryDockProjectId?: string | null;
  declaredById: string;
  notes?: string | null;
}): Promise<{ id: string; versionNumber: number; status: PurchaseBudgetVersionStatus } | null> {
  const {
    vesselId,
    budgetPeriodCode,
    budgetYear,
    budgetYearEnd,
    budgetScope,
    dryDockProjectId,
    declaredById,
    notes,
  } = params;

  const liveBudgets = await findPurchaseBudgetsCompat({
    where: {
      vesselId,
      budgetYear,
      budgetYearEnd,
      budgetPeriodCode,
      ...(dryDockProjectId ? { dryDockProjectId } : { dryDockProjectId: null }),
    },
    budgetScope,
  });

  if (liveBudgets.length === 0) return null;

  const latest = await prisma.purchaseBudgetVersion.findFirst({
    where: { vesselId, budgetPeriodCode },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true, status: true },
  });

  const versionNumber = (latest?.versionNumber ?? 0) + 1;
  const status: PurchaseBudgetVersionStatus =
    versionNumber === 1 ? "ORIGINAL" : "REVISED";

  const version = await prisma.purchaseBudgetVersion.create({
    data: {
      vesselId,
      budgetPeriodCode,
      budgetYear,
      budgetYearEnd,
      versionNumber,
      status,
      budgetScope,
      dryDockProjectId: dryDockProjectId ?? null,
      declaredById,
      notes: notes ?? (versionNumber > 1 ? "Auto-snapshot before revision" : "Initial declaration"),
      lines: {
        create: liveBudgets.map((b) => ({
          budgetTypeId: b.budgetType.id,
          budgetCode: b.budgetType.code,
          budgetTypeName: b.budgetType.name,
          l1Code: b.budgetType.parent?.code ?? null,
          l1Name: b.budgetType.parent?.name ?? null,
          monthlyAmount: b.monthlyAmount,
          yearlyAmount: b.yearlyAmount,
          currency: b.currency,
        })),
      },
    },
    select: { id: true, versionNumber: true, status: true },
  });

  return version;
}
