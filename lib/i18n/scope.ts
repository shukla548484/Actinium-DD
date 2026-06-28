import {
  STANDARD_DOCKING_CATEGORIES,
  categoryLabelFromList,
  normalizeCategorySlug,
} from "@/lib/tender/categories";

export type ScopeLocale = "en" | "zh" | "ja";

export const SCOPE_LOCALES: ScopeLocale[] = ["en", "zh", "ja"];

export const LOCALE_LABELS: Record<ScopeLocale, string> = {
  en: "English",
  zh: "中文 (Chinese)",
  ja: "日本語 (Japanese)",
};

export interface SpecLineDescriptions {
  en: string;
  zh: string | null;
  ja: string | null;
}

export function resolveSpecDescription(
  descriptions: SpecLineDescriptions,
  locale: ScopeLocale,
): string {
  if (locale === "zh" && descriptions.zh) return descriptions.zh;
  if (locale === "ja" && descriptions.ja) return descriptions.ja;
  return descriptions.en;
}

export function parseScopeLocale(value: string | null | undefined): ScopeLocale {
  if (value === "zh" || value === "ja" || value === "en") return value;
  return "en";
}

export const BUCKET_LABELS_I18N: Record<string, Record<ScopeLocale, string>> =
  Object.fromEntries(
    STANDARD_DOCKING_CATEGORIES.map((cat) => [
      cat.slug,
      {
        en: `${cat.categoryNo} ${cat.name}`,
        zh: `${cat.categoryNo} ${cat.name}`,
        ja: `${cat.categoryNo} ${cat.name}`,
      },
    ]),
  );

export function bucketLabel(
  bucket: string,
  locale: ScopeLocale,
  categories?: Array<{ categoryNo: string; slug: string; name: string; shortcut: string }>,
): string {
  const slug = normalizeCategorySlug(bucket);
  if (categories?.length) {
    return categoryLabelFromList(categories, slug);
  }
  return BUCKET_LABELS_I18N[slug]?.[locale] ?? categoryLabelFromList([], slug);
}
