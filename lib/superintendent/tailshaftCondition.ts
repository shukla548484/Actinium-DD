export const TAILSHAFT_SEAL_LEAKAGE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "minor", label: "Minor" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
] as const;

export const TAILSHAFT_REMOVAL_PLAN_OPTIONS = [
  { value: "remove_visual", label: "Removal and visual examination" },
  { value: "no_removal", label: "No tailshaft removal" },
] as const;

function isFilledNumber(value: unknown): boolean {
  if (value === "" || value == null) return false;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0;
}

export function validateTailshaftCondition(values: Record<string, unknown>): string | null {
  if (!isFilledNumber(values.runningHours)) {
    return "Running hours since last withdrawal is required";
  }

  const plan = String(values.removalPlan ?? "");
  if (!TAILSHAFT_REMOVAL_PLAN_OPTIONS.some((o) => o.value === plan)) {
    return "Select whether tailshaft removal and visual examination is planned for this docking";
  }

  return null;
}
