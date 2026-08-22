"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ShipyardQuotationLanguageBar } from "@/components/shipyard/ShipyardQuotationLanguageBar";
import {
  DEFAULT_SHIPYARD_QUOTE_LANG_PREFS,
  loadShipyardQuoteLangPrefs,
  resolveActiveLocale,
  shipyardQuoteUi,
  type ShipyardQuoteLangPrefs,
  type ShipyardQuoteLocale,
  type ShipyardQuoteUiKey,
} from "@/lib/i18n/shipyardQuotationUi";
import {
  resolveShipyardLangPacks,
  syncShipyardLangPacksFromNetwork,
} from "@/lib/i18n/shipyardLangPacks";

type DualLabel = string | ReactNode;

type ShipyardLanguageContextValue = {
  prefs: ShipyardQuoteLangPrefs;
  locale: ShipyardQuoteLocale;
  t: (key: ShipyardQuoteUiKey) => string;
  /** Dual mode: primary + other language subtitle. */
  label: (key: ShipyardQuoteUiKey) => DualLabel;
  setFromBar: (prefs: ShipyardQuoteLangPrefs, active: ShipyardQuoteLocale) => void;
  packsSource: "network" | "bundle" | "cache" | null;
};

const ShipyardLanguageContext = createContext<ShipyardLanguageContextValue | null>(null);

function DualText({ primary, secondary }: { primary: string; secondary: string }) {
  if (primary === secondary) return <>{primary}</>;
  return (
    <span className="inline-flex flex-col leading-tight">
      <span>{primary}</span>
      <span className="text-[10px] font-normal text-muted-foreground">{secondary}</span>
    </span>
  );
}

export function ShipyardLanguageProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<ShipyardQuoteLangPrefs>(DEFAULT_SHIPYARD_QUOTE_LANG_PREFS);
  const [locale, setLocale] = useState<ShipyardQuoteLocale>("en");
  const [ready, setReady] = useState(false);
  const [packsTick, setPacksTick] = useState(0);
  const [packsSource, setPacksSource] = useState<"network" | "bundle" | "cache" | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { ensureShipyardQuoteLangPrefs } = await import("@/lib/i18n/shipyardQuotationUi");
      const loaded = await ensureShipyardQuoteLangPrefs();
      if (cancelled) return;
      setPrefs(loaded);
      setLocale(resolveActiveLocale(loaded));
      const resolved = resolveShipyardLangPacks();
      setPacksSource(resolved.meta.source);
      setReady(true);

      const result = await syncShipyardLangPacksFromNetwork();
      if (cancelled) return;
      setPacksSource(result.source);
      setPacksTick((n) => n + 1);
    })();

    const onPacks = () => setPacksTick((n) => n + 1);
    const onLang = () => {
      const next = loadShipyardQuoteLangPrefs();
      setPrefs(next);
      setLocale(resolveActiveLocale(next));
    };
    const onOnline = () => {
      void syncShipyardLangPacksFromNetwork().then((result) => {
        setPacksSource(result.source);
        setPacksTick((n) => n + 1);
      });
    };
    window.addEventListener("actinium-shipyard-i18n-packs", onPacks);
    window.addEventListener("actinium-shipyard-lang", onLang);
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("actinium-shipyard-i18n-packs", onPacks);
      window.removeEventListener("actinium-shipyard-lang", onLang);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const setFromBar = useCallback((next: ShipyardQuoteLangPrefs, active: ShipyardQuoteLocale) => {
    setPrefs({ ...next, autoDetected: false });
    setLocale(active);
  }, []);

  const t = useCallback(
    (key: ShipyardQuoteUiKey) => {
      void packsTick;
      return shipyardQuoteUi(locale, key);
    },
    [locale, packsTick],
  );

  const label = useCallback(
    (key: ShipyardQuoteUiKey): DualLabel => {
      void packsTick;
      const primary = shipyardQuoteUi(locale, key);
      if (prefs.mode !== "dual") return primary;
      const otherLocale: ShipyardQuoteLocale = locale === "en" ? prefs.secondary : "en";
      const secondary = shipyardQuoteUi(otherLocale, key);
      return <DualText primary={primary} secondary={secondary} />;
    },
    [locale, packsTick, prefs.mode, prefs.secondary],
  );

  const value = useMemo(
    () => ({ prefs, locale, t, label, setFromBar, packsSource }),
    [prefs, locale, t, label, setFromBar, packsSource],
  );

  return (
    <ShipyardLanguageContext.Provider value={value}>
      <div className="sticky top-0 z-20 border-b bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
        {ready ? (
          <ShipyardQuotationLanguageBar onChange={setFromBar} />
        ) : (
          <div className="h-16 rounded-lg border bg-muted/30" aria-hidden />
        )}
      </div>
      {children}
    </ShipyardLanguageContext.Provider>
  );
}

export function useShipyardLanguage() {
  const ctx = useContext(ShipyardLanguageContext);
  if (!ctx) {
    return {
      prefs: DEFAULT_SHIPYARD_QUOTE_LANG_PREFS,
      locale: "en" as const,
      t: (key: ShipyardQuoteUiKey) => shipyardQuoteUi("en", key),
      label: (key: ShipyardQuoteUiKey) => shipyardQuoteUi("en", key) as DualLabel,
      setFromBar: () => undefined,
      packsSource: null as "network" | "bundle" | "cache" | null,
    };
  }
  return ctx;
}
