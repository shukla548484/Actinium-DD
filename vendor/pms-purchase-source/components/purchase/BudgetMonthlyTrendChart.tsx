"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BudgetMonthlyMonitorPayload } from "@/lib/purchase-budget-monthly-monitor";

type BudgetMonthlyTrendChartProps = {
  data: BudgetMonthlyMonitorPayload;
  formatCurrency: (amount: number, currency?: string) => string;
  loading?: boolean;
};

export function BudgetMonthlyTrendChart({
  data,
  formatCurrency,
  loading = false,
}: BudgetMonthlyTrendChartProps) {
  const chartData = data.columns.map((col) => {
    const cell = data.columnTotals[col.key];
    return {
      month: col.label,
      budget: cell?.budget ?? 0,
      actual: cell?.actual ?? 0,
      committed: cell?.committed ?? 0,
      priorYearActual: data.priorYearColumnTotals?.[col.key] ?? 0,
    };
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Loading monthly trend…
        </CardContent>
      </Card>
    );
  }

  if (chartData.every((d) => d.budget === 0 && d.actual === 0 && d.committed === 0)) {
    return null;
  }

  const hasPriorYear = chartData.some((d) => d.priorYearActual > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Monthly budget vs actual trend</CardTitle>
        <CardDescription>
          Budget, actual, committed pipeline, and prior-year actual · {data.currency}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  formatCurrency(Number(v), data.currency).replace(/\.\d{2}$/, "")
                }
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    budget: "Budget",
                    actual: "Actual",
                    committed: "Committed",
                    priorYearActual: "Prior year actual",
                  };
                  return [formatCurrency(value, data.currency), labels[name] ?? name];
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="budget"
                name="Budget"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="actual"
                name="Actual"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="committed"
                name="Committed"
                stroke="hsl(var(--warning))"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 2 }}
              />
              {hasPriorYear ? (
                <Line
                  type="monotone"
                  dataKey="priorYearActual"
                  name="Prior year actual"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  dot={false}
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
