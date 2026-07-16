/**
 * Currency conversion utilities
 * Supports both database-stored exchange rates and fallback static rates
 */

import { 
  BASE_CURRENCY, 
  FALLBACK_EXCHANGE_RATES, 
  roundAmount, 
  formatCurrency,
  convertCurrencySync,
  getExchangeRateSync,
  type RateSource,
  type ConversionResult,
} from './currency-shared';

export * from './currency-shared';

/**
 * Historical FX from Frankfurter (ECB-based). `rates[c]` = units of c per 1 USD.
 * Returns multiplier: amount in `from` × rate = amount in `to`.
 */
async function getFrankfurterHistoricalRate(
  fromCurrency: string,
  toCurrency: string,
  asOfDate: Date
): Promise<number | null> {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  if (from === to) return 1;

  let d = new Date(asOfDate);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  if (d > end) d = end;

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const url = `https://api.frankfurter.app/${y}-${m}-${day}?from=USD`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { rates?: Record<string, number> };
    const rates = data.rates;
    if (!rates || typeof rates !== 'object') return null;

    const usdPerUnit = (code: string): number | null => {
      if (code === 'USD') return 1;
      const r = rates[code];
      if (r == null || r === 0) return null;
      return 1 / r;
    };

    if (to === 'USD') {
      return usdPerUnit(from);
    }
    if (from === 'USD') {
      const r = rates[to];
      if (r == null || r === 0) return null;
      return r;
    }
    const a = usdPerUnit(from);
    const b = usdPerUnit(to);
    if (a == null || b == null || b === 0) return null;
    return a / b;
  } catch {
    return null;
  }
}

/**
 * Get exchange rate. When conversion mode is MONTHLY_CONFIRMED and asOfDate falls in a confirmed month,
 * uses that month's rates; otherwise uses company DB rate, then market API, then fallback.
 * @param asOfDate - Optional date for rate lookup (company DB + market historical use this; default is today)
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string = BASE_CURRENCY,
  asOfDate?: Date
): Promise<number> {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  if (from === to) return 1.0;

  const date = asOfDate ? new Date(asOfDate) : new Date();

  try {
    const { prisma } = await import('@/lib/prisma');

    // Step 0: If mode is MONTHLY_CONFIRMED, use that month's confirmed rates
    if (typeof window === 'undefined') {
      const modeRow = await prisma.currencyConversionMode.findFirst({
        orderBy: { updatedAt: 'desc' },
      });
      if (modeRow?.mode === 'MONTHLY_CONFIRMED') {
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // 1-12
        const confirmation = await prisma.monthlyConversionConfirmation.findUnique({
          where: { year_month: { year, month } },
          include: { rates: true },
        });
        if (confirmation?.rates?.length) {
          const rateMap = new Map<string, number>();
          for (const r of confirmation.rates) {
            rateMap.set(`${r.fromCurrency}:${r.toCurrency}`, Number(r.rate));
          }
          const direct = rateMap.get(`${from}:${to}`);
          if (direct != null) return direct;
          const viaUsdFrom = rateMap.get(`${from}:USD`);
          const viaUsdTo = rateMap.get(`USD:${to}`);
          if (viaUsdFrom != null && viaUsdTo != null) return viaUsdFrom * viaUsdTo;
          const toUsdFrom = rateMap.get(`USD:${from}`);
          const fromUsdTo = rateMap.get(`${to}:USD`);
          if (toUsdFrom != null && fromUsdTo != null) return (1 / toUsdFrom) * (1 / fromUsdTo);
        }
      }
    }

    // Step 1: Company rates from database (Accounts / currency-rates) — effective on `date`
    const exchangeRate = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: from,
        toCurrency: to,
        effectiveDate: { lte: date },
        OR: [
          { expiryDate: null },
          { expiryDate: { gte: date } },
        ],
        isActive: true,
      },
      orderBy: { effectiveDate: 'desc' },
    });

    if (exchangeRate) {
      return Number(exchangeRate.rate);
    }

    // Step 2: Market rate as of `date` (Frankfurter; no auth required)
    if (typeof window === 'undefined') {
      const frank = await getFrankfurterHistoricalRate(from, to, date);
      if (frank != null) return frank;
    }

    // Step 3: App market endpoint (may require auth when called server-to-server)
    if (typeof window === 'undefined') {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'http://localhost:3000';
        const marketResponse = await fetch(`${baseUrl}/api/exchange-rates/market`, {
          next: { revalidate: 3600 },
        });

        if (marketResponse.ok) {
          const marketData = await marketResponse.json();
          if (marketData.rates?.[from]?.[to]) {
            return marketData.rates[from][to];
          }
          if (marketData.rates?.[from]?.['USD'] && marketData.rates?.['USD']?.[to]) {
            return marketData.rates[from]['USD'] * marketData.rates['USD'][to];
          }
        }
      } catch (apiError) {
        console.warn('Failed to fetch market rate from API, using fallback:', apiError);
      }
    }
  } catch (error) {
    // Fallback to static rates if database query fails
    console.warn('Failed to fetch exchange rate from database, using fallback:', error);
  }
  
  // Step 4: Fallback to static rates
  return getExchangeRateSync(from, to);
}

/**
 * Convert amount from one currency to another (async - uses database rates)
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string = BASE_CURRENCY,
  asOfDate?: Date
): Promise<number> {
  if (fromCurrency.trim().toUpperCase() === toCurrency.trim().toUpperCase()) return amount;
  const rate = await getExchangeRate(fromCurrency, toCurrency, asOfDate);
  return roundAmount(amount * rate);
}

/**
 * Format amount in dual currency (original and converted) - async version
 */
export async function formatDualCurrency(
  amount: number | null,
  currency: string,
  baseCurrency: string = BASE_CURRENCY
): Promise<string> {
  if (amount === null || amount === undefined) return 'N/A';
  
  if (currency === baseCurrency) {
    return formatCurrency(amount, currency);
  }
  
  const converted = await convertCurrency(amount, currency, baseCurrency);
  return `${formatCurrency(amount, currency)} (${formatCurrency(converted, baseCurrency)})`;
}

/**
 * Convert amount with full pipeline + source tracking.
 * Returns both the converted amount and where the rate came from.
 *
 * Priority: frozen rate → monthly confirmed → company DB → market API → fallback
 */
export async function convertWithSource(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  options?: {
    /** Frozen per-quote rate (set at quote receipt time) */
    frozenRate?: number | null;
    /** Date for rate lookup (defaults to today) */
    asOfDate?: Date;
    /** Vessel ID for local currency resolution */
    vesselId?: string;
  }
): Promise<ConversionResult> {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  
  if (from === to) {
    return { amount: roundAmount(amount), rate: 1.0, source: 'frozen', fromCurrency: from, toCurrency: to };
  }

  // Step 0: If frozen rate is provided and target is USD, use it
  if (to === BASE_CURRENCY && options?.frozenRate != null && !Number.isNaN(Number(options.frozenRate))) {
    return {
      amount: roundAmount(amount * Number(options.frozenRate)),
      rate: Number(options.frozenRate),
      source: 'frozen',
      fromCurrency: from,
      toCurrency: to,
    };
  }

  // Step 0b: If frozen rate provided and source is USD, invert it
  if (from === BASE_CURRENCY && options?.frozenRate != null && !Number.isNaN(Number(options.frozenRate)) && Number(options.frozenRate) > 0) {
    const inverted = 1 / Number(options.frozenRate);
    return {
      amount: roundAmount(amount * inverted),
      rate: inverted,
      source: 'frozen',
      fromCurrency: from,
      toCurrency: to,
    };
  }

  const date = options?.asOfDate ?? new Date();

  try {
    const { prisma } = await import('@/lib/prisma');

    // Step 1: Monthly confirmed rates
    if (typeof window === 'undefined') {
      const modeRow = await prisma.currencyConversionMode.findFirst({
        orderBy: { updatedAt: 'desc' },
      });
      if (modeRow?.mode === 'MONTHLY_CONFIRMED') {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const confirmation = await prisma.monthlyConversionConfirmation.findUnique({
          where: { year_month: { year, month } },
          include: { rates: true },
        });
        if (confirmation?.rates?.length) {
          const rateMap = new Map<string, number>();
          for (const r of confirmation.rates) {
            rateMap.set(`${r.fromCurrency}:${r.toCurrency}`, Number(r.rate));
          }
          const direct = rateMap.get(`${from}:${to}`);
          if (direct != null) {
            return { amount: roundAmount(amount * direct), rate: direct, source: 'monthly', fromCurrency: from, toCurrency: to };
          }
          const viaUsdFrom = rateMap.get(`${from}:USD`);
          const viaUsdTo = rateMap.get(`USD:${to}`);
          if (viaUsdFrom != null && viaUsdTo != null) {
            const r = viaUsdFrom * viaUsdTo;
            return { amount: roundAmount(amount * r), rate: r, source: 'monthly', fromCurrency: from, toCurrency: to };
          }
        }
      }
    }

    // Step 2: Company DB rates
    if (typeof window === 'undefined') {
      const exchangeRate = await prisma.exchangeRate.findFirst({
        where: {
          fromCurrency: from,
          toCurrency: to,
          effectiveDate: { lte: date },
          OR: [{ expiryDate: null }, { expiryDate: { gte: date } }],
          isActive: true,
        },
        orderBy: { effectiveDate: 'desc' },
      });

      if (exchangeRate) {
        const r = Number(exchangeRate.rate);
        return { amount: roundAmount(amount * r), rate: r, source: 'company', fromCurrency: from, toCurrency: to };
      }
    }

    // Step 3: Market rate (Frankfurter ECB)
    if (typeof window === 'undefined') {
      const frank = await getFrankfurterHistoricalRate(from, to, date);
      if (frank != null) {
        return { amount: roundAmount(amount * frank), rate: frank, source: 'market', fromCurrency: from, toCurrency: to };
      }
    }
  } catch (error) {
    console.warn('Failed to fetch exchange rate from DB, using fallback:', error);
  }

  // Step 4: Fallback static rates
  const fallbackRate = getExchangeRateSync(from, to);
  return {
    amount: convertCurrencySync(amount, from, to),
    rate: fallbackRate,
    source: 'fallback',
    fromCurrency: from,
    toCurrency: to,
  };
}

/**
 * Get the effective base currency for a vessel.
 * Priority: vessel.localCurrency → company.baseCurrency → system BASE_CURRENCY
 */
export async function getVesselBaseCurrency(vesselId?: string): Promise<string> {
  if (!vesselId) return BASE_CURRENCY;
  // When vessel.localCurrency / company.baseCurrency are added to the schema, resolve here.
  return BASE_CURRENCY;
}

/**
 * Get the user's preferred display currency.
 */
export async function getUserDisplayCurrency(userId?: string): Promise<string> {
  if (!userId) return BASE_CURRENCY;

  try {
    const { prisma } = await import('@/lib/prisma');
    const pref = await prisma.userCurrencyPreference.findUnique({
      where: { userId },
    });
    if (pref?.displayCurrency) {
      return pref.displayCurrency.trim().toUpperCase();
    }
  } catch (error) {
    console.warn('Failed to fetch user currency preference, using default:', error);
  }

  return BASE_CURRENCY;
}
