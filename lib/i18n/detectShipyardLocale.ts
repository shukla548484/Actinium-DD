import type { ShipyardQuoteLocale } from "@/lib/i18n/shipyardQuotationUi";
import { SHIPYARD_QUOTE_SECONDARY_LOCALES } from "@/lib/i18n/shipyardQuotationUi";

export type DetectedShipyardLocale = Exclude<ShipyardQuoteLocale, "en">;

const COUNTRY_TO_LOCALE: Record<string, DetectedShipyardLocale> = {
  CN: "zh",
  TW: "zh",
  HK: "zh",
  MO: "zh",
  JP: "ja",
  KR: "ko",
  TR: "tr",
  PH: "fil",
};

const TIMEZONE_TO_LOCALE: Array<{ match: RegExp; locale: DetectedShipyardLocale }> = [
  { match: /^Asia\/(Shanghai|Chongqing|Harbin|Urumqi|Hong_Kong|Taipei|Macau)$/i, locale: "zh" },
  { match: /^Asia\/Tokyo$/i, locale: "ja" },
  { match: /^Asia\/Seoul$/i, locale: "ko" },
  { match: /^Europe\/Istanbul$/i, locale: "tr" },
  { match: /^Asia\/Manila$/i, locale: "fil" },
];

function asSecondary(locale: ShipyardQuoteLocale | null | undefined): DetectedShipyardLocale | null {
  if (!locale || locale === "en") return null;
  return (SHIPYARD_QUOTE_SECONDARY_LOCALES as string[]).includes(locale)
    ? (locale as DetectedShipyardLocale)
    : null;
}

/** Map ISO country code (e.g. CN, JP) to a supported local language. */
export function localeFromCountryCode(country: string | null | undefined): DetectedShipyardLocale | null {
  if (!country) return null;
  return COUNTRY_TO_LOCALE[country.trim().toUpperCase()] ?? null;
}

/** Prefer browser UI languages (zh-CN, ja, ko, …). */
export function localeFromBrowserLanguages(
  languages: readonly string[] | undefined,
): DetectedShipyardLocale | null {
  if (!languages?.length) return null;
  for (const raw of languages) {
    const tag = raw.trim().toLowerCase();
    if (!tag) continue;
    const primary = tag.split("-")[0] ?? tag;
    if (primary === "zh" || tag.startsWith("zh")) return "zh";
    if (primary === "ja") return "ja";
    if (primary === "ko") return "ko";
    if (primary === "tr") return "tr";
    if (primary === "fil" || primary === "tl") return "fil";
  }
  return null;
}

/** Fallback from IANA timezone when country/browser language are weak. */
export function localeFromTimeZone(timeZone: string | null | undefined): DetectedShipyardLocale | null {
  if (!timeZone) return null;
  for (const entry of TIMEZONE_TO_LOCALE) {
    if (entry.match.test(timeZone)) return entry.locale;
  }
  return null;
}

/**
 * Sync client-side guess: browser languages first, then timezone.
 * Used immediately; IP country from /api/geo/locale can refine afterward.
 */
export function detectLocaleFromClientHints(): DetectedShipyardLocale | null {
  if (typeof window === "undefined") return null;
  const fromLang = localeFromBrowserLanguages(navigator.languages?.length
    ? navigator.languages
    : [navigator.language]);
  if (fromLang) return fromLang;

  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return localeFromTimeZone(timeZone);
  } catch {
    return null;
  }
}

export function pickDetectedLocale(
  ...candidates: Array<DetectedShipyardLocale | ShipyardQuoteLocale | null | undefined>
): DetectedShipyardLocale | null {
  for (const candidate of candidates) {
    const secondary = asSecondary(candidate ?? null);
    if (secondary) return secondary;
  }
  return null;
}
