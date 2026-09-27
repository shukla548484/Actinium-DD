import { convertLocalToUsd } from "@/lib/fx/rates";
import { resolveFxForQuote } from "@/lib/db/projectCurrency";

export type BudgetLineAmountFields = {
  currency: string;
  exchangeRateLocalPerUsd: number;
  budgetAmount: number;
  quotedAmount: number | null;
  approvedAmount: number | null;
  actualAmount: number | null;
  budgetAmountUsd: number;
  quotedAmountUsd: number | null;
  approvedAmountUsd: number | null;
  actualAmountUsd: number | null;
};

function toUsd(local: number | null | undefined, localPerUsd: number): number | null {
  if (local == null) return null;
  return convertLocalToUsd(local, localPerUsd);
}

/**
 * Normalize currency + rate and compute USD mirrors for budget line amounts.
 * Rate convention matches shipyard/Purchase FX: local currency units per 1 USD.
 */
export async function resolveBudgetLineCurrencyAmounts(input: {
  dryDockProjectId: string;
  currency?: string | null;
  exchangeRateLocalPerUsd?: number | null;
  budgetAmount?: number | null;
  quotedAmount?: number | null;
  approvedAmount?: number | null;
  actualAmount?: number | null;
}): Promise<BudgetLineAmountFields> {
  const currency = (input.currency?.trim() || "USD").toUpperCase();
  const budgetAmount = input.budgetAmount ?? 0;
  const quotedAmount = input.quotedAmount ?? null;
  const approvedAmount = input.approvedAmount ?? null;
  const actualAmount = input.actualAmount ?? null;

  if (currency === "USD") {
    return {
      currency: "USD",
      exchangeRateLocalPerUsd: 1,
      budgetAmount,
      quotedAmount,
      approvedAmount,
      actualAmount,
      budgetAmountUsd: budgetAmount,
      quotedAmountUsd: quotedAmount,
      approvedAmountUsd: approvedAmount,
      actualAmountUsd: actualAmount,
    };
  }

  let localPerUsd =
    input.exchangeRateLocalPerUsd != null && input.exchangeRateLocalPerUsd > 0
      ? input.exchangeRateLocalPerUsd
      : null;

  if (localPerUsd == null) {
    const fx = await resolveFxForQuote({
      localCurrency: currency,
      dryDockProjectId: input.dryDockProjectId,
    });
    localPerUsd = fx.localPerUsd;
  }

  return {
    currency,
    exchangeRateLocalPerUsd: localPerUsd,
    budgetAmount,
    quotedAmount,
    approvedAmount,
    actualAmount,
    budgetAmountUsd: convertLocalToUsd(budgetAmount, localPerUsd),
    quotedAmountUsd: toUsd(quotedAmount, localPerUsd),
    approvedAmountUsd: toUsd(approvedAmount, localPerUsd),
    actualAmountUsd: toUsd(actualAmount, localPerUsd),
  };
}

/** Recompute USD mirrors when only some amounts change (same currency/rate). */
export function mirrorUsdFromLocal(input: {
  currency: string;
  exchangeRateLocalPerUsd: number | null | undefined;
  budgetAmount: number;
  quotedAmount: number | null;
  approvedAmount: number | null;
  actualAmount: number | null;
}): Pick<
  BudgetLineAmountFields,
  | "budgetAmountUsd"
  | "quotedAmountUsd"
  | "approvedAmountUsd"
  | "actualAmountUsd"
  | "exchangeRateLocalPerUsd"
> {
  const currency = (input.currency || "USD").toUpperCase();
  const rate =
    currency === "USD"
      ? 1
      : input.exchangeRateLocalPerUsd != null && input.exchangeRateLocalPerUsd > 0
        ? input.exchangeRateLocalPerUsd
        : 1;

  return {
    exchangeRateLocalPerUsd: rate,
    budgetAmountUsd: convertLocalToUsd(input.budgetAmount, rate),
    quotedAmountUsd: toUsd(input.quotedAmount, rate),
    approvedAmountUsd: toUsd(input.approvedAmount, rate),
    actualAmountUsd: toUsd(input.actualAmount, rate),
  };
}
