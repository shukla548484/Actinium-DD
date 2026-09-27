"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COMMON_QUOTE_CURRENCIES,
  convertLocalToUsd,
  formatFxRate,
} from "@/lib/fx/rates";
import { fmtMoney } from "@/lib/superintendent/formatters";

export type BudgetLineCurrencyValues = {
  currency: string;
  exchangeRateLocalPerUsd: number | null;
  budgetAmount: number;
  quotedAmount: number | null;
  actualAmount: number | null;
};

type Props = {
  dryDockProjectId?: string | null;
  initial?: Partial<BudgetLineCurrencyValues>;
};

function usdHint(local: number | null | undefined, rate: number, currency: string): string | null {
  if (currency === "USD") return null;
  if (local == null || !Number.isFinite(local) || !(rate > 0)) return null;
  return `≈ USD ${fmtMoney(convertLocalToUsd(local, rate))}`;
}

export function BudgetLineCurrencyFields({ dryDockProjectId, initial }: Props) {
  const [currency, setCurrency] = useState((initial?.currency || "USD").toUpperCase());
  const [rate, setRate] = useState<string>(
    initial?.exchangeRateLocalPerUsd != null && initial.exchangeRateLocalPerUsd > 0
      ? String(initial.exchangeRateLocalPerUsd)
      : currency === "USD"
        ? "1"
        : "",
  );
  const [budgetAmount, setBudgetAmount] = useState(String(initial?.budgetAmount ?? 0));
  const [quotedAmount, setQuotedAmount] = useState(
    initial?.quotedAmount != null ? String(initial.quotedAmount) : "",
  );
  const [actualAmount, setActualAmount] = useState(
    initial?.actualAmount != null ? String(initial.actualAmount) : "",
  );
  const [rateSource, setRateSource] = useState<string | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);

  // Keep saved rate on first mount when editing a non-USD line.
  const skipInitialFxFetch = useRef(
    Boolean(
      initial?.currency &&
        initial.currency.toUpperCase() !== "USD" &&
        initial.exchangeRateLocalPerUsd != null &&
        initial.exchangeRateLocalPerUsd > 0,
    ),
  );

  const isUsd = currency === "USD";
  const rateNum = Number(rate);
  const effectiveRate = isUsd ? 1 : rateNum > 0 ? rateNum : 0;

  useEffect(() => {
    if (isUsd) {
      setRate("1");
      setRateSource(null);
      return;
    }

    if (skipInitialFxFetch.current) {
      skipInitialFxFetch.current = false;
      return;
    }

    let cancelled = false;
    setLoadingRate(true);
    const params = new URLSearchParams({ localCurrency: currency });
    if (dryDockProjectId) params.set("dryDockProjectId", dryDockProjectId);

    void fetch(`/api/fx/rate?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const localPerUsd = d?.fx?.localPerUsd;
        if (typeof localPerUsd === "number" && localPerUsd > 0) {
          setRate(String(Number(localPerUsd.toFixed(6))));
          setRateSource(typeof d.fx.label === "string" ? d.fx.label : null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRate(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currency, dryDockProjectId, isUsd]);

  const budgetNum = budgetAmount === "" ? null : Number(budgetAmount);
  const quotedNum = quotedAmount === "" ? null : Number(quotedAmount);
  const actualNum = actualAmount === "" ? null : Number(actualAmount);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="currency">Currency *</Label>
          <Select
            value={currency}
            onValueChange={(v) => {
              if (v) setCurrency(String(v).toUpperCase());
            }}
          >
            <SelectTrigger id="currency" className="w-full">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {COMMON_QUOTE_CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="currency" value={currency} />
        </div>

        {!isUsd ? (
          <div className="space-y-2">
            <Label htmlFor="exchangeRateLocalPerUsd">
              FX rate ({currency} per 1 USD)
            </Label>
            <Input
              id="exchangeRateLocalPerUsd"
              name="exchangeRateLocalPerUsd"
              type="number"
              step="any"
              min="0"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              {loadingRate
                ? "Loading rate…"
                : rateNum > 0
                  ? `${formatFxRate(rateNum, currency)}${rateSource ? ` · ${rateSource}` : ""}`
                  : "Enter how many local units equal 1 USD."}
            </p>
          </div>
        ) : (
          <input type="hidden" name="exchangeRateLocalPerUsd" value="1" />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="budgetAmount">Budget amount ({currency})</Label>
          <Input
            id="budgetAmount"
            name="budgetAmount"
            type="number"
            step="any"
            value={budgetAmount}
            onChange={(e) => setBudgetAmount(e.target.value)}
          />
          {usdHint(budgetNum, effectiveRate, currency) ? (
            <p className="text-xs text-muted-foreground">
              {usdHint(budgetNum, effectiveRate, currency)}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="quotedAmount">Quoted ({currency})</Label>
          <Input
            id="quotedAmount"
            name="quotedAmount"
            type="number"
            step="any"
            value={quotedAmount}
            onChange={(e) => setQuotedAmount(e.target.value)}
          />
          {usdHint(quotedNum, effectiveRate, currency) ? (
            <p className="text-xs text-muted-foreground">
              {usdHint(quotedNum, effectiveRate, currency)}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="actualAmount">Actual ({currency})</Label>
          <Input
            id="actualAmount"
            name="actualAmount"
            type="number"
            step="any"
            value={actualAmount}
            onChange={(e) => setActualAmount(e.target.value)}
          />
          {usdHint(actualNum, effectiveRate, currency) ? (
            <p className="text-xs text-muted-foreground">
              {usdHint(actualNum, effectiveRate, currency)}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Parse FormData fields produced by BudgetLineCurrencyFields. */
export function parseBudgetLineCurrencyForm(form: FormData): {
  currency: string;
  exchangeRateLocalPerUsd: number | null;
  budgetAmount: number;
  quotedAmount: number | null;
  actualAmount: number | null;
} {
  const currency = String(form.get("currency") || "USD").toUpperCase();
  const rateRaw = form.get("exchangeRateLocalPerUsd");
  const exchangeRateLocalPerUsd =
    rateRaw != null && String(rateRaw) !== "" ? Number(rateRaw) : null;
  const quotedRaw = form.get("quotedAmount");
  const actualRaw = form.get("actualAmount");
  return {
    currency,
    exchangeRateLocalPerUsd:
      exchangeRateLocalPerUsd != null && Number.isFinite(exchangeRateLocalPerUsd)
        ? exchangeRateLocalPerUsd
        : null,
    budgetAmount: Number(form.get("budgetAmount") || 0),
    quotedAmount:
      quotedRaw != null && String(quotedRaw) !== "" ? Number(quotedRaw) : null,
    actualAmount:
      actualRaw != null && String(actualRaw) !== "" ? Number(actualRaw) : null,
  };
}
