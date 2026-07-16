"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CashFlowForecastPayload } from "@/lib/purchase-budget-cash-flow-forecast";
import type { BudgetMonthlyMonitorPayload } from "@/lib/purchase-budget-monthly-monitor";

type BudgetCashFlowForecastChartProps = {
  monthly: BudgetMonthlyMonitorPayload;
  cashFlow: CashFlowForecastPayload;
  formatCurrency: (amount: number, currency?: string) => string;
  loading?: boolean;
};

export function BudgetCashFlowForecastChart({
  monthly,
  cashFlow,
  formatCurrency,
  loading = false,
}: BudgetCashFlowForecastChartProps) {
  const chartData = monthly.columns.map((col) => {
    const cf = cashFlow.columnTotals[col.key];
    return {
      month: col.label,
      committed: cf?.committed ?? 0,
      recurring: cf?.recurringAccrual ?? 0,
      pms: cf?.pmsForecast ?? 0,
      totalForecast: cf?.totalForecast ?? 0,
      actual: monthly.columnTotals[col.key]?.actual ?? 0,
    };
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Loading cash-flow forecast…
        </CardContent>
      </Card>
    );
  }

  if (chartData.every((d) => d.totalForecast === 0 && d.actual === 0)) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cash-flow forecast</CardTitle>
        <CardDescription>
          Committed pipeline + recurring accruals + PMS forecast vs actual · {monthly.currency}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  formatCurrency(Number(v), monthly.currency).replace(/\.\d{2}$/, "")
                }
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    committed: "Committed",
                    recurring: "Recurring accrual",
                    pms: "PMS forecast",
                    totalForecast: "Total forecast",
                    actual: "Actual",
                  };
                  return [formatCurrency(value, monthly.currency), labels[name] ?? name];
                }}
              />
              <Legend />
              <Bar dataKey="committed" stackId="forecast" fill="hsl(var(--chart-2))" name="Committed" />
              <Bar
                dataKey="recurring"
                stackId="forecast"
                fill="hsl(var(--chart-3))"
                name="Recurring"
              />
              <Bar dataKey="pms" stackId="forecast" fill="hsl(var(--chart-4))" name="PMS" />
              <Line
                type="monotone"
                dataKey="totalForecast"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                name="Total forecast"
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                name="Actual"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
