import { JOB_CATEGORIES } from "@/lib/superintendent/constants";

/** Machinery trades — chief/second engineer primary scope. */
export const MACHINERY_JOB_CATEGORIES = ["ME", "AE", "boiler", "pumps", "piping"] as const;

/** Electrical trades — ETO primary; CE/2E may also create these. */
export const ELECTRICAL_JOB_CATEGORIES = ["electrical", "navigation"] as const;

/** Deck department job categories. */
export const DECK_JOB_CATEGORIES = [
  "deck",
  "navigation",
  "safety",
  "cargo",
  "tanks",
  "hull",
  "painting",
  "steel",
  "docking",
] as const;

const ENGINE_RANKS = new Set(["CENG", "2ENG", "3ENG", "4ENG"]);
const DECK_RANKS = new Set(["MASTER", "COFF", "2OFF", "3OFF"]);

export function getCrewJobCategories(roleCode: string | null | undefined): string[] {
  if (!roleCode) return [...JOB_CATEGORIES];

  if (ENGINE_RANKS.has(roleCode)) {
    return [...MACHINERY_JOB_CATEGORIES, ...ELECTRICAL_JOB_CATEGORIES, "miscellaneous"];
  }

  if (roleCode === "ETO") {
    return [...ELECTRICAL_JOB_CATEGORIES, "safety", "miscellaneous"];
  }

  if (DECK_RANKS.has(roleCode)) {
    return [...DECK_JOB_CATEGORIES, "miscellaneous"];
  }

  return ["miscellaneous"];
}

export function isJobCategoryAllowedForCrew(
  roleCode: string | null | undefined,
  category: string,
): boolean {
  return getCrewJobCategories(roleCode).includes(category);
}
