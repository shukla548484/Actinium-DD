/** Phrases that must appear near a day count for it to count as stated dry-dock days. */
export const DRY_DOCK_DAYS_CONTEXT =
  /dry\s*[- ]?\s*dock|drydock|graving\s*dock|in\s*dock|on\s*dock|dd\s+days?/i;

/** Line labels that indicate a per-day dock hire rate (not hull / paint work). */
export const DRY_DOCK_RATE_LABEL_KEYWORDS = [
  "dry dock",
  "drydock",
  "dry-dock",
  "dockage",
  "dock hire",
  "dock dues",
  "dock charges",
  "berth",
  "berthing",
  "lay day",
  "laytime",
  "lay days",
  "on dock",
  "in dock",
  "graving dock",
  "slip",
  "vessel in dock",
];

export const DRY_DOCK_RATE_EXCLUDE_KEYWORDS = [
  "paint",
  "coating",
  "blasting",
  "blast",
  "m2",
  "m²",
  "sqm",
  "square",
  "hull prep",
  "preparation",
  "washing",
  "scaffolding",
  "staging",
  "gangway",
  "electricity",
  "power",
  "water supply",
  "compressed air",
];

export const PER_DAY_UNIT_PATTERN =
  /\b(day|days|per\s*day|\/\s*day|pd|p\.?d\.?)\b/i;

export const DRY_DOCK_HEADER_SCAN_ROWS = 60;
