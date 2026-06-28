import Fuse from "fuse.js";
import { normalizeServiceText } from "@/lib/matching/normalize";
import { resolveScopeQuantity } from "@/lib/tender/resolveScope";
import { parseExcelBuffer } from "@/lib/tender/parseExcelBuffer";
import type { MatchMethod, QuoteLine, SpecLine } from "@/lib/tender/types";
import { nanoid } from "nanoid";

export interface ParsedExcelItem {
  serviceName: string;
  category?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  sheetName: string;
  rowIndex: number;
}

export interface ExcelMatchResult {
  line: QuoteLine;
  parsedItem: ParsedExcelItem;
  specLine: SpecLine | null;
  score: number;
}

function itemKey(item: ParsedExcelItem): string {
  return `${item.sheetName}:${item.rowIndex}:${item.serviceName}`;
}

export function matchExcelItemsToSpec(
  inviteId: string,
  specLines: SpecLine[],
  items: ParsedExcelItem[],
  threshold = 0.55,
): ExcelMatchResult[] {
  const fuse = new Fuse(
    specLines.flatMap((s) => {
      const entries = [
        { ...s, norm: normalizeServiceText(s.description), codeNorm: s.lineCode ? normalizeServiceText(s.lineCode) : "" },
      ];
      if (s.descriptions.zh) {
        entries.push({
          ...s,
          norm: normalizeServiceText(s.descriptions.zh),
          codeNorm: s.lineCode ? normalizeServiceText(s.lineCode) : "",
        });
      }
      if (s.descriptions.ja) {
        entries.push({
          ...s,
          norm: normalizeServiceText(s.descriptions.ja),
          codeNorm: s.lineCode ? normalizeServiceText(s.lineCode) : "",
        });
      }
      return entries;
    }),
    {
      keys: ["norm", "codeNorm", "description"],
      threshold: 1 - threshold,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 3,
    },
  );

  const usedSpec = new Set<string>();
  const results: ExcelMatchResult[] = [];

  for (const item of items) {
    const norm = normalizeServiceText(item.serviceName);
    if (!norm) continue;

    const hits = fuse.search(norm);
    let specLine: SpecLine | null = null;
    let score = 0;

    for (const hit of hits) {
      if (!usedSpec.has(hit.item.id)) {
        specLine = specLines.find((s) => s.id === hit.item.id) ?? null;
        score = hit.score != null ? 1 - hit.score : 0;
        if (specLine && score >= threshold) {
          usedSpec.add(specLine.id);
          break;
        }
        specLine = null;
      }
    }

    const isExtra = !specLine;
    const matchMethod: MatchMethod = specLine ? "excel_auto" : "excel_auto";
    const line: QuoteLine = {
      id: nanoid(),
      inviteId,
      specLineId: specLine?.id ?? null,
      isExtra,
      description: specLine?.description ?? item.serviceName,
      unit: specLine?.unit ?? null,
      unitRate: item.unitPrice ?? null,
      quantity: item.quantity ?? specLine?.defaultQty ?? null,
      quotedTotal: item.totalPrice ?? null,
      calculatedTotal: null,
      discountPct: 0,
      grossTotal: null,
      netTotal: null,
      pricingStatus: "priced",
      remarks: item.category ? `Sheet: ${item.category}` : null,
      matchConfidence: specLine ? score : null,
      matchMethod,
      sortOrder: specLine?.sortOrder ?? 9000 + results.length,
    };

    results.push({ line, parsedItem: item, specLine, score });
  }

  return results;
}

export async function parseAndMatchExcelFile(
  inviteId: string,
  specLines: SpecLine[],
  buffer: ArrayBuffer,
  fileName: string,
  threshold = 0.55,
): Promise<{ items: ParsedExcelItem[]; matches: ExcelMatchResult[] }> {
  const items = parseExcelBuffer(buffer, fileName);
  const matches = matchExcelItemsToSpec(inviteId, specLines, items, threshold);
  return { items, matches };
}

export function buildQuoteLinesFromPortalDraft(
  inviteId: string,
  specLines: SpecLine[],
  draft: Record<
    string,
    {
      unitRate?: number | null;
      discountPct?: number | null;
      pricingStatus?: QuoteLine["pricingStatus"];
      remarks?: string | null;
    }
  >,
  extras: Array<{
    description: string;
    unitRate?: number | null;
    quantity?: number | null;
    discountPct?: number | null;
    remarks?: string | null;
  }> = [],
): QuoteLine[] {
  const lines: QuoteLine[] = specLines.map((spec) => {
    const d = draft[spec.id] ?? {};
    return {
      id: nanoid(),
      inviteId,
      specLineId: spec.id,
      isExtra: false,
      description: spec.description,
      unit: spec.unit,
      unitRate: d.unitRate ?? null,
      quantity: resolveScopeQuantity(spec),
      quotedTotal: null,
      calculatedTotal: null,
      discountPct: d.discountPct ?? 0,
      grossTotal: null,
      netTotal: null,
      pricingStatus: d.pricingStatus ?? "priced",
      remarks: d.remarks ?? null,
      matchConfidence: 1,
      matchMethod: "portal",
      sortOrder: spec.sortOrder,
    };
  });

  for (const [i, extra] of extras.entries()) {
    if (!extra.description.trim()) continue;
    lines.push({
      id: nanoid(),
      inviteId,
      specLineId: null,
      isExtra: true,
      description: extra.description,
      unit: null,
      unitRate: extra.unitRate ?? null,
      quantity: extra.quantity ?? null,
      quotedTotal: null,
      calculatedTotal: null,
      discountPct: extra.discountPct ?? 0,
      grossTotal: null,
      netTotal: null,
      pricingStatus: "priced",
      remarks: extra.remarks ?? null,
      matchConfidence: null,
      matchMethod: "portal",
      sortOrder: 9500 + i,
    });
  }

  return lines;
}

export { itemKey };
