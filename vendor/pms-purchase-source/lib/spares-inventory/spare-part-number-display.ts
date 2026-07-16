/** Heuristic split when item and part share one DB field (sparePartNumber). */
export function looksLikePartNumber(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return /^P\d/i.test(v) || v.includes("-") || /^[A-Z]{2,}\d/i.test(v);
}

export function displayCatalogItemNumber(sparePartNumber: string): string {
  const v = sparePartNumber.trim();
  if (!v) return "—";
  if (looksLikePartNumber(v)) return "—";
  return v;
}

export function displayCatalogPartNumber(sparePartNumber: string): string {
  const v = sparePartNumber.trim();
  if (!v) return "—";
  if (looksLikePartNumber(v)) return v;
  return "—";
}

/** DWG is persisted in `description` (alone or as "note · DWG"). */
export function displaySparePartDwgNumber(description?: string | null): string {
  const raw = description?.trim();
  if (!raw) return "—";

  const segments = raw
    .split(" · ")
    .map((s) => s.trim())
    .filter(Boolean);
  const nonPlate = segments.filter((s) => !/^Plate:/i.test(s));
  if (nonPlate.length === 0) return "—";

  if (nonPlate.length >= 2) {
    return nonPlate[nonPlate.length - 1];
  }

  const only = nonPlate[0];
  if (looksLikeDwgNumber(only)) return only;
  if (only.length <= 32 && !/\s{2,}/.test(only)) return only;
  return "—";
}

function looksLikeDwgNumber(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (/^(?:DWG|DRG|DRAWING)/i.test(v)) return true;
  if (/^[A-Z0-9][A-Z0-9./_-]{1,}$/i.test(v) && v.length <= 40) return true;
  return false;
}
