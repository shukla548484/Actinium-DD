"use client";

import { useEffect, useState } from "react";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DEFAULT_SHIPYARD_QUOTE_LANG_PREFS,
  ensureShipyardQuoteLangPrefs,
  resolveActiveLocale,
  saveShipyardQuoteLangPrefs,
  SHIPYARD_QUOTE_LOCALE_LABELS,
  SHIPYARD_QUOTE_SECONDARY_LOCALES,
  shipyardQuoteUi,
  type ShipyardQuoteLangPrefs,
  type ShipyardQuoteLocale,
} from "@/lib/i18n/shipyardQuotationUi";
import { ShipyardCurrencyBanner } from "@/components/shipyard/ShipyardCurrencyBanner";

type Props = {
  onChange?: (prefs: ShipyardQuoteLangPrefs, activeLocale: ShipyardQuoteLocale) => void;
};

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className ?? "min-w-0"}>
      <p className="mb-1.5 h-4 text-xs font-medium leading-4 text-muted-foreground">{label}</p>
      <div className="flex h-8 items-center">{children}</div>
    </div>
  );
}

export function ShipyardQuotationLanguageBar({ onChange }: Props) {
  const [prefs, setPrefs] = useState<ShipyardQuoteLangPrefs>(DEFAULT_SHIPYARD_QUOTE_LANG_PREFS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void ensureShipyardQuoteLangPrefs().then((loaded) => {
      if (cancelled) return;
      setPrefs(loaded);
      setReady(true);
      onChange?.(loaded, resolveActiveLocale(loaded));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount hydrate only
  }, []);

  function update(next: ShipyardQuoteLangPrefs) {
    const normalized: ShipyardQuoteLangPrefs =
      next.mode === "en_only"
        ? { ...next, active: "en", autoDetected: false }
        : {
            ...next,
            active:
              next.active === "en" || next.active === next.secondary
                ? next.active
                : next.secondary,
            autoDetected: false,
          };
    setPrefs(normalized);
    saveShipyardQuoteLangPrefs(normalized);
    onChange?.(normalized, resolveActiveLocale(normalized));
  }

  if (!ready) return null;

  const activeLocale = resolveActiveLocale(prefs);
  const t = (key: Parameters<typeof shipyardQuoteUi>[1]) => shipyardQuoteUi(activeLocale, key);
  const secondaryItems = SHIPYARD_QUOTE_SECONDARY_LOCALES.map((l) => ({
    value: l,
    label: SHIPYARD_QUOTE_LOCALE_LABELS[l],
  }));

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <Field label={t("language")}>
          <ToggleGroup
            value={[prefs.mode]}
            onValueChange={(values) => {
              const mode = values[values.length - 1] as ShipyardQuoteLangPrefs["mode"] | undefined;
              if (!mode) return;
              update({
                ...prefs,
                mode,
                active: mode === "en_only" ? "en" : prefs.secondary,
              });
            }}
            spacing={0}
            variant="outline"
            size="sm"
            className="h-8"
          >
            <ToggleGroupItem value="en_only" className="h-8 px-3 text-xs">
              {t("englishOnly")}
            </ToggleGroupItem>
            <ToggleGroupItem value="dual" className="h-8 px-3 text-xs">
              {t("dualLanguage")}
            </ToggleGroupItem>
          </ToggleGroup>
        </Field>

        {prefs.mode === "dual" ? (
          <>
            <Field label={t("secondaryLanguage")} className="w-[13rem] min-w-[13rem]">
              <LabeledSelect
                items={secondaryItems}
                value={prefs.secondary}
                onValueChange={(v) => {
                  const secondary = (SHIPYARD_QUOTE_SECONDARY_LOCALES as string[]).includes(v)
                    ? (v as Exclude<ShipyardQuoteLocale, "en">)
                    : prefs.secondary;
                  update({
                    ...prefs,
                    secondary,
                    active: prefs.active === "en" ? "en" : secondary,
                  });
                }}
                className="h-8 w-full py-0"
              />
            </Field>
            <Field label={t("viewIn")}>
              <ToggleGroup
                value={[prefs.active === "en" ? "en" : prefs.secondary]}
                onValueChange={(values) => {
                  const next = values[values.length - 1] as ShipyardQuoteLocale | undefined;
                  if (!next) return;
                  update({
                    ...prefs,
                    active: next === "en" ? "en" : prefs.secondary,
                  });
                }}
                spacing={0}
                variant="outline"
                size="sm"
                className="h-8"
              >
                <ToggleGroupItem value="en" className="h-8 px-3 text-xs">
                  {SHIPYARD_QUOTE_LOCALE_LABELS.en}
                </ToggleGroupItem>
                <ToggleGroupItem value={prefs.secondary} className="h-8 px-3 text-xs">
                  {SHIPYARD_QUOTE_LOCALE_LABELS[prefs.secondary]}
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
          </>
        ) : null}

        <ShipyardCurrencyBanner />
      </div>
    </div>
  );
}
