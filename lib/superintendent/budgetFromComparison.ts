import { buildHybridComparison } from "@/lib/tender/buildHybridComparison";
import { categoryLabelFromList } from "@/lib/tender/categories";
import { notDeleted } from "@/lib/superintendent/helpers";
import { prisma } from "@/lib/prisma";

export type BudgetQuoteRow = {
  category: string;
  categoryLabel: string;
  budgetAmount: number;
  quotedAmount: number | null;
  approvedAmount: number | null;
  actualAmount: number | null;
  variance: number | null;
  variancePct: number | null;
  yardTotals: Record<string, number | null>;
};

export type BudgetVsQuoteSummary = {
  dryDockProjectId: string;
  tenderProjectId: string;
  tenderProjectName: string;
  yards: { id: string; name: string }[];
  selectedYardInviteId: string | null;
  rows: BudgetQuoteRow[];
  budgetGrandTotal: number;
  quotedGrandTotal: number | null;
  lowestYardInviteId: string | null;
  comparisonGrandTotals: Record<string, number | null>;
};

function variance(budget: number, quoted: number | null): number | null {
  if (quoted == null) return null;
  return Math.round((quoted - budget) * 100) / 100;
}

function variancePct(budget: number, quoted: number | null): number | null {
  if (quoted == null || budget === 0) return null;
  return Math.round(((quoted - budget) / budget) * 10000) / 100;
}

export async function buildBudgetVsQuoteSummary(
  dryDockProjectId: string,
  selectedYardInviteId?: string | null,
): Promise<BudgetVsQuoteSummary | null> {
  const ddProject = await prisma.dryDockProject.findFirst({
    where: { id: dryDockProjectId, ...notDeleted },
    include: {
      budgetLines: { where: notDeleted, orderBy: { sortOrder: "asc" } },
      tenderProject: { select: { id: true, name: true } },
    },
  });
  if (!ddProject?.projectId) return null;

  const comparison = await buildHybridComparison(ddProject.projectId);
  if (!comparison) return null;

  const yards = comparison.yards.map((y) => ({ id: y.id, name: y.name }));

  let yardId = selectedYardInviteId ?? null;
  if (!yardId && ddProject.selectedYard) {
    const match = yards.find(
      (y) => y.name.toLowerCase() === ddProject.selectedYard!.toLowerCase(),
    );
    yardId = match?.id ?? null;
  }
  if (!yardId && yards.length > 0) {
    let bestId = yards[0]!.id;
    let bestVal = comparison.grandTotals[bestId] ?? Infinity;
    for (const y of yards) {
      const t = comparison.grandTotals[y.id];
      if (t != null && t < bestVal) {
        bestVal = t;
        bestId = y.id;
      }
    }
    yardId = bestId;
  }

  const budgetByCategory = new Map(
    ddProject.budgetLines.map((l) => [l.category, l]),
  );

  const rows: BudgetQuoteRow[] = comparison.bucketTotals.map((bucket) => {
    const existing = budgetByCategory.get(bucket.bucket);
    const budgetAmount = existing?.budgetAmount ?? 0;
    const yardTotals: Record<string, number | null> = {};
    for (const y of yards) {
      yardTotals[y.id] = bucket.byYard[y.id] ?? null;
    }
    const quotedAmount =
      yardId != null ? (bucket.byYard[yardId] ?? null) : null;

    return {
      category: bucket.bucket,
      categoryLabel: bucket.label ?? categoryLabelFromList(comparison.project.categories, bucket.bucket),
      budgetAmount,
      quotedAmount,
      approvedAmount: existing?.approvedAmount ?? null,
      actualAmount: existing?.actualAmount ?? null,
      variance: variance(budgetAmount, quotedAmount),
      variancePct: variancePct(budgetAmount, quotedAmount),
      yardTotals,
    };
  });

  for (const line of ddProject.budgetLines) {
    if (rows.some((r) => r.category === line.category)) continue;
    rows.push({
      category: line.category,
      categoryLabel: line.description ?? line.category.replace(/_/g, " "),
      budgetAmount: line.budgetAmount,
      quotedAmount: line.quotedAmount,
      approvedAmount: line.approvedAmount,
      actualAmount: line.actualAmount,
      variance: variance(line.budgetAmount, line.quotedAmount),
      variancePct: variancePct(line.budgetAmount, line.quotedAmount),
      yardTotals: {},
    });
  }

  const budgetGrandTotal = rows.reduce((s, r) => s + r.budgetAmount, 0);
  const quotedGrandTotal =
    yardId != null ? (comparison.grandTotals[yardId] ?? null) : null;

  let lowestYardInviteId: string | null = null;
  let lowest = Infinity;
  for (const y of yards) {
    const t = comparison.grandTotals[y.id];
    if (t != null && t < lowest) {
      lowest = t;
      lowestYardInviteId = y.id;
    }
  }

  return {
    dryDockProjectId,
    tenderProjectId: ddProject.projectId,
    tenderProjectName: ddProject.tenderProject?.name ?? ddProject.projectId,
    yards,
    selectedYardInviteId: yardId,
    rows,
    budgetGrandTotal: Math.round(budgetGrandTotal * 100) / 100,
    quotedGrandTotal,
    lowestYardInviteId,
    comparisonGrandTotals: comparison.grandTotals,
  };
}

export async function syncBudgetLinesFromComparison(
  dryDockProjectId: string,
  yardInviteId?: string | null,
): Promise<{ updated: number; summary: BudgetVsQuoteSummary | null }> {
  const summary = await buildBudgetVsQuoteSummary(dryDockProjectId, yardInviteId);
  if (!summary) return { updated: 0, summary: null };

  let updated = 0;
  for (let i = 0; i < summary.rows.length; i++) {
    const row = summary.rows[i]!;
    const existing = await prisma.ddBudgetLine.findFirst({
      where: {
        dryDockProjectId,
        category: row.category,
        ...notDeleted,
      },
    });

    if (existing) {
      await prisma.ddBudgetLine.update({
        where: { id: existing.id },
        data: {
          quotedAmount: row.quotedAmount,
          description: existing.description ?? row.categoryLabel,
        },
      });
    } else {
      await prisma.ddBudgetLine.create({
        data: {
          dryDockProjectId,
          category: row.category,
          description: row.categoryLabel,
          budgetAmount: row.budgetAmount,
          quotedAmount: row.quotedAmount,
          sortOrder: i,
        },
      });
    }
    updated++;
  }

  await prisma.dryDockProject.update({
    where: { id: dryDockProjectId },
    data: {
      quotedTotal: summary.quotedGrandTotal,
      budgetTotal: summary.budgetGrandTotal,
    },
  });

  return { updated, summary };
}
