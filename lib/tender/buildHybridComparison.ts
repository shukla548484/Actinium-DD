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
