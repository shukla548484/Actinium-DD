export const HULL_AREA_FIELDS = [
  { key: "flatBottomCondition", label: "Flat bottom" },
  { key: "verticalBottomCondition", label: "Vertical bottom" },
  { key: "bootTopCondition", label: "Boot top" },
] as const;

export type HullAreaFieldKey = (typeof HULL_AREA_FIELDS)[number]["key"];

/** Dry-dock hull condition tags — selected from a searchable multi-select, not listed as form fields. */
export const HULL_CONDITION_OPTIONS = [
  { value: "clean", label: "Clean / no fouling" },
  { value: "light_slime", label: "Light slime" },
  { value: "heavy_slime", label: "Heavy slime / weed" },
  { value: "light_barnacles", label: "Light barnacles" },
  { value: "moderate_barnacles", label: "Moderate barnacles" },
  { value: "heavy_barnacles", label: "Heavy barnacles" },
  { value: "light_paint_erosion", label: "Light paint erosion" },
  { value: "heavy_paint_breakdown", label: "Heavy paint breakdown" },
  { value: "light_rust", label: "Light rust" },
  { value: "excess_rust", label: "Excess rust" },
  { value: "pitting", label: "Pitting" },
  { value: "mechanical_damage", label: "Mechanical damage / indentations" },
] as const;

export const LOAD_LINE_WORK_OPTIONS = [
  { value: "paint_only", label: "Paint only (existing marks)" },
  { value: "change", label: "Change / amendment required" },
  { value: "not_required", label: "No work required" },
] as const;

const ALLOWED_CONDITIONS = new Set(HULL_CONDITION_OPTIONS.map((o) => o.value));

export function parseHullConditionValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && ALLOWED_CONDITIONS.has(item));
}

function isFilledNumber(value: unknown): boolean {
  if (value === "" || value == null) return false;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0;
}

function isAnsweredBoolean(value: unknown): boolean {
  return value === true || value === false || value === "true" || value === "false";
}

export function draftMarksTotal(values: Record<string, unknown>): number | null {
  const parts = [values.draftMarksForward, values.draftMarksMidship, values.draftMarksAft];
  if (!parts.every(isFilledNumber)) return null;
  return parts.reduce<number>((sum, v) => sum + Number(v), 0);
}

export function validateHullCondition(values: Record<string, unknown>): string | null {
  for (const area of HULL_AREA_FIELDS) {
    if (parseHullConditionValues(values[area.key]).length === 0) {
      return `${area.label}: select at least one hull condition`;
    }
  }

  if (!isFilledNumber(values.draftMarksForward)) {
    return "Draft marks forward is required (0 is allowed)";
  }
  if (!isFilledNumber(values.draftMarksMidship)) {
    return "Draft marks midship is required (0 is allowed)";
  }
  if (!isFilledNumber(values.draftMarksAft)) {
    return "Draft marks aft is required (0 is allowed)";
  }
  if (!isFilledNumber(values.plimsollMarks)) {
    return "Plimsoll marks to paint is required (0 is allowed)";
  }

  const loadLine = String(values.loadLineWork ?? "");
  if (!LOAD_LINE_WORK_OPTIONS.some((o) => o.value === loadLine)) {
    return "Select load line work (paint only, change, or not required)";
  }
  if (loadLine === "change" && !String(values.loadLineChangeNotes ?? "").trim()) {
    return "Describe the load line change / amendment";
  }

  if (!isAnsweredBoolean(values.paintFlagName)) {
    return "Flag name to be painted is required";
  }
  if (!isAnsweredBoolean(values.paintImoNumber)) {
    return "IMO number to be painted is required";
  }

  if (!Array.isArray(values.photos) || values.photos.length === 0) {
    return "Hull photos are required";
  }

  return null;
}
