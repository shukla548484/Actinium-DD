import type { BudgetMonthlyMonitorPayload } from "@/lib/purchase-budget-monthly-monitor";
import { roundBudgetAmount } from "@/lib/purchase-budget-amount-format";

export type CashFlowForecastCell = {
  committed: number;
  recurringAccrual: number;
  pmsForecast: number;
  totalForecast: number;
};

export type CashFlowForecastPayload = {
  columnTotals: Record<string, CashFlowForecastCell>;
  grandTotal: CashFlowForecastCell;
  pmsForecastTotal: number;
  recurringAccrualTotal: number;
};

export function buildCashFlowForecast(params: {
  monthlyBreakdown: BudgetMonthlyMonitorPayload | null;
  accrualByMonth: Map<string, number>;
  recurringByMonth: Map<string, number>;
  pmsByMonth: Map<string, number>;
}): CashFlowForecastPayload | null {
  const { monthlyBreakdown, accrualByMonth, recurringByMonth, pmsByMonth } = params;
  if (!monthlyBreakdown) return null;

  const columnTotals: Record<string, CashFlowForecastCell> = {};
  let gCommitted = 0;
  let gRecurring = 0;
  let gPms = 0;
  let gTotal = 0;

  for (const col of monthlyBreakdown.columns) {
    const committed = monthlyBreakdown.columnTotals[col.key]?.committed ?? 0;
    const recurringAccrual = recurringByMonth.get(col.key) ?? accrualByMonth.get(col.key) ?? 0;
    const pmsForecast = pmsByMonth.get(col.key) ?? 0;
    const totalForecast = roundBudgetAmount(committed + recurringAccrual + pmsForecast);
    columnTotals[col.key] = {
      committed: roundBudgetAmount(committed),
      recurringAccrual: roundBudgetAmount(recurringAccrual),
      pmsForecast: roundBudgetAmount(pmsForecast),
      totalForecast,
    };
    gCommitted += committed;
    gRecurring += recurringAccrual;
    gPms += pmsForecast;
    gTotal += totalForecast;
  }

  return {
    columnTotals,
    grandTotal: {
      committed: roundBudgetAmount(gCommitted),
      recurringAccrual: roundBudgetAmount(gRecurring),
      pmsForecast: roundBudgetAmount(gPms),
      totalForecast: roundBudgetAmount(gTotal),
    },
    pmsForecastTotal: roundBudgetAmount(gPms),
    recurringAccrualTotal: roundBudgetAmount(gRecurring),
  };
}
