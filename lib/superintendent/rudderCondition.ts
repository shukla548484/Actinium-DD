export const RUDDER_TYPES = [
  { value: "semi_balanced", label: "Semi-balanced (pintles)" },
  { value: "balanced_spade", label: "Balanced / spade (often no pintles)" },
  { value: "unbalanced_pintle", label: "Unbalanced / pintle rudder" },
  { value: "mariner_flap", label: "Mariner / flap" },
  { value: "other", label: "Other (specify)" },
] as const;

export type RudderTypeValue = (typeof RUDDER_TYPES)[number]["value"];

/** Types that normally have upper/lower pintles. Balanced/spade hanging rudders do not. */
export const PINTLE_RUDDER_TYPES: ReadonlySet<string> = new Set([
  "semi_balanced",
  "unbalanced_pintle",
  "mariner_flap",
]);

export const RUDDER_CLEARANCE_FIELDS = [
  {
    key: "propellerBearingClearance",
    label: "Propeller bearing (last clearance)",
    pintleOnly: false,
  },
  {
    key: "neckCarrierBearingClearance",
    label: "Neck / carrier bearing clearance",
    pintleOnly: false,
  },
  {
    key: "jumpingClearance",
    label: "Jumping clearance",
    pintleOnly: false,
  },
  {
    key: "upperPintleClearance",
    label: "Upper pintle last clearance",
    pintleOnly: true,
  },
  {
    key: "lowerPintleClearance",
    label: "Lower pintle last clearance",
    pintleOnly: true,
  },
] as const;

export type RudderClearanceFieldKey = (typeof RUDDER_CLEARANCE_FIELDS)[number]["key"];

export function rudderTypeHasPintles(type: string): boolean {
  return PINTLE_RUDDER_TYPES.has(type);
}

/** Show pintle readings for pintle types and "other" (unknown); hide for balanced/spade. */
export function showPintleClearances(type: string): boolean {
  return rudderTypeHasPintles(type) || type === "other";
}

function isFilledNumber(value: unknown): boolean {
  if (value === "" || value == null) return false;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0;
}

export function validateRudderCondition(values: Record<string, unknown>): string | null {
  const rudderType = String(values.rudderType ?? "");
  if (!RUDDER_TYPES.some((o) => o.value === rudderType)) {
    return "Select rudder type";
  }
  if (rudderType === "other" && !String(values.rudderTypeOther ?? "").trim()) {
    return "Specify the rudder type";
  }

  const requirePintles = rudderTypeHasPintles(rudderType);
  for (const field of RUDDER_CLEARANCE_FIELDS) {
    if (field.pintleOnly && !requirePintles) continue;
    if (field.pintleOnly && rudderType === "other") continue;
    if (!isFilledNumber(values[field.key])) {
      return `${field.label} is required (0 is allowed)`;
    }
  }

  return null;
}
