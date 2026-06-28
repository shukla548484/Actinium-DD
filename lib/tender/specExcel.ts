import * as XLSX from "xlsx";
import {
  categoryLabelFromList,
  resolveCategorySlugFromImport,
  STANDARD_DOCKING_CATEGORIES,
  type CategoryLabelSource,
} from "@/lib/tender/categories";
import type { CalcRule, SpecLine, YardQuoteDetail } from "@/lib/tender/types";
import { buildDurationContext } from "@/lib/tender/calculate";
import { scopeSummary } from "@/lib/tender/resolveScope";
import { DOCKING_COST_BUCKET, GENERAL_SERVICE_COST_BUCKET } from "@/lib/tender/catalogBuckets";

export const SPEC_TEMPLATE_SHEET = "Spec Lines";
export const YARD_TEMPLATE_SHEET = "Yard Quote";

export const SPEC_IMPORT_HEADERS = [
  "Category No",
  "Category",
  "Code",
  "Description (EN)",
  "中文",
  "日本語",
  "Unit",
  "Qty",
  "Days",
  "Area m²",
  "Calc Rule",
  "Ref Rate",
  "Max Discount %",
  "Scope Notes",
  "Optional",
  "Allow Discount",
] as const;

export interface SpecLineLike {
  bucket: string;
  lineCode: string | null;
  description: string;
  descriptions?: { en: string; zh: string | null; ja: string | null };
  unit: string | null;
  defaultQty: number | null;
  scopeDays: number | null;
  scopeAreaM2: number | null;
  scopeNotes: string | null;
  calcRule: CalcRule | string;
  referenceUnitRate: number | null;
  maxDiscountPct: number | null;
  isOptional: boolean;
  allowDiscount?: boolean;
}

export interface ParsedSpecImportRow {
  bucket: string;
  lineCode?: string;
  description: string;
  descriptionZh: string | null;
  descriptionJa: string | null;
  unit: string | null;
  defaultQty: number | null;
  scopeDays: number | null;
  scopeAreaM2: number | null;
  scopeNotes: string | null;
  calcRule: string;
  referenceUnitRate: number | null;
  maxDiscountPct: number | null;
  isOptional: boolean;
  allowDiscount: boolean;
}

const CALC_RULE_MAP: Record<string, string> = {
  lump_sum: "lump_sum",
  "lump sum": "lump_sum",
  lumpsum: "lump_sum",
  per_day: "per_day",
  "per day": "per_day",
  daily: "per_day",
  unit_qty: "unit_qty",
  "unit qty": "unit_qty",
  unit: "unit_qty",
  unit_qty_days: "unit_qty_days",
  watch: "watch",
  connection_daily: "connection_daily",
  connect_disconnect: "connect_disconnect",
  per_m2: "per_m2",
  "per m2": "per_m2",
  "per m²": "per_m2",
  area: "per_m2",
};

function str(val: unknown): string {
  if (val == null) return "";
  return String(val).trim();
}

function num(val: unknown): number | null {
  if (val == null || val === "") return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

function yn(val: unknown, defaultVal = false): boolean {
  const s = str(val).toLowerCase();
  if (!s) return defaultVal;
  return s === "y" || s === "yes" || s === "true" || s === "1";
}

export function normalizeCalcRule(raw: string): string {
  return CALC_RULE_MAP[raw.toLowerCase()] ?? "lump_sum";
}

export function parseSpecImportRows(
  rows: Record<string, unknown>[],
  categories: CategoryLabelSource[],
): ParsedSpecImportRow[] {
  const parsed: ParsedSpecImportRow[] = [];

  for (const row of rows) {
    const description = str(
      row["Description (EN)"] ?? row["Description"] ?? row["description"] ?? row["desc"],
    );
    if (!description) continue;

    const bucket = resolveCategorySlugFromImport(
      str(
        row["Category No"] ??
          row["categoryNo"] ??
          row["Category"] ??
          row["category"] ??
          row["Bucket"] ??
          row["bucket"],
      ),
      categories.length > 0 ? categories : STANDARD_DOCKING_CATEGORIES,
    );

    parsed.push({
      bucket,
      lineCode: str(row["Code"] ?? row["code"] ?? row["Line Code"] ?? row["lineCode"]) || undefined,
      description,
      descriptionZh: str(row["中文"] ?? row["Description (ZH)"] ?? row["zh"]) || null,
      descriptionJa: str(row["日本語"] ?? row["Description (JA)"] ?? row["ja"]) || null,
      unit: str(row["Unit"] ?? row["unit"]) || null,
      defaultQty: num(row["Qty"] ?? row["qty"] ?? row["Quantity"] ?? row["Default Qty"]),
      scopeDays: num(row["Days"] ?? row["days"] ?? row["Scope Days"]),
      scopeAreaM2: num(row["Area m²"] ?? row["Area"] ?? row["area"] ?? row["Area m2"]),
      scopeNotes: str(row["Scope Notes"] ?? row["Notes"] ?? row["notes"]) || null,
      calcRule: normalizeCalcRule(str(row["Calc Rule"] ?? row["calcRule"] ?? row["Rule"] ?? row["rule"])),
      referenceUnitRate: num(row["Ref Rate"] ?? row["referenceUnitRate"] ?? row["Reference Rate"]),
      maxDiscountPct: num(row["Max Discount %"] ?? row["Max Discount"] ?? row["maxDiscountPct"]),
      isOptional: yn(row["Optional"] ?? row["optional"]),
      allowDiscount: yn(row["Allow Discount"] ?? row["allowDiscount"], true),
    });
  }

  return parsed;
}

function categoryNoForBucket(bucket: string, categories: CategoryLabelSource[]): string {
  const cat = categories.find((c) => c.slug === bucket);
  if (cat) return cat.categoryNo;
  const std = STANDARD_DOCKING_CATEGORIES.find((c) => c.slug === bucket);
  return std?.categoryNo ?? "";
}

function categoryNameForBucket(bucket: string, categories: CategoryLabelSource[]): string {
  return categoryLabelFromList(categories, bucket);
}

export function specLineToTemplateRow(
  line: SpecLineLike,
  categories: CategoryLabelSource[],
): (string | number)[] {
  return [
    categoryNoForBucket(line.bucket, categories),
    categoryNameForBucket(line.bucket, categories),
    line.lineCode ?? "",
    line.description,
    line.descriptions?.zh ?? "",
    line.descriptions?.ja ?? "",
    line.unit ?? "",
    line.defaultQty ?? "",
    line.scopeDays ?? "",
    line.scopeAreaM2 ?? "",
    line.calcRule,
    line.referenceUnitRate ?? "",
    line.maxDiscountPct ?? "",
    line.scopeNotes ?? "",
    line.isOptional ? "Y" : "N",
    line.allowDiscount !== false ? "Y" : "N",
  ];
}

export function buildSpecTemplateWorkbook(
  lines: SpecLineLike[],
  categories: CategoryLabelSource[] = STANDARD_DOCKING_CATEGORIES,
  sheetName = SPEC_TEMPLATE_SHEET,
): Buffer {
  const data: (string | number)[][] = [SPEC_IMPORT_HEADERS as unknown as string[]];
  for (const line of lines) {
    data.push(specLineToTemplateRow(line, categories) as (string | number)[]);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = SPEC_IMPORT_HEADERS.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function buildEmptySpecTemplateWorkbook(
  categories: CategoryLabelSource[] = STANDARD_DOCKING_CATEGORIES,
): Buffer {
  const examples: SpecLineLike[] = [
    {
      bucket: DOCKING_COST_BUCKET,
      lineCode: "DD-001",
      description: "Dry dock hire / dock rent",
      unit: "USD/day",
      defaultQty: null,
      scopeDays: null,
      scopeAreaM2: null,
      scopeNotes: "Owner fixes dry-dock days; yard quotes daily rate",
      calcRule: "per_day",
      referenceUnitRate: null,
      maxDiscountPct: 10,
      isOptional: false,
      allowDiscount: true,
    },
    {
      bucket: GENERAL_SERVICE_COST_BUCKET,
      lineCode: "GS-001",
      description: "Fireman watch",
      unit: "USD/person/shift",
      defaultQty: null,
      scopeDays: null,
      scopeAreaM2: null,
      scopeNotes: "",
      calcRule: "watch",
      referenceUnitRate: null,
      maxDiscountPct: null,
      isOptional: false,
      allowDiscount: true,
    },
  ];
  return buildSpecTemplateWorkbook(examples, categories);
}

const YARD_QUOTE_HEADERS = [
  "Category",
  "Code",
  "Description",
  "Unit",
  "Scope Qty",
  "Scope Days",
  "Area m²",
  "Scope Notes",
  "Ref Rate",
  "Unit Rate",
  "Discount %",
  "Status",
  "Remarks",
] as const;

export function buildYardQuoteTemplateWorkbook(
  quote: YardQuoteDetail,
  bucketFilter?: string[],
): Buffer {
  const duration = buildDurationContext(quote.project, quote.meta ?? {
    inviteId: quote.invite.id,
    currency: quote.project.currency,
    shipyardDays: quote.project.shipyardDays,
    dryDockDays: quote.project.dryDockDays,
    cprDays: quote.project.cprDays,
    exchangeRate: null,
    validityDays: null,
    generalNotes: null,
    excelFileName: null,
    globalDiscountPct: null,
    taxPct: null,
    quoteGrossTotal: null,
    quoteNetTotal: null,
  });

  const lines = quote.specLines.filter(
    (s) => !bucketFilter?.length || bucketFilter.includes(s.bucket),
  );

  const data: (string | number)[][] = [YARD_QUOTE_HEADERS as unknown as string[]];
  for (const spec of lines) {
    const scope = scopeSummary(spec, duration);
    data.push([
      categoryLabelFromList(quote.categories, spec.bucket),
      spec.lineCode ?? "",
      spec.description,
      spec.unit ?? "",
      scope.quantity ?? "",
      scope.days ?? "",
      scope.areaM2 ?? "",
      spec.scopeNotes ?? "",
      spec.referenceUnitRate ?? "",
      "",
      "",
      "priced",
      "",
    ]);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = YARD_QUOTE_HEADERS.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, ws, YARD_TEMPLATE_SHEET);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function readWorkbookRows(buffer: ArrayBuffer): Record<string, unknown>[] {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    defval: "",
  });
}
