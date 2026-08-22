import * as XLSX from "xlsx";
import {
  categoryLabelFromList,
  formatCategoryLabel,
  resolveCategorySlugFromImport,
  STANDARD_DOCKING_CATEGORIES,
  type CategoryLabelSource,
} from "@/lib/tender/categories";
import type { CalcRule, YardQuoteDetail } from "@/lib/tender/types";
import { buildDurationContext } from "@/lib/tender/calculate";
import { scopeSummary } from "@/lib/tender/resolveScope";

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

type CategoryTemplateDef = {
  extraHeaders: string[];
  examples: Omit<SpecLineLike, "bucket">[];
};

type SpecImportHeader = (typeof SPEC_IMPORT_HEADERS)[number];

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

const COMMON_SPEC_EXTRA_HEADERS = [
  "Equipment / Area",
  "Work Scope",
  "Standard / Class Requirement",
  "Access / Staging",
  "Inspection / Test Requirement",
  "Remarks",
] as const;

const CATEGORY_SPEC_TEMPLATES: Record<string, CategoryTemplateDef> = {
  docking_cost: {
    extraHeaders: ["Dock Type", "LOA / Beam / Draft", "Dock Days", "Included Services", "Exclusions"],
    examples: [
      {
        lineCode: "DD-001",
        description: "Dry dock hire / dock rent",
        unit: "USD/day",
        defaultQty: null,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "Owner defines dry-dock days; yard quotes daily dock rate.",
        calcRule: "per_day",
        referenceUnitRate: null,
        maxDiscountPct: 10,
        isOptional: false,
        allowDiscount: true,
      },
      {
        lineCode: "DD-002",
        description: "Docking and undocking operation",
        unit: "Lot",
        defaultQty: 1,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "Include tug, line handling, dock blocks and shifting if applicable.",
        calcRule: "lump_sum",
        referenceUnitRate: null,
        maxDiscountPct: 10,
        isOptional: false,
        allowDiscount: true,
      },
    ],
  },
  general_service_cost: {
    extraHeaders: ["Service Type", "Shift Pattern", "No. of Persons / Points", "Daily Hours", "Utility Capacity"],
    examples: [
      {
        lineCode: "GS-001",
        description: "Fireman watch",
        unit: "USD/person/shift",
        defaultQty: null,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "Quote per watch shift as required by hot-work plan.",
        calcRule: "watch",
        referenceUnitRate: null,
        maxDiscountPct: null,
        isOptional: false,
        allowDiscount: true,
      },
      {
        lineCode: "GS-002",
        description: "Temporary ventilation",
        unit: "Fan/day",
        defaultQty: null,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "State fan capacity and hose length included.",
        calcRule: "unit_qty_days",
        referenceUnitRate: null,
        maxDiscountPct: null,
        isOptional: false,
        allowDiscount: true,
      },
    ],
  },
  hull_cleaning_painting: {
    extraHeaders: ["Hull Zone", "Surface Preparation", "Coating System", "DFT / Microns", "Area m²", "Paint Supply By"],
    examples: [
      {
        lineCode: "HP-001",
        description: "Hull washing and high-pressure cleaning",
        unit: "m²",
        defaultQty: null,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "State pressure rating and include collection/disposal of wash water.",
        calcRule: "per_m2",
        referenceUnitRate: null,
        maxDiscountPct: null,
        isOptional: false,
        allowDiscount: true,
      },
    ],
  },
  steel_renewal: {
    extraHeaders: ["Location", "Plate / Profile Size", "Estimated Weight MT", "Grade", "NDT / Test", "Scaffolding"],
    examples: [
      {
        lineCode: "SR-001",
        description: "Steel plate renewal",
        unit: "MT",
        defaultQty: null,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "Include cropping, fitting, welding, grinding, NDT and primer touch-up.",
        calcRule: "unit_qty",
        referenceUnitRate: null,
        maxDiscountPct: null,
        isOptional: false,
        allowDiscount: true,
      },
    ],
  },
  cargo_hold_tank_coating: {
    extraHeaders: ["Tank / Hold No.", "Cargo History", "Surface Standard", "Stripe Coat", "Coating System", "Holiday Test"],
    examples: [
      {
        lineCode: "TC-001",
        description: "Tank coating repair",
        unit: "m²",
        defaultQty: null,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "Specify tank, access, preparation standard and coating system.",
        calcRule: "per_m2",
        referenceUnitRate: null,
        maxDiscountPct: null,
        isOptional: false,
        allowDiscount: true,
      },
    ],
  },
  sea_valves_overboard: {
    extraHeaders: ["Valve Tag", "Size / Rating", "Type", "Material", "Hydro Test Pressure", "Gasket / Bolt Scope"],
    examples: [
      {
        lineCode: "SV-001",
        description: "Sea valve overhaul",
        unit: "Each",
        defaultQty: null,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "Include removal, overhaul, lapping, pressure test and refit.",
        calcRule: "unit_qty",
        referenceUnitRate: null,
        maxDiscountPct: null,
        isOptional: false,
        allowDiscount: true,
      },
    ],
  },
  rudder_propeller: {
    extraHeaders: ["Equipment", "Measurement Required", "Clearance / Wear Limit", "NDT", "Class Witness", "Maker Attendance"],
    examples: [
      {
        lineCode: "RP-001",
        description: "Propeller polishing and inspection",
        unit: "Lot",
        defaultQty: 1,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "Include blade inspection, edge dressing and photo report.",
        calcRule: "lump_sum",
        referenceUnitRate: null,
        maxDiscountPct: null,
        isOptional: false,
        allowDiscount: true,
      },
    ],
  },
  main_engine: {
    extraHeaders: ["Engine Model", "Cylinder No.", "Running Hours", "Last Overhaul", "Measurement Sheet", "Maker / Class"],
    examples: [
      {
        lineCode: "ME-001",
        description: "Main engine unit inspection / overhaul",
        unit: "Cylinder",
        defaultQty: null,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "State cylinder number, measurement scope and maker requirements.",
        calcRule: "unit_qty",
        referenceUnitRate: null,
        maxDiscountPct: null,
        isOptional: false,
        allowDiscount: true,
      },
    ],
  },
  auxiliary_engines: {
    extraHeaders: ["Generator No.", "Engine Model", "Running Hours", "Load Test", "Alternator Scope", "Maker Attendance"],
    examples: [
      {
        lineCode: "AE-001",
        description: "Auxiliary engine overhaul / inspection",
        unit: "Set",
        defaultQty: null,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "Include engine scope, alternator checks and load-test requirement.",
        calcRule: "unit_qty",
        referenceUnitRate: null,
        maxDiscountPct: null,
        isOptional: false,
        allowDiscount: true,
      },
    ],
  },
  boilers: {
    extraHeaders: ["Boiler No.", "Pressure Rating", "Tube Scope", "Burner Scope", "Hydro Test", "Class Survey"],
    examples: [
      {
        lineCode: "BL-001",
        description: "Boiler cleaning, inspection and repair",
        unit: "Lot",
        defaultQty: 1,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "Include opening, cleaning, inspection support and pressure test.",
        calcRule: "lump_sum",
        referenceUnitRate: null,
        maxDiscountPct: null,
        isOptional: false,
        allowDiscount: true,
      },
    ],
  },
  deck_machinery: {
    extraHeaders: ["Machinery", "Brake / Gear / Hydraulic Scope", "Load Test", "Wire / Rope Scope", "Foundation", "Maker Attendance"],
    examples: [
      {
        lineCode: "DM-001",
        description: "Windlass / mooring winch overhaul",
        unit: "Each",
        defaultQty: null,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "Specify brake lining, gearbox, hydraulic motor and load-test scope.",
        calcRule: "unit_qty",
        referenceUnitRate: null,
        maxDiscountPct: null,
        isOptional: false,
        allowDiscount: true,
      },
    ],
  },
  cargo_gear: {
    extraHeaders: ["Crane / Gear No.", "SWL", "Wire / Sheave Scope", "Load Test %", "Certification", "NDT"],
    examples: [
      {
        lineCode: "CG-001",
        description: "Crane load test and inspection",
        unit: "Crane",
        defaultQty: null,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "State SWL, test load, certificates and attendance requirements.",
        calcRule: "unit_qty",
        referenceUnitRate: null,
        maxDiscountPct: null,
        isOptional: false,
        allowDiscount: true,
      },
    ],
  },
  electrical: {
    extraHeaders: ["Equipment Tag", "Voltage / kW", "Insulation Test", "Bearing Scope", "Cable Scope", "Function Test"],
    examples: [
      {
        lineCode: "EL-001",
        description: "Electrical motor overhaul and test",
        unit: "Each",
        defaultQty: null,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "Include winding insulation, bearing renewal, alignment and run test.",
        calcRule: "unit_qty",
        referenceUnitRate: null,
        maxDiscountPct: null,
        isOptional: false,
        allowDiscount: true,
      },
    ],
  },
  automation: {
    extraHeaders: ["System / Panel", "I/O Count", "Calibration", "Software Backup", "Loop Test", "Sea Trial Required"],
    examples: [
      {
        lineCode: "AT-001",
        description: "Automation system inspection and calibration",
        unit: "Lot",
        defaultQty: 1,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "Specify panels, sensors, calibration certificates and loop tests.",
        calcRule: "lump_sum",
        referenceUnitRate: null,
        maxDiscountPct: null,
        isOptional: false,
        allowDiscount: true,
      },
    ],
  },
  bwts: {
    extraHeaders: ["Maker / Model", "Capacity", "Filter / UV / Electrolysis Scope", "Calibration", "Sampling", "Commissioning"],
    examples: [
      {
        lineCode: "BW-001",
        description: "BWTS service and commissioning",
        unit: "Lot",
        defaultQty: 1,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "Include maker service, consumables, calibration and commissioning report.",
        calcRule: "lump_sum",
        referenceUnitRate: null,
        maxDiscountPct: null,
        isOptional: false,
        allowDiscount: true,
      },
    ],
  },
  class_statutory: {
    extraHeaders: ["Survey Type", "Class / Flag", "Certificate", "Witness Point", "Due Date", "Report Required"],
    examples: [
      {
        lineCode: "CS-001",
        description: "Class survey attendance and certification",
        unit: "Lot",
        defaultQty: 1,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "State survey item, witness point and certificate/report required.",
        calcRule: "lump_sum",
        referenceUnitRate: null,
        maxDiscountPct: null,
        isOptional: false,
        allowDiscount: true,
      },
    ],
  },
  spares: {
    extraHeaders: ["Part Name", "Part No.", "Maker", "Model", "Qty Required", "Supply By"],
    examples: [
      {
        lineCode: "SP-001",
        description: "Critical spare supply",
        unit: "Each",
        defaultQty: null,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "List maker part number, certification and delivery requirement.",
        calcRule: "unit_qty",
        referenceUnitRate: null,
        maxDiscountPct: null,
        isOptional: false,
        allowDiscount: true,
      },
    ],
  },
  stores_consumables: {
    extraHeaders: ["Item", "Specification", "Pack Size", "Qty Required", "Certificate", "Delivery Location"],
    examples: [
      {
        lineCode: "SC-001",
        description: "Consumables supply",
        unit: "Lot",
        defaultQty: null,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "Specify grade, pack size, certificates and delivery timing.",
        calcRule: "unit_qty",
        referenceUnitRate: null,
        maxDiscountPct: null,
        isOptional: false,
        allowDiscount: true,
      },
    ],
  },
  paints: {
    extraHeaders: ["Paint Maker", "Product", "Color / Grade", "Volume L", "Area m²", "Owner / Yard Supply"],
    examples: [
      {
        lineCode: "PT-001",
        description: "Paint supply for hull / tanks",
        unit: "Litre",
        defaultQty: null,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "State maker, product, color, volume and thinner requirement.",
        calcRule: "unit_qty",
        referenceUnitRate: null,
        maxDiscountPct: null,
        isOptional: false,
        allowDiscount: true,
      },
    ],
  },
  agency_logistics: {
    extraHeaders: ["Service", "Port / Location", "No. of Moves", "Weight / Size", "Customs", "Transport Mode"],
    examples: [
      {
        lineCode: "AL-001",
        description: "Agency and logistics support",
        unit: "Lot",
        defaultQty: 1,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "Specify launch, transport, customs, landing and delivery scope.",
        calcRule: "lump_sum",
        referenceUnitRate: null,
        maxDiscountPct: null,
        isOptional: false,
        allowDiscount: true,
      },
    ],
  },
  miscellaneous: {
    extraHeaders: ["Work Type", "Location", "Basis of Quote", "Inclusions", "Exclusions", "Approval Required"],
    examples: [
      {
        lineCode: "MS-001",
        description: "Miscellaneous repair / support item",
        unit: "Lot",
        defaultQty: 1,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "Use for defined work not covered by other categories.",
        calcRule: "lump_sum",
        referenceUnitRate: null,
        maxDiscountPct: null,
        isOptional: true,
        allowDiscount: true,
      },
    ],
  },
  contingency: {
    extraHeaders: ["Contingency Type", "Trigger / Condition", "Allowance Basis", "Approval Level", "Cap Amount", "Remarks"],
    examples: [
      {
        lineCode: "CT-001",
        description: "Contingency allowance",
        unit: "Lot",
        defaultQty: 1,
        scopeDays: null,
        scopeAreaM2: null,
        scopeNotes: "Use only when approved; state trigger, cap and approval level.",
        calcRule: "lump_sum",
        referenceUnitRate: null,
        maxDiscountPct: 0,
        isOptional: true,
        allowDiscount: false,
      },
    ],
  },
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

function categoryTemplateForBucket(bucket: string): CategoryTemplateDef {
  return (
    CATEGORY_SPEC_TEMPLATES[bucket] ?? {
      extraHeaders: [...COMMON_SPEC_EXTRA_HEADERS],
      examples: [
        {
          lineCode: "",
          description: "",
          unit: "",
          defaultQty: null,
          scopeDays: null,
          scopeAreaM2: null,
          scopeNotes: "",
          calcRule: "lump_sum",
          referenceUnitRate: null,
          maxDiscountPct: null,
          isOptional: false,
          allowDiscount: true,
        },
      ],
    }
  );
}

function sheetNameForCategory(category: CategoryLabelSource): string {
  const clean = `${category.categoryNo} ${category.name}`
    .replace(/[\\/?*[\]:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.slice(0, 31);
}

function appendExtraScopeNotes(
  row: Record<string, unknown>,
  scopeNotes: string | null,
): string | null {
  const standardHeaders = new Set<string>(SPEC_IMPORT_HEADERS as unknown as string[]);
  const extraPairs = Object.entries(row)
    .filter(([key, value]) => !standardHeaders.has(key) && str(value))
    .map(([key, value]) => `${key}: ${str(value)}`);

  if (extraPairs.length === 0) return scopeNotes;
  return [scopeNotes, extraPairs.join("; ")].filter(Boolean).join("\n");
}

function specLineToTemplateRecord(
  line: SpecLineLike,
  categories: CategoryLabelSource[],
): Record<SpecImportHeader, string | number> {
  return {
    "Category No": categoryNoForBucket(line.bucket, categories),
    Category: categoryNameForBucket(line.bucket, categories),
    Code: line.lineCode ?? "",
    "Description (EN)": line.description,
    中文: line.descriptions?.zh ?? "",
    日本語: line.descriptions?.ja ?? "",
    Unit: line.unit ?? "",
    Qty: line.defaultQty ?? "",
    Days: line.scopeDays ?? "",
    "Area m²": line.scopeAreaM2 ?? "",
    "Calc Rule": line.calcRule,
    "Ref Rate": line.referenceUnitRate ?? "",
    "Max Discount %": line.maxDiscountPct ?? "",
    "Scope Notes": line.scopeNotes ?? "",
    Optional: line.isOptional ? "Y" : "N",
    "Allow Discount": line.allowDiscount !== false ? "Y" : "N",
  };
}

function needsQty(rule: string): boolean {
  return ["unit_qty", "unit_qty_days", "watch", "connection_daily", "connect_disconnect"].includes(rule);
}

function needsDays(rule: string): boolean {
  return ["per_day", "unit_qty_days", "watch", "connection_daily"].includes(rule);
}

function needsArea(rule: string): boolean {
  return rule === "per_m2";
}

function categorySpecificStandardHeaders(category: CategoryLabelSource): SpecImportHeader[] {
  const template = categoryTemplateForBucket(category.slug);
  const rules = template.examples.map((example) => normalizeCalcRule(String(example.calcRule)));
  const headers: SpecImportHeader[] = [
    "Category No",
    "Category",
    "Code",
    "Description (EN)",
    "Unit",
  ];

  if (rules.some(needsQty)) headers.push("Qty");
  if (rules.some(needsDays)) headers.push("Days");
  if (rules.some(needsArea)) headers.push("Area m²");

  headers.push("Calc Rule");
  if (category.slug !== "contingency") headers.push("Ref Rate");
  if (template.examples.some((example) => example.allowDiscount !== false)) {
    headers.push("Max Discount %");
  }
  headers.push("Scope Notes", "Optional", "Allow Discount");
  return headers;
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
      scopeNotes: appendExtraScopeNotes(
        row,
        str(row["Scope Notes"] ?? row["Notes"] ?? row["notes"]) || null,
      ),
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
  const record = specLineToTemplateRecord(line, categories);
  return SPEC_IMPORT_HEADERS.map((header) => record[header]);
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
  const activeCategories = categories.length > 0 ? categories : STANDARD_DOCKING_CATEGORIES;
  const wb = XLSX.utils.book_new();

  const guideRows: (string | number)[][] = [
    ["Actinium-DD Specification Import Template"],
    ["Use one tab per category. Keep the standard columns unchanged; fill category-specific columns as needed."],
    ["Category-specific fields are imported into Scope Notes so shipyards receive the detailed specification."],
    [],
    ["Supported Calc Rules", "lump_sum, per_day, unit_qty, unit_qty_days, watch, connection_daily, connect_disconnect, per_m2"],
    ["Optional / Allow Discount", "Use Y or N"],
  ];
  const guide = XLSX.utils.aoa_to_sheet(guideRows);
  guide["!cols"] = [{ wch: 34 }, { wch: 120 }];
  XLSX.utils.book_append_sheet(wb, guide, "Guide");

  for (const category of activeCategories) {
    const template = categoryTemplateForBucket(category.slug);
    const standardHeaders = categorySpecificStandardHeaders(category);
    const headers = [
      ...standardHeaders,
      ...template.extraHeaders.filter((header) => !standardHeaders.includes(header as SpecImportHeader)),
    ];
    const data: (string | number)[][] = [headers as (string | number)[]];

    for (const example of template.examples) {
      const record = specLineToTemplateRecord({ ...example, bucket: category.slug }, activeCategories);
      data.push(headers.map((header) => (header in record ? record[header as SpecImportHeader] : "")));
    }

    const blankRecord: Record<SpecImportHeader, string | number> = {
      "Category No": category.categoryNo,
      Category: formatCategoryLabel(category),
      Code: "",
      "Description (EN)": "",
      中文: "",
      日本語: "",
      Unit: "",
      Qty: "",
      Days: "",
      "Area m²": "",
      "Calc Rule": "lump_sum",
      "Ref Rate": "",
      "Max Discount %": "",
      "Scope Notes": "",
      Optional: "N",
      "Allow Discount": "Y",
    };
    data.push(headers.map((header) => (header in blankRecord ? blankRecord[header as SpecImportHeader] : "")));

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = headers.map((header) => ({
      wch: header.length > 18 ? Math.min(header.length + 4, 34) : 18,
    }));
    XLSX.utils.book_append_sheet(wb, ws, sheetNameForCategory(category));
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
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
