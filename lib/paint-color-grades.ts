export type PaintColorOption = {
  colorGrade: string;
  colorName: string;
  colorHex: string;
  family: string;
};

/** Standard marine paint color grades with preview hex values. */
export const PAINT_COLOR_OPTIONS: PaintColorOption[] = [
  // White / off-white
  { colorGrade: "White", colorName: "White", colorHex: "#F8FAFC", family: "White" },
  { colorGrade: "Off White", colorName: "White", colorHex: "#E2E8F0", family: "White" },
  { colorGrade: "Cream", colorName: "White", colorHex: "#FEF3C7", family: "White" },

  // Grey
  { colorGrade: "Light Grey", colorName: "Grey", colorHex: "#CBD5E1", family: "Grey" },
  { colorGrade: "Grey", colorName: "Grey", colorHex: "#94A3B8", family: "Grey" },
  { colorGrade: "Dark Grey", colorName: "Grey", colorHex: "#64748B", family: "Grey" },
  { colorGrade: "Extra Dark Grey", colorName: "Grey", colorHex: "#475569", family: "Grey" },

  // Green
  { colorGrade: "Light Green", colorName: "Green", colorHex: "#86EFAC", family: "Green" },
  { colorGrade: "Green", colorName: "Green", colorHex: "#22C55E", family: "Green" },
  { colorGrade: "Dark Green", colorName: "Green", colorHex: "#166534", family: "Green" },

  // Blue
  { colorGrade: "Light Blue", colorName: "Blue", colorHex: "#93C5FD", family: "Blue" },
  { colorGrade: "Blue", colorName: "Blue", colorHex: "#2563EB", family: "Blue" },
  { colorGrade: "Dark Blue", colorName: "Blue", colorHex: "#1E3A8A", family: "Blue" },

  // Red
  { colorGrade: "Light Red", colorName: "Red", colorHex: "#FCA5A5", family: "Red" },
  { colorGrade: "Red", colorName: "Red", colorHex: "#DC2626", family: "Red" },
  { colorGrade: "Red Brown", colorName: "Red", colorHex: "#9A3412", family: "Red" },
  { colorGrade: "Dark Red", colorName: "Red", colorHex: "#991B1B", family: "Red" },

  // Brown
  { colorGrade: "Light Brown", colorName: "Brown", colorHex: "#D6A06A", family: "Brown" },
  { colorGrade: "Brown", colorName: "Brown", colorHex: "#92400E", family: "Brown" },
  { colorGrade: "Dark Brown", colorName: "Brown", colorHex: "#78350F", family: "Brown" },

  // Yellow / buff
  { colorGrade: "Light Yellow", colorName: "Yellow", colorHex: "#FEF08A", family: "Yellow" },
  { colorGrade: "Yellow", colorName: "Yellow", colorHex: "#EAB308", family: "Yellow" },
  { colorGrade: "Buff", colorName: "Buff", colorHex: "#D4A574", family: "Buff" },
  { colorGrade: "Light Buff", colorName: "Buff", colorHex: "#E8C9A0", family: "Buff" },

  // Orange
  { colorGrade: "Light Orange", colorName: "Orange", colorHex: "#FDBA74", family: "Orange" },
  { colorGrade: "Orange", colorName: "Orange", colorHex: "#EA580C", family: "Orange" },

  // Black
  { colorGrade: "Black", colorName: "Black", colorHex: "#1E293B", family: "Black" },
];

function normalizeColorKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolvePaintColorHex(
  colorGradeOrName: string | null | undefined
): string | null {
  if (!colorGradeOrName?.trim()) return null;
  const key = normalizeColorKey(colorGradeOrName);
  const match = PAINT_COLOR_OPTIONS.find(
    (c) =>
      normalizeColorKey(c.colorGrade) === key || normalizeColorKey(c.colorName) === key
  );
  return match?.colorHex ?? null;
}

export function findPaintColorOption(
  colorGradeOrName: string | null | undefined
): PaintColorOption | null {
  if (!colorGradeOrName?.trim()) return null;
  const key = normalizeColorKey(colorGradeOrName);
  return (
    PAINT_COLOR_OPTIONS.find(
      (c) =>
        normalizeColorKey(c.colorGrade) === key || normalizeColorKey(c.colorName) === key
    ) ?? null
  );
}

/** Match a color grade from text embedded in a product name (e.g. "… Red Brown"). */
export function inferPaintColorFromProductName(
  productName: string | null | undefined
): PaintColorOption | null {
  if (!productName?.trim()) return null;
  const lower = productName.toLowerCase();
  const sorted = [...PAINT_COLOR_OPTIONS].sort(
    (a, b) => b.colorGrade.length - a.colorGrade.length
  );
  for (const option of sorted) {
    if (lower.includes(option.colorGrade.toLowerCase())) {
      return option;
    }
  }
  return null;
}

export function searchPaintColors(
  query: string,
  options: PaintColorOption[] = PAINT_COLOR_OPTIONS
): PaintColorOption[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return options;
  return options.filter(
    (c) =>
      c.colorGrade.toLowerCase().includes(trimmed) ||
      c.colorName.toLowerCase().includes(trimmed) ||
      c.family.toLowerCase().includes(trimmed)
  );
}

export function mergePaintColorOptions(
  primary: PaintColorOption[],
  fallback: PaintColorOption[] = PAINT_COLOR_OPTIONS
): PaintColorOption[] {
  const seen = new Set<string>();
  const merged: PaintColorOption[] = [];
  for (const option of [...primary, ...fallback]) {
    const key = normalizeColorKey(option.colorGrade);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(option);
  }
  return merged;
}

export function paintColorOptionKey(option: PaintColorOption): string {
  return normalizeColorKey(option.colorGrade);
}
