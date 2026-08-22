/** Local currency units per 1 USD — static fallback when market API is unreachable. */
export const FX_FALLBACK_LOCAL_PER_USD: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.67,
  INR: 83,
  SGD: 1.34,
  HKD: 7.82,
  JPY: 150,
  CNY: 7.2,
  KRW: 1320,
  NOK: 10.5,
  SEK: 10.2,
  DKK: 6.85,
  AUD: 1.52,
  CAD: 1.36,
  MYR: 4.68,
  THB: 36,
  IDR: 15600,
  VND: 24800,
  PHP: 56,
  TRY: 34,
  ZAR: 18.5,
  BRL: 5,
  RUB: 90,
  CHF: 0.88,
  TWD: 32,
};

export const COMMON_QUOTE_CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "GBP", name: "British Pound", symbol: "£" },
] as const;

/** Map shipyard UI locale → suggested local currency. */
export const LOCALE_DEFAULT_CURRENCY: Record<string, string> = {
  en: "USD",
  zh: "CNY",
  ja: "JPY",
  fil: "PHP",
  tr: "TRY",
  ko: "KRW",
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Average ECB rate (via Frankfurter) over the last `days` calendar days.
 * Returns local currency units per 1 USD.
 */
export async function fetchMarketAverageLocalPerUsd(
  localCurrency: string,
  days = 30,
): Promise<{ localPerUsd: number; samples: number; from: string; to: string } | null> {
  const code = localCurrency.trim().toUpperCase();
  if (!code || code === "USD") {
    return { localPerUsd: 1, samples: 1, from: isoDate(new Date()), to: isoDate(new Date()) };
  }

  const end = new Date();
  const start = new Date();
  start.setUTCDate(end.getUTCDate() - Math.max(days, 1));
  const from = isoDate(start);
  const to = isoDate(end);

  try {
    const url = `https://api.frankfurter.app/${from}..${to}?from=USD&to=${encodeURIComponent(code)}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { rates?: Record<string, Record<string, number>> };
    const rates = data.rates ?? {};
    const values: number[] = [];
    for (const day of Object.keys(rates)) {
      const v = rates[day]?.[code];
      if (typeof v === "number" && Number.isFinite(v) && v > 0) values.push(v);
    }
    if (values.length === 0) return null;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return { localPerUsd: avg, samples: values.length, from, to };
  } catch {
    return null;
  }
}

export function fallbackLocalPerUsd(localCurrency: string): number {
  const code = localCurrency.trim().toUpperCase();
  return FX_FALLBACK_LOCAL_PER_USD[code] ?? 1;
}

export async function resolveMarketOrFallbackLocalPerUsd(localCurrency: string, days = 30) {
  const market = await fetchMarketAverageLocalPerUsd(localCurrency, days);
  if (market) {
    return {
      localPerUsd: market.localPerUsd,
      source: "market_30d_avg" as const,
      samples: market.samples,
      from: market.from,
      to: market.to,
    };
  }
  return {
    localPerUsd: fallbackLocalPerUsd(localCurrency),
    source: "fallback" as const,
    samples: 0,
    from: null as string | null,
    to: null as string | null,
  };
}

export function convertUsdToLocal(usd: number, localPerUsd: number): number {
  return usd * localPerUsd;
}

export function convertLocalToUsd(local: number, localPerUsd: number): number {
  if (!localPerUsd) return local;
  return local / localPerUsd;
}

export function formatFxRate(localPerUsd: number, localCurrency: string): string {
  const code = localCurrency.toUpperCase();
  if (code === "USD") return "1 USD = 1 USD";
  const rounded =
    localPerUsd >= 100 ? localPerUsd.toFixed(2) : localPerUsd >= 10 ? localPerUsd.toFixed(3) : localPerUsd.toFixed(4);
  return `1 USD = ${rounded} ${code}`;
}
