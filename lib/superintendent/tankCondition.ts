import type { InputFieldDef } from "@/lib/superintendent/inputCatalog/types";

/** Typical dry-dock tank jobs — selected from a searchable multi-select, not listed as form fields. */
export const TANK_JOB_OPTIONS = [
  { value: "inspection", label: "Inspection" },
  { value: "cleaning_desludging", label: "Cleaning / desludging" },
  { value: "gas_freeing", label: "Gas freeing" },
  { value: "coating_renewal", label: "Coating renewal" },
  { value: "steel_repair", label: "Steel repair" },
  { value: "anode_replacement", label: "Anode replacement" },
  { value: "manhole_ladder_repair", label: "Manhole / ladder repair" },
  { value: "utm", label: "Thickness measurement (UTM)" },
  { value: "cap_survey", label: "CAP survey" },
] as const;

export const CARGO_SPACE_KIND_OPTIONS = [
  { value: "cargo_tanks", label: "Cargo tanks" },
  { value: "cargo_holds", label: "Cargo holds" },
] as const;

export type CargoSpaceKind = (typeof CARGO_SPACE_KIND_OPTIONS)[number]["value"];
export type TankVesselClass = "tanker" | "bulk" | "other";
export type TankFamilyId = "ballast" | "cargo" | "engineRoom" | "other";

const ALLOWED_JOBS = new Set<string>(TANK_JOB_OPTIONS.map((o) => o.value));
const ALLOWED_CARGO_SPACE = new Set<string>(CARGO_SPACE_KIND_OPTIONS.map((o) => o.value));

export type TankFamilyDef = {
  id: TankFamilyId;
  countKey: "ballastTankCount" | "cargoSpaceCount" | "engineRoomTankCount" | "otherTankCount";
  defaultLabel: string;
  hint: string;
  locationsPlaceholder: string;
};

export const TANK_FAMILY_DEFS: readonly TankFamilyDef[] = [
  {
    id: "ballast",
    countKey: "ballastTankCount",
    defaultLabel: "Ballast tanks",
    hint: "Always applicable. Peak tanks, wing / double-bottom WBTs, heeling tanks.",
    locationsPlaceholder: "e.g. No. 1/2/3 WBT P&S, forepeak, afterpeak",
  },
  {
    id: "cargo",
    countKey: "cargoSpaceCount",
    defaultLabel: "Cargo tanks / holds",
    hint: "Cargo tanks on tankers; cargo holds on bulk carriers / dry cargo.",
    locationsPlaceholder: "e.g. COT 1C, 2P/S, slop P — or Hold 1–7",
  },
  {
    id: "engineRoom",
    countKey: "engineRoomTankCount",
    defaultLabel: "Engine-room tanks",
    hint: "Fuel oil, diesel oil, lubricating oil, fresh water, settling and service tanks.",
    locationsPlaceholder: "e.g. FO settling, DO service, M/E LO sump, FW tanks",
  },
  {
    id: "other",
    countKey: "otherTankCount",
    defaultLabel: "Other tanks",
    hint: "Optional. Voids, cofferdams, and similar spaces.",
    locationsPlaceholder: "e.g. void spaces, cofferdams",
  },
];

export function tankFamilyFieldKeys(id: TankFamilyId) {
  return {
    jobsPlanned: `${id}JobsPlanned`,
    locations: `${id}Locations`,
    jobs: `${id}Jobs`,
    coatingRenewal: `${id}CoatingRenewal`,
    coatingPercent: `${id}CoatingPercent`,
    capCertification: `${id}CapCertification`,
    notes: `${id}Notes`,
  } as const;
}

/**
 * Classify free-text Vessel.vesselType for tank-condition cargo space.
 * Unlike job-library `normalizeVesselTypeKey`, generic "carrier" is not treated as bulk
 * (that would mis-class container / gas carriers).
 */
export function classifyTankVesselType(vesselType?: string | null): TankVesselClass {
  const v = (vesselType ?? "").trim().toLowerCase();
  if (!v) return "other";
  if (v.includes("tank")) return "tanker";
  if (v.includes("bulk") || v.includes("bulker") || v.includes("ore carrier")) return "bulk";
  return "other";
}

export function lockedCargoSpaceKind(vesselType?: string | null): CargoSpaceKind | null {
  const vesselClass = classifyTankVesselType(vesselType);
  if (vesselClass === "tanker") return "cargo_tanks";
  if (vesselClass === "bulk") return "cargo_holds";
  return null;
}

export function resolveCargoSpaceKind(
  values: Record<string, unknown>,
  vesselType?: string | null,
): CargoSpaceKind | "" {
  const locked = lockedCargoSpaceKind(vesselType);
  if (locked) return locked;
  const stored = values.cargoSpaceKind;
  if (typeof stored === "string" && ALLOWED_CARGO_SPACE.has(stored)) {
    return stored as CargoSpaceKind;
  }
  return "";
}

export function cargoSpaceCountLabel(kind: string): string {
  if (kind === "cargo_holds") return "Number of cargo holds";
  if (kind === "cargo_tanks") return "Number of cargo tanks";
  return "Number of cargo tanks / cargo holds";
}

export function cargoFamilyLabel(kind: string): string {
  if (kind === "cargo_holds") return "Cargo holds";
  if (kind === "cargo_tanks") return "Cargo tanks";
  return "Cargo tanks / holds";
}

export function parseTankJobs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && ALLOWED_JOBS.has(item));
}

export function isFilledCount(value: unknown): boolean {
  if (value === "" || value == null) return false;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0;
}

function isAnsweredBoolean(value: unknown): boolean {
  return value === true || value === false || value === "true" || value === "false";
}

function asBoolean(value: unknown): boolean | null {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

function hasAttachedFiles(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function familyLabel(family: TankFamilyDef, cargoKind: string): string {
  return family.id === "cargo" ? cargoFamilyLabel(cargoKind) : family.defaultLabel;
}

function validateFamilySpec(
  values: Record<string, unknown>,
  family: TankFamilyDef,
  cargoKind: string,
): string | null {
  const count = values[family.countKey];
  if (!isFilledCount(count) || Number(count) === 0) return null;

  const label = familyLabel(family, cargoKind);
  const keys = tankFamilyFieldKeys(family.id);
  const jobsPlanned = asBoolean(values[keys.jobsPlanned]);
  if (jobsPlanned == null) {
    return `${label}: say whether jobs are planned this docking (yes or no)`;
  }
  if (!jobsPlanned) return null;

  if (!String(values[keys.locations] ?? "").trim()) {
    return `${label}: locations / tanks involved are required when jobs are planned`;
  }
  if (parseTankJobs(values[keys.jobs]).length === 0) {
    return `${label}: select at least one planned job`;
  }

  const coating = asBoolean(values[keys.coatingRenewal]);
  if (coating == null) {
    return `${label}: coating renewal (yes / no) is required`;
  }
  if (coating) {
    if (!isFilledCount(values[keys.coatingPercent])) {
      return `${label}: expected coating area % is required when coating renewal is yes`;
    }
    const pct = Number(values[keys.coatingPercent]);
    if (pct < 0 || pct > 100) {
      return `${label}: coating area % must be between 0 and 100`;
    }
  }

  if (!isAnsweredBoolean(values[keys.capCertification])) {
    return `${label}: CAP certification required (yes / no)`;
  }

  return null;
}

/**
 * Server and client submit validation. Uses stored `cargoSpaceKind` (and optional vesselType
 * to resolve a locked tanker/bulker kind) so checks match the UI the user saw.
 */
export function validateTankCondition(
  values: Record<string, unknown>,
  vesselType?: string | null,
): string | null {
  if (!isFilledCount(values.ballastTankCount)) {
    return "Number of ballast tanks is required (0 is allowed)";
  }

  const cargoKind = resolveCargoSpaceKind(values, vesselType);
  if (!cargoKind) {
    return "Select whether this vessel has cargo tanks or cargo holds";
  }

  if (!isFilledCount(values.cargoSpaceCount)) {
    return `${cargoSpaceCountLabel(cargoKind)} is required (0 is allowed)`;
  }
  if (!isFilledCount(values.engineRoomTankCount)) {
    return "Number of engine-room tanks is required (0 is allowed)";
  }
  if (!isFilledCount(values.otherTankCount)) {
    return "Number of other tanks is required (0 is allowed)";
  }
  if (!hasAttachedFiles(values.tankPlan)) {
    return "Attach the tank plan";
  }

  for (const family of TANK_FAMILY_DEFS) {
    const err = validateFamilySpec(values, family, cargoKind);
    if (err) return err;
  }

  return null;
}

function familyCatalogFields(family: TankFamilyDef): InputFieldDef[] {
  const keys = tankFamilyFieldKeys(family.id);
  const label = family.defaultLabel;
  return [
    { key: keys.jobsPlanned, label: `${label}: jobs this docking`, type: "boolean" },
    { key: keys.locations, label: `${label}: locations`, type: "textarea" },
    {
      key: keys.jobs,
      label: `${label}: planned jobs`,
      type: "multiselect",
      options: [...TANK_JOB_OPTIONS],
    },
    { key: keys.coatingRenewal, label: `${label}: coating renewal`, type: "boolean" },
    { key: keys.coatingPercent, label: `${label}: expected coating area`, type: "number", unit: "%" },
    { key: keys.capCertification, label: `${label}: CAP certification required`, type: "boolean" },
    { key: keys.notes, label: `${label}: condition notes`, type: "textarea" },
  ];
}

export const TANK_CONDITION_FIELDS: InputFieldDef[] = [
  { key: "ballastTankCount", label: "Number of ballast tanks", type: "number", required: true },
  {
    key: "cargoSpaceKind",
    label: "Cargo space",
    type: "select",
    required: true,
    options: [...CARGO_SPACE_KIND_OPTIONS],
  },
  {
    key: "cargoSpaceCount",
    label: "Number of cargo tanks / cargo holds",
    type: "number",
    required: true,
  },
  {
    key: "engineRoomTankCount",
    label: "Number of engine-room tanks",
    type: "number",
    required: true,
  },
  {
    key: "otherTankCount",
    label: "Number of other tanks (voids / cofferdams)",
    type: "number",
    required: true,
  },
  { key: "tankPlan", label: "Tank plan", type: "files", required: true },
  ...TANK_FAMILY_DEFS.flatMap(familyCatalogFields),
];
