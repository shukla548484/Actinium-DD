/** Allowed characters for Login ID fields (office + vessel). HTML pattern attr. */
export const LOGIN_ID_INPUT_PATTERN = "[A-Z0-9._-]+";

/** Strip disallowed chars while typing; keep letters, digits, `.`, `-`, `_`. */
export function sanitizeLoginIdInput(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9._-]/g, "");
}

/** Compact form for hyphen/space/underscore-insensitive compare. Keeps `.` for office IDs. */
export function compactLoginIdKey(value: string): string {
  return value.trim().toUpperCase().replace(/[\s\-_]/g, "");
}

/**
 * Exact-match candidates for login lookup.
 * Includes uppercased, space-stripped, separator-stripped, and reconstructed
 * vessel IDs (`TAREVEMA01` → `TAR-EVE-MA01`) when hyphens were omitted.
 */
export function expandLoginLookupCandidates(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const upper = trimmed.toUpperCase();
  const noSpace = upper.replace(/\s+/g, "");
  const withoutSeparators = noSpace.replace(/[-_]/g, "");

  const out = new Set<string>([trimmed, upper, noSpace, withoutSeparators]);

  // Vessel IDs are AAA-BBB-… — rebuild hyphens when the user typed a compact form.
  if (
    !noSpace.includes(".") &&
    !noSpace.includes("-") &&
    withoutSeparators.length >= 8 &&
    /^[A-Z0-9]+$/.test(withoutSeparators)
  ) {
    out.add(
      `${withoutSeparators.slice(0, 3)}-${withoutSeparators.slice(3, 6)}-${withoutSeparators.slice(6)}`,
    );
  }

  return [...out].filter(Boolean);
}
