import type {
  DdRiskLevel,
  DryDockProjectType,
  JobAttachmentStage,
  JobAttachmentType,
  JobCatalogDepartment,
  JobCatalogWorkshop,
  JobChecklistResponseType,
  JobMeasurementInputType,
  JobPricingBasis,
  JobQuantityBasis,
  JobScopeResponsibleParty,
  JobSpareItemType,
  JobTemplateCategory,
  JobUiLayoutType,
} from "@prisma/client";
import type {
  JobAutoFillFieldDef,
  JobFormSectionDef,
  JobManualInputFieldDef,
  JobRequiredAttachmentDef,
  JobRequiredPhotoDef,
} from "@/lib/jobCatalog/types";
import { MTIL_PROJECT_TYPES, MTIL_VESSEL_TYPES } from "@/lib/mtil/standards";

export function cellStr(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

export function ynBool(value: unknown, field = "flag"): boolean {
  const raw = cellStr(value).toUpperCase();
  if (!raw) return false;
  if (raw === "Y" || raw === "YES" || raw === "TRUE" || raw === "1") return true;
  if (raw === "N" || raw === "NO" || raw === "FALSE" || raw === "0") return false;
  throw new Error(`Invalid Y/N value for ${field}: ${raw}`);
}

export function splitSemicolon(value: unknown): string[] {
  return cellStr(value)
    .split(/[;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function splitComma(value: unknown): string[] {
  return cellStr(value)
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const DEPARTMENT_MAP: Record<string, JobCatalogDepartment> = {
  engine: "engine",
  deck: "deck",
  electrical: "electrical",
  hull: "hull",
  safety: "safety",
  cargo: "cargo",
  accommodation: "accommodation",
  "engine/deck": "engine",
  "engine / deck": "engine",
};

const WORKSHOP_MAP: Record<string, JobCatalogWorkshop> = {
  "machinery workshop": "machinery",
  "machinery workshop / boiler service vendor": "machinery",
  "engine room": "machinery",
  "engine room / workshop": "machinery",
  "engine room / purifier room / workshop": "machinery",
  "engine room / pump room / cargo pump room": "machinery",
  "engine room / pump room": "machinery",
  "main deck / cargo tanks": "deck",
  "fore/aft deck / mast": "deck",
  "deck / engine room": "deck",
  "cargo pump room / deck": "deck",
  "steering gear room": "machinery",
  "pump room / cargo area": "machinery",
  machinery: "machinery",
  "pipe workshop": "pipe",
  pipe: "pipe",
  "pipe / machinery workshop": "pipe",
  "pipe/ machinery workshop": "pipe",
  "steel workshop": "steel",
  steel: "steel",
  "hull workshop": "hull",
  "paint workshop": "paint",
  paint: "paint",
  "electrical workshop": "electrical",
  "electrical / automation workshop": "electrical",
  "automation workshop": "electrical",
  "cargo workshop": "deck",
  "cargo / tank workshop": "deck",
  "tank workshop": "pipe",
  "deck workshop": "deck",
  deck: "deck",
  "deck / cargo workshop": "deck",
  "hull / steel workshop": "hull",
  "hull / steel / coatings workshop": "hull",
  "steel / hull workshop": "steel",
  "coatings workshop": "paint",
  "paint / coatings workshop": "paint",
  "safety workshop": "safety",
  "lsa workshop": "safety",
  "ffa workshop": "safety",
  "fire station / engine room": "safety",
  "accommodation workshop": "deck",
  "safety / lsa workshop": "safety",
  "qa/qc": "qa_qc",
  qa_qc: "qa_qc",
};

const RISK_MAP: Record<string, DdRiskLevel> = {
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical",
};

const PROJECT_TYPE_MAP: Record<string, DryDockProjectType> = {
  "special survey": "special_survey",
  "intermediate survey": "intermediate_survey",
  "damage repair": "damage_repair",
  "occasional repair": "occasional_repair",
  "underwater survey": "underwater_survey",
  "new installation": "new_installation",
  "emergency docking": "emergency_docking",
  "lay-up / reactivation": "layup_reactivation",
  "layup / reactivation": "layup_reactivation",
  "conversion / modification": "conversion_modification",
  "warranty repair": "warranty_repair",
  "dry dock": "special_survey",
  "running maintenance": "occasional_repair",
  pms: "occasional_repair",
  repair: "occasional_repair",
  "class survey": "special_survey",
};

const TEMPLATE_CATEGORY_MAP: Record<string, JobTemplateCategory> = {
  "machinery overhaul": "machinery_overhaul",
  inspection: "inspection",
  "general inspection": "inspection",
  measurement: "inspection",
  survey: "survey",
  repair: "repair",
  testing: "testing",
  performance: "testing",
  cleaning: "cleaning",
  documentation: "documentation",
  general: "general",
  "control system": "general",
  "fuel system": "general",
  shafting: "repair",
  "starting air": "general",
  pumps: "machinery_overhaul",
  valves: "repair",
  piping: "repair",
  "auxiliary machinery": "machinery_overhaul",
  "main propulsion": "machinery_overhaul",
  "deck machinery": "machinery_overhaul",
  "deck access": "inspection",
  "lsa/davit": "survey",
  "cargo system": "repair",
  "cargo securing": "repair",
  "hull structure": "repair",
  "steel renewal": "repair",
  hull: "repair",
  steel: "repair",
  coatings: "cleaning",
  "anti-fouling": "cleaning",
  tank: "inspection",
  rudder: "repair",
  generators: "machinery_overhaul",
  switchboards: "testing",
  motors: "machinery_overhaul",
  automation: "general",
  navigation: "inspection",
  communication: "general",
  "cargo tank": "inspection",
  "cargo tanks": "inspection",
  "cargo systems": "repair",
  "tank systems": "inspection",
  "ballast": "repair",
  "inert gas": "testing",
  "tank gauging": "inspection",
  "vapor system": "repair",
  lsa: "survey",
  ffa: "testing",
  "life saving": "survey",
  "life saving appliances": "survey",
  "fixed fire fighting": "testing",
  "fire fighting": "testing",
  accommodation: "cleaning",
  "safety equipment": "inspection",
  lifeboat: "survey",
  davit: "survey",
};

const UI_LAYOUT_MAP: Record<string, JobUiLayoutType> = {
  "card + tabs": "card_tabs",
  "card tabs": "card_tabs",
  card_tabs: "card_tabs",
  wizard: "wizard",
  "measurement table": "single_form",
  single_form: "single_form",
  "split panels": "split_panels",
};

const INPUT_TYPE_MAP: Record<string, JobMeasurementInputType> = {
  number: "number",
  text: "text",
  date: "date",
  dropdown: "dropdown",
  select: "dropdown",
  boolean: "text",
};

const RESPONSE_TYPE_MAP: Record<string, JobChecklistResponseType> = {
  "pass/fail/na": "pass_fail_na",
  pass_fail_na: "pass_fail_na",
  "yes/no": "yes_no",
  yes_no: "yes_no",
  text: "text",
  number: "number",
};

const PARTY_MAP: Record<string, JobScopeResponsibleParty> = {
  vessel: "owner",
  owner: "owner",
  "vessel crew": "owner",
  "chief engineer": "owner",
  "chief engineer / second engineer": "owner",
  "second engineer": "owner",
  "chief officer": "owner",
  "chief officer / second engineer": "owner",
  "bosun / chief officer": "owner",
  "chief officer / approved service engineer": "owner",
  "chief officer / service engineer": "owner",
  "second engineer / electrical officer": "owner",
  "duty engineer": "owner",
  "electrical officer / second engineer": "owner",
  "electrical officer": "owner",
  eto: "owner",
  "third engineer / eto": "owner",
  "eto / third engineer": "owner",
  "chief officer / eto": "owner",
  "safety officer / second engineer": "owner",
  "duty engineer / deck officer": "owner",
  "bosun / second engineer": "owner",
  master: "owner",
  "chief engineer / master": "owner",
  "master / class requirement": "owner",
  "class requirement": "class",
  "class surveyor": "class",
  "master / class surveyor": "class",
  superintendent: "owner",
  bosun: "owner",
  "oiler / third engineer": "owner",
  "third engineer": "owner",
  "chief engineer / technical superintendent": "owner",
  shipyard: "yard",
  "shipyard planner": "yard",
  "technical superintendent": "owner",
  yard: "yard",
  "vessel/yard": "owner",
  "vessel / yard": "owner",
  "yard/maker": "yard",
  "yard / maker": "yard",
  maker: "maker",
  class: "class",
};

const ATTACHMENT_TYPE_MAP: Record<string, JobAttachmentType> = {
  photo: "photo",
  report: "report",
  certificate: "certificate",
  drawing: "drawing",
  video: "video",
  manual: "manual",
};

const STAGE_MAP: Record<string, JobAttachmentStage> = {
  before: "before",
  during: "during",
  after: "after",
  final: "final",
};

const ITEM_TYPE_MAP: Record<string, JobSpareItemType> = {
  spare: "spare",
  consumable: "consumable",
  tool: "tool",
  material: "material",
};

const QUANTITY_BASIS_MAP: Record<string, JobQuantityBasis> = {
  "per job": "per_job",
  per_job: "per_job",
  "per unit": "per_unit",
  per_unit: "per_unit",
  "as required": "as_required",
  as_required: "as_required",
};

const PRICING_BASIS_MAP: Record<string, JobPricingBasis> = {
  "lump sum": "lump_sum",
  lump_sum: "lump_sum",
  "per unit": "per_unit",
  per_unit: "per_unit",
  "per day": "per_day",
  per_day: "per_day",
  "per meter": "per_meter",
  per_meter: "per_meter",
};

export function mapDepartment(value: unknown): JobCatalogDepartment {
  const raw = cellStr(value);
  const key = raw.toLowerCase();
  const mapped = DEPARTMENT_MAP[key];
  if (mapped) return mapped;
  const primary = key.split(/[/,;&]/)[0]?.trim();
  if (primary && DEPARTMENT_MAP[primary]) return DEPARTMENT_MAP[primary];
  throw new Error(`Unmapped department: ${raw}`);
}

export function mapWorkshop(value: unknown): JobCatalogWorkshop {
  const key = cellStr(value).toLowerCase();
  const mapped = WORKSHOP_MAP[key];
  if (!mapped) throw new Error(`Unmapped workshop: ${cellStr(value)}`);
  return mapped;
}

export function mapRiskLevel(value: unknown): DdRiskLevel {
  const key = cellStr(value).toLowerCase();
  const mapped = RISK_MAP[key];
  if (!mapped) throw new Error(`Unmapped risk level: ${cellStr(value)}`);
  return mapped;
}

export function mapProjectTypes(value: unknown): DryDockProjectType[] {
  const items = splitSemicolon(value);
  const mapped = items.map((item) => {
    const key = item.toLowerCase();
    const type = PROJECT_TYPE_MAP[key];
    if (!type) throw new Error(`Unmapped project type: ${item}`);
    return type;
  });
  return mapped;
}

export function mapVesselTypes(value: unknown): string[] {
  const raw = cellStr(value);
  if (!raw) return ["All Types"];
  if (raw.toLowerCase() === "all") return ["All Types"];
  const items = splitSemicolon(raw);
  for (const item of items) {
    const known = MTIL_VESSEL_TYPES.some(
      (v) => v.toLowerCase() === item.toLowerCase() || item.toLowerCase() === "all types",
    );
    if (!known && item.toLowerCase() !== "all") {
      throw new Error(`Unmapped vessel type: ${item}`);
    }
  }
  return items.map((item) => (item.toLowerCase() === "all" ? "All Types" : item));
}

export function mapTemplateCategory(value: unknown): JobTemplateCategory {
  const key = cellStr(value).toLowerCase();
  return TEMPLATE_CATEGORY_MAP[key] ?? "general";
}

export function mapUiLayout(value: unknown): JobUiLayoutType {
  const key = cellStr(value).toLowerCase();
  return UI_LAYOUT_MAP[key] ?? "card_tabs";
}

export function mapInputType(value: unknown): JobMeasurementInputType {
  const key = cellStr(value).toLowerCase();
  return INPUT_TYPE_MAP[key] ?? "text";
}

export function mapResponseType(value: unknown): JobChecklistResponseType {
  const key = cellStr(value).toLowerCase();
  return RESPONSE_TYPE_MAP[key] ?? "pass_fail_na";
}

export function mapResponsibleParty(value: unknown): JobScopeResponsibleParty {
  const key = cellStr(value).toLowerCase();
  const mapped = PARTY_MAP[key];
  if (!mapped) throw new Error(`Unmapped responsible party: ${cellStr(value)}`);
  return mapped;
}

export function mapAttachmentType(value: unknown): JobAttachmentType {
  const key = cellStr(value).toLowerCase();
  return ATTACHMENT_TYPE_MAP[key] ?? "manual";
}

export function mapAttachmentStage(value: unknown): JobAttachmentStage {
  const key = cellStr(value).toLowerCase();
  return STAGE_MAP[key] ?? "before";
}

export function mapItemType(value: unknown): JobSpareItemType {
  const key = cellStr(value).toLowerCase();
  return ITEM_TYPE_MAP[key] ?? "spare";
}

export function mapQuantityBasis(value: unknown): JobQuantityBasis {
  const key = cellStr(value).toLowerCase();
  return QUANTITY_BASIS_MAP[key] ?? "per_job";
}

export function mapPricingBasis(value: unknown): JobPricingBasis {
  const key = cellStr(value).toLowerCase();
  return PRICING_BASIS_MAP[key] ?? "lump_sum";
}

export function parseFormSections(value: unknown): JobFormSectionDef[] {
  return splitSemicolon(value).map((label, i) => ({
    key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `section_${i + 1}`,
    label,
    sortOrder: i + 1,
  }));
}

export function inferAutoFillSource(label: string): JobAutoFillFieldDef["source"] {
  const lower = label.toLowerCase();
  if (lower.includes("vessel") || lower === "imo") return "vessel";
  if (lower.includes("running") || lower.includes("overhaul") || lower.includes("maker") || lower.includes("model") || lower.includes("serial") || lower.includes("engine")) {
    return "machinery";
  }
  return "project";
}

export function parseAutoFillFields(value: unknown): JobAutoFillFieldDef[] {
  return splitComma(value).map((label) => {
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    return {
      key,
      label,
      source: inferAutoFillSource(label),
      path: key,
    };
  });
}

export function parseManualInputFields(value: unknown): JobManualInputFieldDef[] {
  return splitComma(value).map((label) => {
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    return {
      key,
      label,
      type: "text",
      section: "condition",
      required: false,
    };
  });
}

export function parseRequiredPhotos(value: unknown): JobRequiredPhotoDef[] {
  return splitSemicolon(value).map((label) => ({
    slot: label.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    label,
    mandatory: /before|after/i.test(label),
  }));
}

export function parseRequiredAttachments(value: unknown): JobRequiredAttachmentDef[] {
  return splitSemicolon(value).map((label) => {
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const lower = label.toLowerCase();
    const type = lower.includes("permit") || lower.includes("certificate")
      ? "certificate"
      : lower.includes("report") || lower.includes("sheet")
        ? "report"
        : "manual";
    return {
      key,
      label,
      type,
      mandatory: lower.includes("permit") || lower.includes("risk"),
    };
  });
}

export function parsePermitList(value: unknown): string[] {
  const raw = cellStr(value);
  if (!raw || raw.toUpperCase() === "N") return [];
  return splitSemicolon(raw);
}

export function parseOptionalFloat(value: unknown): number | null {
  const raw = cellStr(value);
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

export function normalizeStatusFlow(value: unknown): string {
  return cellStr(value).replace(/\s*>\s*/g, "→").replace(/→+/g, "→");
}

export const CONTROLLED_PROJECT_LABELS = new Set<string>(MTIL_PROJECT_TYPES);
export const CONTROLLED_VESSEL_LABELS = new Set<string>([...MTIL_VESSEL_TYPES, "All", "All Types"]);
