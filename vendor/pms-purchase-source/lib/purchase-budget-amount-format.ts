/** Standard decimal precision for purchase budget amounts across UI and inputs. */
export const BUDGET_AMOUNT_DECIMAL_PLACES = 2;

export function roundBudgetAmount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** BUDGET_AMOUNT_DECIMAL_PLACES;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Fixed-width string for editable budget amount fields (exactly 2 decimal places). */
export function formatBudgetAmountForInput(value: number): string {
  return roundBudgetAmount(value).toFixed(BUDGET_AMOUNT_DECIMAL_PLACES);
}

export function formatBudgetAmount(
  amount: number,
  options?: { currency?: string; locale?: string }
): string {
  const rounded = roundBudgetAmount(amount);
  const locale = options?.locale ?? "en-US";
  const digits = BUDGET_AMOUNT_DECIMAL_PLACES;

  if (options?.currency) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: options.currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(rounded);
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(rounded);
}

export function formatBudgetCurrency(amount: number, currency: string = "USD"): string {
  return formatBudgetAmount(amount, { currency });
}
