/** Generate a 3-letter company code from name (PMS pattern). */
export function generateCompanyCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .map((w) => w.charAt(0).toUpperCase())
      .join("")
      .slice(0, 3)
      .padEnd(3, "X");
  }
  return name.slice(0, 3).toUpperCase().padEnd(3, "X");
}

/** Next employee code: {COMPANY_CODE}.{0001} */
export function formatEmployeeCode(companyCode: string, seq: number): string {
  return `${companyCode}.${String(seq).padStart(4, "0")}`;
}

/** Standard vessel code format: AAA-BBB (uppercase letters). */
export const VESSEL_CODE_PATTERN = /^[A-Z]{3}-[A-Z]{3}$/;

const VESSEL_PREFIX_SKIP = /^(MV|MT|M\/V|SS|HMS|RV)$/i;

function lettersOnly(value: string): string {
  return value.replace(/[^a-zA-Z]/g, "").toUpperCase();
}

/** Normalize any input to AAA-BBB uppercase. */
export function normalizeVesselCode(input: string): string {
  const raw = input.trim().toUpperCase();
  const explicit = raw.match(/^([A-Z]{1,3})-([A-Z]{1,3})$/);
  if (explicit) {
    return `${explicit[1].padEnd(3, "X").slice(0, 3)}-${explicit[2].padEnd(3, "X").slice(0, 3)}`;
  }

  const compact = lettersOnly(raw);
  const left = compact.slice(0, 3).padEnd(3, "X");
  const right = compact.slice(3, 6).padEnd(3, "X");
  return `${left}-${right}`;
}

/** Derive AAA-BBB from vessel name (e.g. "Ocean Star" → OCE-STA). */
export function generateVesselCode(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => lettersOnly(w))
    .filter((w) => w.length > 0 && !VESSEL_PREFIX_SKIP.test(w));

  const source =
    words.length > 0 ? words : [lettersOnly(name) || "VESSEL"];

  if (source.length >= 2) {
    return normalizeVesselCode(`${source[0].slice(0, 3)}-${source[1].slice(0, 3)}`);
  }

  return normalizeVesselCode(source[0]);
}

/** Produce the next AAA-BBB variant when the base code is already taken. */
export function bumpVesselCode(code: string, attempt: number): string {
  const normalized = normalizeVesselCode(code);
  if (attempt <= 0) return normalized;

  const [left, right] = normalized.split("-");
  if (!left || !right) return normalized;

  const max = 26 ** 3;
  const current =
    (right.charCodeAt(0) - 65) * 676 +
    (right.charCodeAt(1) - 65) * 26 +
    (right.charCodeAt(2) - 65);
  const next = (current + attempt) % max;
  const r0 = Math.floor(next / 676);
  const r1 = Math.floor((next % 676) / 26);
  const r2 = next % 26;

  return `${left}-${String.fromCharCode(65 + r0)}${String.fromCharCode(65 + r1)}${String.fromCharCode(65 + r2)}`;
}
