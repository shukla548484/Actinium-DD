"use client";

import { useEffect, useState } from "react";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { LOCALE_DEFAULT_CURRENCY, COMMON_QUOTE_CURRENCIES } from "@/lib/fx/rates";
import {
  loadShipyardQuoteLangPrefs,
  resolveActiveLocale,
  type ShipyardQuoteLangPrefs,
} from "@/lib/i18n/shipyardQuotationUi";

const CURRENCY_ITEMS = COMMON_QUOTE_CURRENCIES.map((c) => ({
  value: c.code,
  label: `${c.code} — ${c.name}`,
}));

/** Currency follows the active page language; English → USD. */
export function currencyForLanguagePrefs(prefs: ShipyardQuoteLangPrefs): string {
  if (prefs.mode === "en_only") return "USD";
  const locale = resolveActiveLocale(prefs);
  if (locale === "en") return "USD";
  return LOCALE_DEFAULT_CURRENCY[locale] ?? "USD";
}

/**
 * Currency control for the shipyard module.
 * Renders as an inline field on the language-bar row.
 */
export function ShipyardCurrencyBanner(_props: { dryDockProjectId?: string | null } = {}) {
  const [localCurrency, setLocalCurrency] = useState("USD");

  useEffect(() => {
    const syncFromLanguage = () => {
      const prefs = loadShipyardQuoteLangPrefs();
      setLocalCurrency(currencyForLanguagePrefs(prefs));
    };

    syncFromLanguage();
    window.addEventListener("storage", syncFromLanguage);
    window.addEventListener("actinium-shipyard-lang", syncFromLanguage);
    return () => {
      window.removeEventListener("storage", syncFromLanguage);
      window.removeEventListener("actinium-shipyard-lang", syncFromLanguage);
    };
  }, []);

  return (
    <div className="min-w-0 sm:min-w-[16rem]">
      <p className="mb-1.5 h-4 text-xs font-medium leading-4 text-muted-foreground">
        Currency
      </p>
      <div className="flex h-8 min-w-[14rem] items-center">
        <LabeledSelect
          items={CURRENCY_ITEMS}
          value={localCurrency}
          onValueChange={setLocalCurrency}
          className="h-8 w-full min-w-[14rem] py-0"
        />
      </div>
    </div>
  );
}
