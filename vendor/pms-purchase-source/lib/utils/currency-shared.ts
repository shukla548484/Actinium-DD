/**
 * Currency conversion utilities - Client-safe shared code
 * Supports fallback static rates and formatting
 */

// Base currency for the system (can be configured per company/vessel)
export const BASE_CURRENCY = 'USD';

// Static exchange rates (fallback when database rates are not available)
// These are example rates - in production, fetch from an exchange rate API
export const FALLBACK_EXCHANGE_RATES: Record<string, number> = {
  USD: 1.0,
  AED: 3.67,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83.0,
  SGD: 1.34,
  HKD: 7.82,
  JPY: 150.0,
  CNY: 7.2,
  KRW: 1320.0,
  NOK: 10.5,
  SEK: 10.2,
  DKK: 6.85,
  AUD: 1.52,
  CAD: 1.36,
  MYR: 4.68,
  THB: 36.0,
  IDR: 15600.0,
  VND: 24800.0,
  PHP: 56.0,
  TRY: 30.0,
  ZAR: 18.5,
  BRL: 5.0,
  RUB: 90.0,
};

/** Human-readable label for a rate source. */
export const RATE_SOURCE_LABELS: Record<string, string> = {
  frozen: '🔒 Frozen (Per-Quote)',
  monthly: '📅 Monthly Confirmed',
  company: '🏢 Company Rate',
  market: '🌐 Live Market',
  fallback: '⚠️ Fallback',
};

/** Ordered list of common marine procurement currencies for UI selectors. */
export const COMMON_MARINE_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'TWD', name: 'Taiwan Dollar', symbol: 'NT$' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
];

export type CurrencyMeta = (typeof COMMON_MARINE_CURRENCIES)[number];

const CURRENCY_BY_CODE = Object.fromEntries(
  COMMON_MARINE_CURRENCIES.map((c) => [c.code, c])
) as Record<string, CurrencyMeta>;

/** Lookup currency name/symbol by ISO code; falls back to code-only metadata. */
export function getCurrencyMeta(code: string): CurrencyMeta {
  return CURRENCY_BY_CODE[code] ?? { code, name: code, symbol: code };
}

/** Label for currency selectors, e.g. "₽ RUB — Russian Ruble". */
export function formatCurrencyOptionLabel(c: CurrencyMeta): string {
  return `${c.symbol} ${c.code} — ${c.name}`;
}

/** Rate source type for tracking where a conversion rate came from. */
export type RateSource = 'frozen' | 'monthly' | 'company' | 'market' | 'fallback';

/** Result of a currency conversion with source tracking. */
export interface ConversionResult {
  amount: number;
  rate: number;
  source: RateSource;
  fromCurrency: string;
  toCurrency: string;
}

/**
 * Round amount to 2 decimal places (as per requirement: $12.654 -> $12.66)
 */
export function roundAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a currency amount with a rate source indicator badge text.
 */
export function formatCurrencyWithSource(
  amount: number,
  currency: string,
  source?: RateSource
): string {
  const formatted = formatCurrency(amount, currency);
  if (!source) return formatted;
  const label = RATE_SOURCE_LABELS[source] || source;
  return `${formatted} ${label}`;
}

/**
 * Synchronous fallback rate: multiplier so `amount × rate` = amount in `to`.
 * {@link FALLBACK_EXCHANGE_RATES} stores units of each currency per 1 USD (e.g. CNY 7.2 ⇒ 1 USD = 7.2 CNY).
 */
export function getExchangeRateSync(
  fromCurrency: string,
  toCurrency: string = BASE_CURRENCY
): number {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  if (from === to) return 1.0;

  const fromPerUsd = FALLBACK_EXCHANGE_RATES[from] ?? 1.0;
  const toPerUsd = FALLBACK_EXCHANGE_RATES[to] ?? 1.0;
  return toPerUsd / fromPerUsd;
}

/**
 * Convert amount from one currency to another (sync - uses fallback rates)
 */
export function convertCurrencySync(
  amount: number,
  fromCurrency: string,
  toCurrency: string = BASE_CURRENCY
): number {
  if (fromCurrency === toCurrency) return amount;
  const rate = getExchangeRateSync(fromCurrency, toCurrency);
  return roundAmount(amount * rate);
}

/** Convert quote-line amount to USD using frozen server rate when present; else static fallback. */
export function convertQuoteAmountToUsd(
  amount: number,
  quoteCurrency: string,
  quoteToUsdRate: number | null | undefined
): number {
  const cur = (quoteCurrency || BASE_CURRENCY).trim().toUpperCase();
  if (cur === BASE_CURRENCY) return roundAmount(amount);
  const r = quoteToUsdRate;
  if (r != null && !Number.isNaN(Number(r))) {
    return roundAmount(amount * Number(r));
  }
  return convertCurrencySync(amount, cur, BASE_CURRENCY);
}

/**
 * Convert a quote amount to a target currency using the best available rate.
 * Priority: frozen rate → fallback sync conversion.
 * This is a client-safe sync version; for full pipeline with source tracking use the async version.
 */
export function convertQuoteAmountToCurrency(
  amount: number,
  quoteCurrency: string,
  targetCurrency: string,
  quoteToUsdRate?: number | null
): { amount: number; source: RateSource } {
  const from = (quoteCurrency || BASE_CURRENCY).trim().toUpperCase();
  const to = (targetCurrency || BASE_CURRENCY).trim().toUpperCase();
  
  if (from === to) return { amount: roundAmount(amount), source: 'frozen' };
  
  // If target is USD and we have a frozen rate, use it
  if (to === BASE_CURRENCY && quoteToUsdRate != null && !Number.isNaN(Number(quoteToUsdRate))) {
    return { amount: roundAmount(amount * Number(quoteToUsdRate)), source: 'frozen' };
  }
  
  // If source is USD and we have a frozen rate (invert it)
  if (from === BASE_CURRENCY && quoteToUsdRate != null && !Number.isNaN(Number(quoteToUsdRate)) && Number(quoteToUsdRate) > 0) {
    return { amount: roundAmount(amount / Number(quoteToUsdRate)), source: 'frozen' };
  }
  
  // Fallback to sync conversion
  return { amount: convertCurrencySync(amount, from, to), source: 'fallback' };
}

/**
 * Format amount in dual currency (original and converted) - sync version
 */
export function formatDualCurrencySync(
  amount: number | null,
  currency: string,
  baseCurrency: string = BASE_CURRENCY,
  quoteToUsdRate?: number | null
): string {
  if (amount === null || amount === undefined) return 'N/A';
  
  if (currency === baseCurrency) {
    return formatCurrency(amount, currency);
  }
  
  const converted =
    baseCurrency === BASE_CURRENCY
      ? convertQuoteAmountToUsd(amount, currency, quoteToUsdRate)
      : convertCurrencySync(amount, currency, baseCurrency);
  return `${formatCurrency(amount, currency)} (${formatCurrency(converted, baseCurrency)})`;
}

/**
 * Format amount in triple currency (original + base + local) - sync version.
 * Shows original currency prominently with base and local in muted text.
 */
export function formatTripleCurrencySync(
  amount: number | null,
  originalCurrency: string,
  baseCurrency: string = BASE_CURRENCY,
  localCurrency?: string | null,
  quoteToUsdRate?: number | null
): string {
  if (amount === null || amount === undefined) return 'N/A';
  
  const orig = formatCurrency(amount, originalCurrency);
  
  // Convert to base (USD)
  const baseResult = convertQuoteAmountToCurrency(amount, originalCurrency, baseCurrency, quoteToUsdRate);
  const base = formatCurrency(baseResult.amount, baseCurrency);
  
  // If no local currency or same as original/base, just show dual
  if (!localCurrency || localCurrency === originalCurrency || localCurrency === baseCurrency) {
    return `${orig} / ${base}`;
  }
  
  // Convert to local currency
  const localResult = convertQuoteAmountToCurrency(amount, originalCurrency, localCurrency, quoteToUsdRate);
  const local = formatCurrency(localResult.amount, localCurrency);
  
  return `${orig} / ${base} / ${local}`;
}
