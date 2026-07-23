/**
 * Purchase budget code catalog — loaded from data/budget-codes.json
 * (generated from data/all-budget-codes.xlsx).
 */
import catalogJson from "@/data/budget-codes.json";

export type BudgetScope = "NORMAL" | "DRY_DOCK";

export type BudgetCodeEntry = {
  scope: BudgetScope;
  level: 1 | 2;
  code: string;
  name: string;
  parentCode: string | null;
  parentName: string | null;
  fundType: string | null;
  displayOrder: number;
  active: boolean;
};

type CatalogFile = {
  source: string;
  generatedAt: string;
  counts: Record<string, number>;
  codes: BudgetCodeEntry[];
};

const catalog = catalogJson as CatalogFile;

export const BUDGET_CODES_CATALOG: BudgetCodeEntry[] = catalog.codes;
export const BUDGET_CODES_COUNTS = catalog.counts;

const byCode = new Map<string, BudgetCodeEntry>();
for (const row of BUDGET_CODES_CATALOG) {
  // Prefer NORMAL when the same code exists in both (should not happen for DD-*).
  if (!byCode.has(row.code) || row.scope === "NORMAL") {
    byCode.set(row.code, row);
  }
}

/** Legacy display strings previously stored as budgetCode on requisitions. */
const LEGACY_BUDGET_LABEL_TO_CODE: Record<string, string> = {
  "3000 Stores & Consumables → 3200 General Stores": "3200",
  "3000 Stores & Consumables → 3210 Tools": "3400",
  "3000 Stores & Consumables → 3220 Safety": "3800",
  "3000 Stores → 3300 Chemicals": "3500",
  "3000 Stores → 3310 ER Chemicals": "3600",
  "3000 Stores → 3400 Paint": "10300",
  "3000 Stores → 3410 Paint Topside": "3400",
  "4000 Spares → 4100 Main Engine": "2100",
  "4000 Spares → 4200 Auxiliary": "2200",
  "4000 Spares → 4300 Deck": "2800",
  "5000 Provisions → 5100 Food": "1600",
  "5000 Provisions → 5200 Bond": "1600",
  "5000 Provisions → 5300 Galley": "1600",
  "6000 Lubricants → 6100 Lube Oil": "4200",
  "7000 Bunkers → 7100 Fuel": "12200",
};

export function findBudgetCode(code: string | null | undefined): BudgetCodeEntry | undefined {
  const trimmed = code?.trim();
  if (!trimmed) return undefined;
  return byCode.get(trimmed);
}

export function isKnownBudgetCode(code: string | null | undefined): boolean {
  return Boolean(findBudgetCode(code));
}

export function isLegacyBudgetLabel(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  if (LEGACY_BUDGET_LABEL_TO_CODE[trimmed]) return true;
  // Heuristic: old UI stored "L1 Name → L2 Name" display strings.
  return trimmed.includes("→") && !byCode.has(trimmed);
}

/** Map stored value (L2 code or legacy label) to a master L2 code when possible. */
export function normalizeBudgetCode(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (byCode.has(trimmed)) return trimmed;
  const fromLegacy = LEGACY_BUDGET_LABEL_TO_CODE[trimmed];
  if (fromLegacy) return fromLegacy;
  return null;
}

export function formatBudgetCodeLabel(
  code: string | null | undefined,
  opts?: { allowLegacy?: boolean },
): string {
  const trimmed = code?.trim();
  if (!trimmed) return "";

  const entry = findBudgetCode(trimmed);
  if (entry) {
    if (entry.level === 2 && entry.parentCode) {
      return `${entry.parentCode} ${entry.parentName ?? ""} → ${entry.code} ${entry.name}`.replace(
        /\s+/g,
        " ",
      ).trim();
    }
    return `${entry.code} ${entry.name}`.trim();
  }

  if (opts?.allowLegacy !== false && isLegacyBudgetLabel(trimmed)) {
    const mapped = LEGACY_BUDGET_LABEL_TO_CODE[trimmed];
    if (mapped) {
      const mappedLabel = formatBudgetCodeLabel(mapped, { allowLegacy: false });
      return mappedLabel ? `${trimmed} (legacy → ${mapped})` : `${trimmed} (legacy)`;
    }
    return `${trimmed} (legacy)`;
  }

  return trimmed;
}

export function listBudgetCodes(opts?: {
  scope?: BudgetScope | "ALL";
  level?: 1 | 2;
  activeOnly?: boolean;
}): BudgetCodeEntry[] {
  const scope = opts?.scope ?? "ALL";
  const level = opts?.level;
  const activeOnly = opts?.activeOnly ?? true;
  return BUDGET_CODES_CATALOG.filter((row) => {
    if (scope !== "ALL" && row.scope !== scope) return false;
    if (level != null && row.level !== level) return false;
    if (activeOnly && !row.active) return false;
    return true;
  });
}

export function listL2BudgetSelectOptions(scope: BudgetScope | "ALL" = "NORMAL"): Array<{
  value: string;
  label: string;
  searchText: string;
}> {
  return listBudgetCodes({ scope, level: 2, activeOnly: true }).map((row) => {
    const label = formatBudgetCodeLabel(row.code);
    return {
      value: row.code,
      label,
      searchText: `${row.code} ${row.name} ${row.parentCode ?? ""} ${row.parentName ?? ""} ${row.scope}`,
    };
  });
}

/**
 * Resolve a writable budget code for a new requisition.
 * Accepts an L2 master code, or maps a legacy label; rejects unknown values.
 */
export function resolveWritableBudgetCode(input: {
  budgetCode?: string | null;
  subCategoryCode?: string | null;
  requisitionType?: string | null;
  requisitionPurpose?: string | null;
}): { budgetCode: string | null; error?: string } {
  const explicit = input.budgetCode?.trim() || null;
  if (explicit) {
    const normalized = normalizeBudgetCode(explicit);
    if (normalized) return { budgetCode: normalized };
    if (isLegacyBudgetLabel(explicit)) {
      // Persist legacy string as-is only when we cannot map it (should not happen for known list).
      return { budgetCode: explicit };
    }
    return {
      budgetCode: null,
      error: `Unknown budget code "${explicit}". Select a code from the master catalog.`,
    };
  }

  const auto = autoBudgetCodeForRequisition({
    requisitionType: input.requisitionType,
    subCategoryCode: input.subCategoryCode,
    requisitionPurpose: input.requisitionPurpose,
  });
  return { budgetCode: auto };
}

export function autoBudgetCodeForRequisition(input: {
  requisitionType?: string | null;
  subCategoryCode?: string | null;
  requisitionPurpose?: string | null;
}): string | null {
  const type = input.requisitionType?.trim() || "";
  const sub = input.subCategoryCode?.trim() || "";
  const purpose = input.requisitionPurpose?.trim() || "";

  if (purpose === "DRY_DOCK") {
    if (sub) {
      const fromSubDd = SUBCATEGORY_DEFAULT_BUDGET_CODE_DRY_DOCK[sub];
      if (fromSubDd && byCode.has(fromSubDd)) return fromSubDd;
    }
    const ddDefault = DEFAULT_BUDGET_BY_TYPE_DRY_DOCK[type];
    if (ddDefault && byCode.has(ddDefault)) return ddDefault;
  }

  if (sub) {
    const fromSub = SUBCATEGORY_DEFAULT_BUDGET_CODE[sub];
    if (fromSub) return fromSub;
  }

  return DEFAULT_BUDGET_BY_TYPE[type] ?? null;
}

/**
 * Sub-category → Level 2 budget code (NORMAL master).
 * Keys are stable requisition sub-category codes used by Create Requisition.
 */
export const SUBCATEGORY_DEFAULT_BUDGET_CODE: Record<string, string> = {
  // Stores
  "STR-CONS": "3200", // Deck Stores
  "STR-TOOLS": "3400", // Workshop Stores
  "STR-SAFETY": "3800", // Safety Stores
  "STR-CHE": "3500", // Cleaning Chemicals
  "STR-ENG": "3100", // Engine Stores
  "STR-ELEC": "3300", // Electrical Stores
  "STR-REF": "3700", // Refrigeration Stores
  // Spares
  "SPR-ME": "2100",
  "SPR-AE": "2200",
  "SPR-BOIL": "2300",
  "SPR-PUMP": "2400",
  "SPR-COMP": "2500",
  "SPR-ELEC": "2600",
  "SPR-AUTO": "2700",
  "SPR-DECK": "2800",
  "SPR-CARGO": "2900",
  // Provisions / galley (Crew Victualing)
  "PRO-FOOD": "1600",
  "PRO-BOND": "1600",
  "GLY-GEN": "1600",
  // Chemicals
  "CHE-DECK": "3500",
  "CHE-ER": "3600",
  // Paint / coatings → Dry Dock hull painting / workshop
  "PNT-HULL": "10300",
  "PNT-TOP": "3400",
  // Lubricants
  "LUB-GEN": "4200",
  "LUB-CYL": "4100",
  "LUB-SYS": "4200",
  "LUB-GENSET": "4300",
  "LUB-HYD": "4400",
  "LUB-GEAR": "4500",
  "LUB-COMP": "4600",
  "LUB-GREASE": "4700",
  // Bunkers / fuel
  "BNK-FUEL": "12200",
  "BNK-HFO": "12100",
  "BNK-VLSFO": "12200",
  "BNK-MGO": "12300",
  "BNK-LNG": "12400",
  "BNK-ADD": "12500",
  // Repairs
  "REP-ME": "5100",
  "REP-AE": "5200",
  "REP-BOIL": "5300",
  "REP-PUMP": "5400",
  "REP-ELEC": "5500",
  "REP-AUTO": "5600",
  "REP-DECK": "5700",
  "REP-CARGO": "5800",
  "REP-HULL": "5900",
  // Flag / class
  "FCL-CLASS": "6100",
  "FCL-FLAG": "6200",
  "FCL-STAT": "6300",
};

/** Optional Dry Dock L2 overrides for the same sub-category codes. */
export const SUBCATEGORY_DEFAULT_BUDGET_CODE_DRY_DOCK: Record<string, string> = {
  "STR-CONS": "DD-9040",
  "STR-ENG": "DD-9050",
  "STR-TOOLS": "DD-9080",
  "STR-SAFETY": "DD-9060",
  "STR-CHE": "DD-9050",
  "STR-ELEC": "DD-9050",
  "STR-REF": "DD-9050",
  "SPR-ME": "DD-9010",
  "SPR-AE": "DD-9020",
  "SPR-DECK": "DD-9030",
  "PNT-HULL": "DD-2020",
  "PNT-TOP": "DD-9070",
  "REP-HULL": "DD-2010",
  "REP-ME": "DD-3010",
  "FCL-CLASS": "DD-7010",
  "FCL-FLAG": "DD-7020",
  "FCL-STAT": "DD-7030",
};

/** Type-level default L2 when no sub-category is selected. */
export const DEFAULT_BUDGET_BY_TYPE: Record<string, string> = {
  STR: "3200",
  SPR: "2100",
  GLY: "1600",
  PNT: "10300",
  REP: "5100",
  SER: "9500",
  CTM: "9100",
  PRO: "1600",
  BNK: "12200",
  LUB: "4200",
  FCL: "6100",
  OTR: "9500",
  CHE: "3500",
};

/** Defaults when requisition purpose is Dry Dock (DD-* codes from master). */
export const DEFAULT_BUDGET_BY_TYPE_DRY_DOCK: Record<string, string> = {
  STR: "DD-9050", // General Stores (DD-9000 Spares Stores & Supplies)
  SPR: "DD-9010", // Main Engine Spares
  REP: "DD-2010", // Hull Pressure Washing / hull work entry
  SER: "DD-8010", // Maker / service attendance
  PNT: "DD-2030", // Hull painting when present — patched below if needed
  FCL: "DD-7010", // Class Survey
  OTR: "DD-12010", // Contingency Reserve
  GLY: "DD-10010",
  PRO: "DD-10010",
  LUB: "DD-9040",
  BNK: "DD-12010",
  CHE: "DD-9050",
  CTM: "DD-11010",
};

(() => {
  const ddL2 = listBudgetCodes({ scope: "DRY_DOCK", level: 2 });
  const byName = (re: RegExp) => ddL2.find((r) => re.test(r.name))?.code;
  const ensure = (key: string, preferred: string, fallbackRe: RegExp) => {
    if (byCode.has(preferred)) {
      DEFAULT_BUDGET_BY_TYPE_DRY_DOCK[key] = preferred;
      return;
    }
    DEFAULT_BUDGET_BY_TYPE_DRY_DOCK[key] = byName(fallbackRe) ?? ddL2[0]?.code ?? preferred;
  };
  ensure("STR", "DD-9050", /general stores|stores|consum/i);
  ensure("SPR", "DD-9010", /main engine spare|spares/i);
  ensure("REP", "DD-2010", /hull|steel/i);
  ensure("SER", "DD-8010", /maker|service|riding/i);
  ensure("PNT", "DD-2020", /hull painting|paint|coating/i);
  ensure("FCL", "DD-7010", /class survey|class/i);
  ensure("OTR", "DD-12010", /contingency/i);
  ensure("GLY", "DD-10010", /crew|victual|travel/i);
  ensure("PRO", "DD-10010", /crew|victual|travel/i);
  ensure("LUB", "DD-9040", /lube|oil|stores/i);
  ensure("CHE", "DD-9050", /chemical|stores/i);
  ensure("CTM", "DD-11010", /project management|management/i);
  ensure("BNK", "DD-12010", /contingency/i);
})();
