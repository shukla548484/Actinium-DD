/** Planned propeller jobs for this docking — searchable multi-select, not checkboxes. */
export const PLANNED_PROPELLER_JOB_OPTIONS = [
  { value: "hub_cleaning_polishing", label: "Propeller hub cleaning and polishing" },
  { value: "blades_polishing", label: "Blades polishing" },
  { value: "crack_detection", label: "Crack detection" },
  { value: "net_guard_removal", label: "Net guard removal" },
  { value: "net_cutter_removal_renew", label: "Net cutter removal and check/renew if missing" },
  { value: "blade_edge_dressing", label: "Blade edge dressing" },
  { value: "boss_cap_cone", label: "Boss cap / cone work" },
] as const;

/** Explicit coating intent, including "none". Anything else seeds an extra dry-dock job. */
export const PROPELLER_COATING_OPTIONS = [
  { value: "none", label: "None" },
  { value: "silicone", label: "Silicone-based paint" },
  { value: "anti_friction", label: "Anti-friction paint" },
  { value: "both", label: "Both" },
] as const;

export type PropellerCoatingJobValue = (typeof PROPELLER_COATING_OPTIONS)[number]["value"];

const ALLOWED_PLANNED_JOBS = new Set(PLANNED_PROPELLER_JOB_OPTIONS.map((o) => o.value));
const POLISHING_JOB_KEYS = new Set(["hub_cleaning_polishing", "blades_polishing"]);

export const PROPELLER_COATING_JOB_TITLE = "Propeller silicone / anti-friction coating";
export const PROPELLER_COATING_JOB_CATEGORY = "hull";
export const PROPELLER_COATING_JOB_TAG = "[propellerCoatingJob=1]";

export function parsePlannedPropellerJobs(value: unknown, polishingRequired?: unknown): string[] {
  const fromList = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && ALLOWED_PLANNED_JOBS.has(item))
    : [];
  if (fromList.length > 0) return fromList;
  if (polishingRequired === true || polishingRequired === "true") {
    return ["blades_polishing"];
  }
  return [];
}

export function polishingRequiredFromPlannedJobs(jobs: string[]): boolean {
  return jobs.some((job) => POLISHING_JOB_KEYS.has(job));
}

export function parsePropellerCoatingJob(value: unknown): PropellerCoatingJobValue | "" {
  const raw = value == null ? "" : String(value);
  return PROPELLER_COATING_OPTIONS.some((o) => o.value === raw)
    ? (raw as PropellerCoatingJobValue)
    : "";
}

export function propellerCoatingCreatesJob(
  coating: string,
): coating is Exclude<PropellerCoatingJobValue, "none"> {
  return coating === "silicone" || coating === "anti_friction" || coating === "both";
}

function coatingLabel(coating: PropellerCoatingJobValue): string {
  return PROPELLER_COATING_OPTIONS.find((o) => o.value === coating)?.label ?? coating;
}

export function buildPropellerCoatingJobDescription(coating: PropellerCoatingJobValue): string {
  return [
    `Apply ${coatingLabel(coating).toLowerCase()} on the propeller this docking.`,
    "Seeded from vessel propeller input (scope). Do not duplicate this job on re-submit.",
    PROPELLER_COATING_JOB_TAG,
  ].join("\n");
}

export function validatePropellerCondition(values: Record<string, unknown>): string | null {
  const coating = parsePropellerCoatingJob(values.coatingJob);
  if (!coating) {
    return "Select propeller coating (none, silicone-based paint, anti-friction paint, or both)";
  }

  return null;
}
