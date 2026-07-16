import { BASE_CURRENCY, roundAmount } from "@/lib/utils/currency-shared";

export interface InvoiceUsdConversion {
  originalAmount: number;
  originalCurrency: string;
  usdAmount: number;
  fxRateToUsd: number;
  fxRateSource: import("@/lib/utils/currency-shared").RateSource;
}

/** Display amounts for approval UI (handles legacy rows without original_invoice_amount). */
export function resolveInvoiceDisplayAmounts(invoice: {
  invoiceAmount: number | string;
  currency: string;
  originalInvoiceAmount?: number | string | null;
  fxRateToUsd?: number | string | null;
  fxRateSource?: string | null;
}): {
  originalAmount: number;
  originalCurrency: string;
  usdAmount: number;
  fxRateToUsd: number | null;
  fxRateSource: string | null;
} {
  const usdAmount = Number(invoice.invoiceAmount) || 0;
  const originalCurrency = (invoice.currency || BASE_CURRENCY).toUpperCase();
  const storedOriginal =
    invoice.originalInvoiceAmount != null
      ? Number(invoice.originalInvoiceAmount)
      : null;

  if (storedOriginal != null && !Number.isNaN(storedOriginal)) {
    return {
      originalAmount: storedOriginal,
      originalCurrency,
      usdAmount,
      fxRateToUsd:
        invoice.fxRateToUsd != null ? Number(invoice.fxRateToUsd) : null,
      fxRateSource: invoice.fxRateSource ?? null,
    };
  }

  if (originalCurrency === BASE_CURRENCY) {
    return {
      originalAmount: usdAmount,
      originalCurrency,
      usdAmount,
      fxRateToUsd: 1,
      fxRateSource: null,
    };
  }

  return {
    originalAmount: usdAmount,
    originalCurrency,
    usdAmount,
    fxRateToUsd: null,
    fxRateSource: null,
  };
}
