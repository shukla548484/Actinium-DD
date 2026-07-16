import {
  getProjectDetail,
  getQuoteMeta,
  listQuoteLines,
} from "@/lib/db/index";
import { buildDurationContext, calculateLineTotal } from "@/lib/tender/calculate";
import {
  categoryLabelFromList,
  formatCategoryLabel,
  normalizeCategorySlug,
} from "@/lib/tender/categories";
import { applyDiscount, applyQuoteCommercials, resolveScopeQuantity } from "@/lib/tender/resolveScope";
import {
  type BucketTotal,
  type ComparisonCell,
  type ComparisonRow,
  type HybridComparison,
  type QuoteLine,
  type SpecLine,
  type YardQuoteHealth,
} from "@/lib/tender/types";

function cellFromLine(
  line: QuoteLine | undefined,
  yardName: string,
  inviteId: string,
  source: ComparisonCell["source"],
): ComparisonCell | null {
  if (!line) return null;
  const total = line.netTotal ?? line.calculatedTotal ?? line.quotedTotal;
  if (
    total == null &&
    line.unitRate == null &&
    line.pricingStatus === "priced"
  ) {
    return null;
  }
  return {
    unitRate: line.unitRate,
    quantity: line.quantity,
    quotedTotal: line.quotedTotal,
    calculatedTotal: line.netTotal ?? line.calculatedTotal ?? line.quotedTotal,
    discountPct: line.discountPct,
    grossTotal: line.grossTotal,
    netTotal: line.netTotal ?? line.calculatedTotal ?? line.quotedTotal,
    pricingStatus: line.pricingStatus,
    remarks: line.remarks,
    source,
    matchMethod: line.matchMethod,
    matchConfidence: line.matchConfidence,
    yardName,
    inviteId,
  };
}

function sumNullable(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => v != null && !Number.isNaN(v));
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100;
}

function roundPct(value: number): number {
  return Math.round(value * 10) / 10;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  const left = sorted[middle - 1];
  const right = sorted[middle];
  if (left == null || right == null) return null;
  return (left + right) / 2;
}

function buildQuoteHealth(
  rows: ComparisonRow[],
  extraRows: ComparisonRow[],
  yards: { id: string; name: string }[],
): YardQuoteHealth[] {
  const totalRows = rows.length || 1;
  const healthByYard = new Map(
    yards.map((yard) => [
      yard.id,
      {
        inviteId: yard.id,
        yardName: yard.name,
        score: 100,
        coveragePct: 100,
        pricedLines: 0,
        includedLines: 0,
        naLines: 0,
        ownerSupplyLines: 0,
        unresolvedLines: 0,
        lowConfidenceLines: 0,
        outlierLines: 0,
        extraLines: 0,
        issues: [],
      } as YardQuoteHealth,
    ]),
  );

  for (const row of rows) {
    const pricedTotals = yards
      .map((yard) => row.byYard[yard.id]?.netTotal ?? row.byYard[yard.id]?.calculatedTotal ?? null)
      .filter((value): value is number => value != null && value > 0);
    const rowMedian = pricedTotals.length >= 2 ? median(pricedTotals) : null;

    for (const yard of yards) {
      const entry = healthByYard.get(yard.id);
      const cell = row.byYard[yard.id];
      if (!entry) continue;

      if (!cell) {
        entry.unresolvedLines += 1;
        continue;
      }

      const total = cell.netTotal ?? cell.calculatedTotal;
      if (cell.pricingStatus === "priced") {
        if (total == null) {
          entry.unresolvedLines += 1;
        } else {
          entry.pricedLines += 1;
        }
      } else if (cell.pricingStatus === "included") {
        entry.includedLines += 1;
      } else if (cell.pricingStatus === "na") {
        entry.naLines += 1;
      } else if (cell.pricingStatus === "owner_supply") {
        entry.ownerSupplyLines += 1;
      }

      if (cell.matchConfidence != null && cell.matchConfidence < 0.75) {
        entry.lowConfidenceLines += 1;
      }

      if (
        total != null &&
        rowMedian != null &&
        rowMedian > 0 &&
        Math.abs(total - rowMedian) / rowMedian >= 0.25
      ) {
        entry.outlierLines += 1;
      }
    }
  }

  for (const row of extraRows) {
    for (const yard of yards) {
      const entry = healthByYard.get(yard.id);
      if (!entry) continue;
      if (row.byYard[yard.id]) {
        entry.extraLines += 1;
      }
    }
  }

  const severityRank = { high: 0, medium: 1, low: 2 } as const;

  return yards.map((yard) => {
    const entry = healthByYard.get(yard.id)!;
    const unresolvedRate = entry.unresolvedLines / totalRows;
    const lowConfidenceRate = entry.lowConfidenceLines / totalRows;
    const outlierRate = entry.outlierLines / Math.max(entry.pricedLines, 1);
    const extraRate = entry.extraLines / totalRows;
    const qualifierRate = (entry.naLines + entry.ownerSupplyLines) / totalRows;

    entry.coveragePct = roundPct(((totalRows - entry.unresolvedLines) / totalRows) * 100);
    entry.score = Math.max(
      0,
      Math.round(
        100
          - unresolvedRate * 45
          - lowConfidenceRate * 15
          - outlierRate * 20
          - extraRate * 10
          - qualifierRate * 10,
      ),
    );

    if (entry.unresolvedLines > 0) {
      entry.issues.push({
        severity: entry.unresolvedLines >= Math.max(3, Math.ceil(totalRows * 0.1)) ? "high" : "medium",
        title: "Unresolved pricing",
        detail: `${entry.unresolvedLines} owner scope line${entry.unresolvedLines === 1 ? "" : "s"} do not have usable pricing.`,
      });
    }
    if (entry.lowConfidenceLines > 0) {
      entry.issues.push({
        severity: "medium",
        title: "Low-confidence matches",
        detail: `${entry.lowConfidenceLines} imported line${entry.lowConfidenceLines === 1 ? "" : "s"} should be checked against owner scope.`,
      });
    }
    if (entry.outlierLines > 0) {
      entry.issues.push({
        severity: entry.outlierLines >= 3 ? "high" : "medium",
        title: "Price outliers",
        detail: `${entry.outlierLines} line${entry.outlierLines === 1 ? "" : "s"} are more than 25% away from the yard pack median.`,
      });
    }
    if (entry.naLines + entry.ownerSupplyLines > 0) {
      const count = entry.naLines + entry.ownerSupplyLines;
      entry.issues.push({
        severity: "low",
        title: "Scope qualifiers",
        detail: `${count} line${count === 1 ? "" : "s"} are marked N/A or owner supply and may need negotiation.`,
      });
    }
    if (entry.extraLines > 0) {
      entry.issues.push({
        severity: "low",
        title: "Extra lines",
        detail: `${entry.extraLines} extra line${entry.extraLines === 1 ? "" : "s"} sit outside the owner scope list.`,
      });
    }

    entry.issues.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
    return entry;
  });
}

export async function buildHybridComparison(
  projectId: string,
): Promise<HybridComparison | null> {
  const detail = await getProjectDetail(projectId);
  if (!detail) return null;

  const categories = detail.categories;
  const categorySlugs = categories.map((c) => c.slug);

  const yards = detail.yardInvites.map((inv) => ({
    id: inv.id,
    name: inv.yardName,
    sourceType: inv.sourceType,
    status: inv.status,
  }));

  const linesByInvite = new Map<string, QuoteLine[]>();
  await Promise.all(
    detail.yardInvites.map(async (inv) => {
      linesByInvite.set(inv.id, await listQuoteLines(inv.id));
    }),
  );

  const specRows: ComparisonRow[] = detail.specLines.map((spec) => {
    const byYard: Record<string, ComparisonCell | null> = {};
    for (const inv of detail.yardInvites) {
      const lines = linesByInvite.get(inv.id) ?? [];
      const matched = lines.find((l) => l.specLineId === spec.id && !l.isExtra);
      byYard[inv.id] = cellFromLine(matched, inv.yardName, inv.id, inv.sourceType);
    }
    return specToRow(spec, byYard);
  });

  const extraRows: ComparisonRow[] = [];
  for (const inv of detail.yardInvites) {
    const lines = linesByInvite.get(inv.id) ?? [];
    for (const line of lines.filter((l) => l.isExtra)) {
      const byYard: Record<string, ComparisonCell | null> = {};
      for (const y of detail.yardInvites) {
        byYard[y.id] =
          y.id === inv.id ? cellFromLine(line, inv.yardName, inv.id, inv.sourceType) : null;
      }
      extraRows.push({
        specLineId: null,
        lineCode: null,
        description: line.description,
        bucket: "miscellaneous",
        unit: line.unit,
        calcRule: "lump_sum",
        scopeQty: line.quantity,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: null,
        isExtra: true,
        byYard,
      });
    }
  }

  const bucketsToTotal = categorySlugs.length > 0 ? categorySlugs : [
    ...new Set([...specRows, ...extraRows].map((r) => normalizeCategorySlug(r.bucket))),
  ];

  const bucketTotals: BucketTotal[] = bucketsToTotal.map((bucket) => {
    const cat = categories.find((c) => c.slug === bucket);
    const byYard: Record<string, number | null> = {};
    for (const inv of detail.yardInvites) {
      const rows = [...specRows, ...extraRows].filter(
        (r) => normalizeCategorySlug(r.bucket) === bucket,
      );
      byYard[inv.id] = sumNullable(
        rows.map((r) => r.byYard[inv.id]?.netTotal ?? r.byYard[inv.id]?.calculatedTotal ?? null),
      );
    }
    return {
      bucket,
      categoryNo: cat?.categoryNo ?? null,
      label: cat ? formatCategoryLabel(cat) : categoryLabelFromList(categories, bucket),
      shortcut: cat?.shortcut ?? null,
      byYard,
    };
  });

  const grandTotals: Record<string, number | null> = {};
  for (const inv of detail.yardInvites) {
    grandTotals[inv.id] = sumNullable(
      [...specRows, ...extraRows].map(
        (r) => r.byYard[inv.id]?.netTotal ?? r.byYard[inv.id]?.calculatedTotal ?? null,
      ),
    );
  }

  return {
    project: detail,
    yards,
    rows: specRows,
    extraRows,
    bucketTotals: bucketTotals.filter((b) =>
      detail.yardInvites.some((inv) => b.byYard[inv.id] != null),
    ),
    grandTotals,
    health: buildQuoteHealth(specRows, extraRows, yards),
  };
}

function specToRow(
  spec: SpecLine,
  byYard: Record<string, ComparisonCell | null>,
): ComparisonRow {
  return {
    specLineId: spec.id,
    lineCode: spec.lineCode,
    description: spec.description,
    descriptions: spec.descriptions,
    bucket: normalizeCategorySlug(spec.bucket),
    unit: spec.unit,
    calcRule: spec.calcRule,
    scopeQty: resolveScopeQuantity(spec),
    scopeDays: spec.scopeDays,
    scopeAreaM2: spec.scopeAreaM2 ?? (spec.calcRule === "per_m2" ? resolveScopeQuantity(spec) : null),
    scopeNotes: spec.scopeNotes,
    isExtra: false,
    byYard,
  };
}

export async function recalculateInviteLines(
  projectId: string,
  inviteId: string,
  lines: QuoteLine[],
): Promise<QuoteLine[]> {
  const detail = await getProjectDetail(projectId);
  if (!detail) return lines;
  const meta = await getQuoteMeta(inviteId);
  const duration = buildDurationContext(detail, meta);
  const specMap = new Map(detail.specLines.map((s) => [s.id, s]));

  return lines.map((line) => {
    const spec = line.specLineId ? specMap.get(line.specLineId) : null;
    if (!spec) {
      const gross =
        line.quotedTotal ??
        (line.unitRate != null && line.quantity != null
          ? Math.round(line.unitRate * line.quantity * 100) / 100
          : line.unitRate);
      const { grossTotal, netTotal } = applyDiscount(gross ?? null, line.discountPct);
      return {
        ...line,
        grossTotal,
        netTotal,
        calculatedTotal: netTotal,
      };
    }

    const scopedQty = resolveScopeQuantity(spec);
    const quantity = spec.ownerLocked ? scopedQty : line.quantity ?? scopedQty;
    const gross = calculateLineTotal(spec, { ...line, quantity }, duration);
    const { grossTotal, netTotal } = applyDiscount(
      gross,
      spec.allowDiscount ? line.discountPct : 0,
      spec.maxDiscountPct,
    );

    return {
      ...line,
      quantity,
      grossTotal,
      netTotal,
      calculatedTotal: netTotal,
    };
  });
}

export function recalculateQuoteMetaTotals(
  lines: QuoteLine[],
  meta: { globalDiscountPct?: number | null; taxPct?: number | null },
): { quoteGrossTotal: number | null; quoteNetTotal: number | null } {
  const lineNetSum = lines.reduce((sum, line) => {
    const val = line.netTotal ?? line.calculatedTotal;
    if (val == null || line.pricingStatus !== "priced") return sum;
    return sum + val;
  }, 0);

  if (lineNetSum === 0 && lines.every((l) => l.netTotal == null && l.calculatedTotal == null)) {
    return { quoteGrossTotal: null, quoteNetTotal: null };
  }

  const { grossTotal, netTotal } = applyQuoteCommercials(
    lineNetSum,
    meta.globalDiscountPct ?? null,
    meta.taxPct ?? null,
  );
  return { quoteGrossTotal: grossTotal, quoteNetTotal: netTotal };
}

export function ensurePortalDraftLines(
  inviteId: string,
  specLines: SpecLine[],
  existing: QuoteLine[],
  localeDescription?: (spec: SpecLine) => string,
): QuoteLine[] {
  const bySpec = new Map(existing.filter((l) => l.specLineId).map((l) => [l.specLineId!, l]));
  return specLines.map((spec) => {
    const found = bySpec.get(spec.id);
    if (found) return found;
    const description = localeDescription?.(spec) ?? spec.description;
    return {
      id: crypto.randomUUID?.() ?? `line-${spec.id}`,
      inviteId,
      specLineId: spec.id,
      isExtra: false,
      description,
      unit: spec.unit,
      unitRate: null,
      quantity: resolveScopeQuantity(spec),
      quotedTotal: null,
      calculatedTotal: null,
      discountPct: 0,
      grossTotal: null,
      netTotal: null,
      pricingStatus: "priced",
      remarks: null,
      matchConfidence: 1,
      matchMethod: "portal",
      sortOrder: spec.sortOrder,
    };
  });
}
