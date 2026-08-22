/**
 * Simple Dry Dock Jobs catalog (v1) — Paint Jobs template.
 * Separate from MTIL / DynamicScopeJobWizard library path.
 */

export const DD_SIMPLE_JOB_FAMILY = "paint" as const;

export type DdSimpleJobFamilyCode = typeof DD_SIMPLE_JOB_FAMILY;

export type DdSimplePaintJobTypeCode =
  | "hull_paint"
  | "cargo_hold_paint"
  | "cargo_tanks_paint"
  | "sea_chest_paint"
  | "ballast_tank_paint"
  | "chain_locker_paint"
  | "main_deck_paint"
  | "accommodation_outer_paint"
  | "engine_room_painting"
  | "other_tanks_painting";

export type DdSimpleJobAreaCode =
  | "topside"
  | "boot-top"
  | "vertical-bottom"
  | "flat-bottom"
  | "general";

export type DdSimplePrepMethodCode =
  | "cleaning"
  | "manual-scraping"
  | "blasting"
  | "sa1"
  | "sa2"
  | "sa2.5"
  | "sa3"
  | "hydroblasting"
  | "power-tool"
  | "other";

export const DD_SIMPLE_JOB_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "cancelled",
] as const;

export type DdSimpleJobStatusCode = (typeof DD_SIMPLE_JOB_STATUSES)[number];

export const DD_SIMPLE_JOB_STATUS_LABELS: Record<DdSimpleJobStatusCode, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const DD_SIMPLE_JOB_STATUS_ITEMS = [
  { value: "all", label: "All statuses" },
  ...DD_SIMPLE_JOB_STATUSES.map((value) => ({
    value,
    label: DD_SIMPLE_JOB_STATUS_LABELS[value],
  })),
];

export const DD_SIMPLE_PAINT_JOB_TYPES: {
  code: DdSimplePaintJobTypeCode;
  label: string;
  description: string;
  /** When true, hull zone areas are required on prep lines. */
  requiresHullAreas: boolean;
}[] = [
  {
    code: "hull_paint",
    label: "Hull Paint",
    description: "Topside, boot top, side bottom, flat bottom — prep by Sa grade + coats",
    requiresHullAreas: true,
  },
  {
    code: "cargo_hold_paint",
    label: "Cargo Hold Paint",
    description: "Cargo hold coating and surface preparation",
    requiresHullAreas: false,
  },
  {
    code: "cargo_tanks_paint",
    label: "Cargo Tanks Paint",
    description: "Cargo tank coating system",
    requiresHullAreas: false,
  },
  {
    code: "sea_chest_paint",
    label: "Sea Chest Paint",
    description: "Sea chest and grids coating",
    requiresHullAreas: false,
  },
  {
    code: "ballast_tank_paint",
    label: "Ballast Tank Paint",
    description: "Ballast tank coating",
    requiresHullAreas: false,
  },
  {
    code: "chain_locker_paint",
    label: "Chain Locker Paint",
    description: "Chain locker coating",
    requiresHullAreas: false,
  },
  {
    code: "main_deck_paint",
    label: "Main Deck Paint",
    description: "Main deck coating",
    requiresHullAreas: false,
  },
  {
    code: "accommodation_outer_paint",
    label: "Accommodation Outer Paint",
    description: "Accommodation exterior coating",
    requiresHullAreas: false,
  },
  {
    code: "engine_room_painting",
    label: "Engine Room Painting",
    description: "Engine room coating",
    requiresHullAreas: false,
  },
  {
    code: "other_tanks_painting",
    label: "Other Tanks Painting",
    description: "Other tank coating",
    requiresHullAreas: false,
  },
];

/** Hull zones used for Hull Paint costing. */
export const DD_SIMPLE_HULL_AREAS: { code: DdSimpleJobAreaCode; label: string }[] = [
  { code: "topside", label: "Top Side" },
  { code: "boot-top", label: "BootTop" },
  { code: "vertical-bottom", label: "Side Bottom" },
  { code: "flat-bottom", label: "Flat Bottom" },
];

export const DD_SIMPLE_GENERAL_AREA: { code: DdSimpleJobAreaCode; label: string } = {
  code: "general",
  label: "General / full scope",
};

/** Prep methods that drive unit rates (area × grade). */
export const DD_SIMPLE_PREP_METHODS: { code: DdSimplePrepMethodCode; label: string }[] = [
  { code: "cleaning", label: "Hull cleaning" },
  { code: "manual-scraping", label: "Manual scraping" },
  { code: "blasting", label: "Blasting (general)" },
  { code: "sa1", label: "Sa 1" },
  { code: "sa2", label: "Sa 2" },
  { code: "sa2.5", label: "Sa 2½" },
  { code: "sa3", label: "Sa 3" },
  { code: "hydroblasting", label: "Hydroblasting" },
  { code: "power-tool", label: "Power tool cleaning" },
  { code: "other", label: "Other" },
];

export function paintJobTypeLabel(code: string): string {
  return DD_SIMPLE_PAINT_JOB_TYPES.find((t) => t.code === code)?.label ?? code;
}

export function areaLabelForCode(code: string): string {
  if (code === DD_SIMPLE_GENERAL_AREA.code) return DD_SIMPLE_GENERAL_AREA.label;
  return DD_SIMPLE_HULL_AREAS.find((a) => a.code === code)?.label ?? code;
}

export function prepMethodLabelForCode(code: string): string {
  return DD_SIMPLE_PREP_METHODS.find((m) => m.code === code)?.label ?? code;
}

export function areasForJobType(jobType: string): { code: string; label: string }[] {
  const type = DD_SIMPLE_PAINT_JOB_TYPES.find((t) => t.code === jobType);
  if (type?.requiresHullAreas) return DD_SIMPLE_HULL_AREAS;
  return [DD_SIMPLE_GENERAL_AREA, ...DD_SIMPLE_HULL_AREAS];
}

export function defaultTitleForJobType(jobType: string): string {
  return paintJobTypeLabel(jobType);
}
