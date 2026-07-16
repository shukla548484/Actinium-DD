"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import type { BudgetStatusTotals } from "@/lib/purchase-budget-l1-rollup";
import { cn } from "@/lib/utils";

const SEGMENT_COLORS = {
  allocated: "hsl(217 91% 60%)",
  consumed: "hsl(25 95% 53%)",
  remaining: "hsl(142 71% 45%)",
} as const;

interface BudgetUtilizationPieProps {
  totals: BudgetStatusTotals;
  formatCurrency: (amount: number, currency?: string) => string;
  currency: string;
  title: string;
  loading?: boolean;
  compact?: boolean;
}

export function BudgetUtilizationPie({
  totals,
  formatCurrency,
  currency,
  title,
  loading = false,
  compact = false,
}: BudgetUtilizationPieProps) {
  const chartData = [
    { name: "Allocated", value: totals.allocated, key: "allocated" },
    { name: "Consumed", value: totals.consumed, key: "consumed" },
    { name: "Remaining", value: totals.remaining, key: "remaining" },
  ].filter((d) => d.value > 0);

  const hasData = chartData.length > 0;
  const displayData = hasData
    ? chartData
    : [{ name: "No budget data", value: 1, key: "empty" }];

  const height = compact ? 160 : 280;

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border bg-card",
        compact ? "min-h-[200px]" : "min-h-[320px]",
        loading && "opacity-60"
      )}
    >
      <div className="shrink-0 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <PieChartIcon className="h-4 w-4 text-muted-foreground" />
          <span className={cn("font-semibold", compact ? "text-xs" : "text-sm")}>{title}</span>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 p-2">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={displayData}
              cx="50%"
              cy="50%"
              innerRadius={compact ? "48%" : "52%"}
              outerRadius={compact ? "70%" : "78%"}
              dataKey="value"
              nameKey="name"
              paddingAngle={hasData && displayData.length > 1 ? 2 : 0}
            >
              {displayData.map((d) => (
                <Cell
                  key={d.key}
                  fill={
                    hasData
                      ? SEGMENT_COLORS[d.key as keyof typeof SEGMENT_COLORS] ??
                        "hsl(var(--muted))"
                      : "hsl(var(--muted))"
                  }
                  stroke="hsl(var(--background))"
                  strokeWidth={1}
                />
              ))}
            </Pie>
            <RechartsTooltip
              formatter={(value: number, _name, item) => {
                const total = totals.allocated + totals.consumed + totals.remaining;
                const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
                return [`${formatCurrency(value, currency)} (${pct}%)`, item?.name ?? ""];
              }}
            />
            <Legend wrapperStyle={{ fontSize: compact ? 10 : 11 }} iconSize={8} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
