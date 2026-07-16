/**
 * IMPA cleaning materials & chemicals band (IMPA catalogue chapter 55).
 * Numeric range: 550000 through 559999 inclusive (6-digit chapter prefix 55).
 */
export const CHEMICAL_IMPA_NUMERIC_MIN = 550_000;
export const CHEMICAL_IMPA_NUMERIC_MAX = 559_999;

export const CHEMICAL_IMPA_CHAPTER_LABEL = "55 — Cleaning Material & Chemicals";

/** Extract numeric IMPA value for range checks (ignores non-digits). */
export function parseImpaCodeNumeric(impaCode: string | null | undefined): number | null {
  if (!impaCode) return null;
  const digits = impaCode.replace(/\D/g, "");
  if (!digits) return null;
  const value = Number.parseInt(digits, 10);
  return Number.isNaN(value) ? null : value;
}

export function isCleaningChemicalImpaCode(impaCode: string | null | undefined): boolean {
  const numeric = parseImpaCodeNumeric(impaCode);
  if (numeric == null) return false;
  return numeric >= CHEMICAL_IMPA_NUMERIC_MIN && numeric <= CHEMICAL_IMPA_NUMERIC_MAX;
}
