import {
  BASE_CURRENCY,
  roundAmount,
  type ConversionResult,
  type RateSource,
} from "@/lib/utils/currency-shared";
import type { InvoiceUsdConversion } from "@/lib/purchase-invoice-currency";

/**
 * Convert vendor invoice amount to USD using system rates (monthly confirmed → company → market → fallback).
 */
export async function convertInvoiceAmountToUsd(
  amount: number,
  currency: string,
  asOfDate: Date
): Promise<InvoiceUsdConversion> {
  const originalCurrency = currency.trim().toUpperCase();
  const originalAmount = roundAmount(amount);

  if (originalCurrency === BASE_CURRENCY) {
    return {
      originalAmount,
      originalCurrency,
      usdAmount: originalAmount,
      fxRateToUsd: 1,
      fxRateSource: "frozen",
    };
  }

  const { convertWithSource } = await import("@/lib/utils/currency");
  const result: ConversionResult = await convertWithSource(
    originalAmount,
    originalCurrency,
    BASE_CURRENCY,
    { asOfDate }
  );

  return {
    originalAmount,
    originalCurrency,
    usdAmount: result.amount,
    fxRateToUsd: result.rate,
    fxRateSource: result.source as RateSource,
  };
}
