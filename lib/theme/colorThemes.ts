export const COLOR_THEMES = [
  { id: "default", label: "Neutral", swatch: "oklch(0.205 0 0)" },
  { id: "rose", label: "Rose", swatch: "oklch(0.55 0.2 15)" },
  { id: "orange", label: "Orange", swatch: "oklch(0.65 0.19 45)" },
  { id: "blue", label: "Blue", swatch: "oklch(0.55 0.18 250)" },
  { id: "green", label: "Green", swatch: "oklch(0.55 0.15 155)" },
  { id: "violet", label: "Violet", swatch: "oklch(0.55 0.2 290)" },
  { id: "zinc", label: "Zinc", swatch: "oklch(0.45 0.01 260)" },
] as const;

export type ColorThemeId = (typeof COLOR_THEMES)[number]["id"];

export const COLOR_THEME_STORAGE_KEY = "actinium-color-theme";

export function isColorThemeId(value: string | null | undefined): value is ColorThemeId {
  return COLOR_THEMES.some((t) => t.id === value);
}
