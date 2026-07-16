"use client";

import type { L1BudgetStatusRollup, BudgetStatusTotals } from "@/lib/purchase-budget-l1-rollup";
import { BudgetUtilizationPie } from "@/components/purchase/BudgetUtilizationPie";

interface BudgetL1UtilizationChartsProps {
  overviewTotals: BudgetStatusTotals;
  l1Groups: L1BudgetStatusRollup[];
  currency: string;
  formatCurrency: (amount: number, currency?: string) => string;
  loading?: boolean;
}

export function BudgetL1UtilizationCharts({
  overviewTotals,
  l1Groups,
  currency,
  formatCurrency,
  loading = false,
}: BudgetL1UtilizationChartsProps) {
  return (
    <div className="flex flex-col gap-4">
      <BudgetUtilizationPie
        title="All L1 categories — allocated, consumed, remaining"
        totals={overviewTotals}
        currency={currency}
        formatCurrency={formatCurrency}
        loading={loading}
      />
      {l1Groups.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">By L1 category</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {l1Groups.map((group) => (
              <BudgetUtilizationPie
                key={`${group.code}-${group.name}`}
                title={group.label}
                totals={{
                  allocated: group.allocated,
                  consumed: group.consumed,
                  remaining: group.remaining,
                }}
                currency={currency}
                formatCurrency={formatCurrency}
                loading={loading}
                compact
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No L1 budget lines for the selected period.
        </p>
      )}
    </div>
  );
}
