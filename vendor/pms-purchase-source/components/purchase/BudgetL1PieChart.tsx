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
import { CHART_PALETTE } from "@/lib/chart-theme";
import type { L1BudgetRollupSlice } from "@/lib/purchase-budget-l1-rollup";
import { cn } from "@/lib/utils";

interface BudgetL1PieChartProps {
  slices: L1BudgetRollupSlice[];
  total: number;
  currency: string;
  formatCurrency: (amount: number, currency?: string) => string;
  loading?: boolean;
  title?: string;
}

export function BudgetL1PieChart({
  slices,
  total,
  currency,
  formatCurrency,
  loading = false,
  title = "Budget by L1 category",
}: BudgetL1PieChartProps) {
  const chartData =
    slices.length > 0
      ? slices.map((s) => ({ name: s.label, value: s.value, code: s.code }))
      : [{ name: "No allotted budget", value: 1, code: "none" }];

  const hasData = slices.length > 0 && total > 0;

  return (
    <div
      className={cn(
        "flex h-full min-h-[320px] flex-col rounded-lg border bg-card",
        loading && "opacity-60"
      )}
    >
      <div className="shrink-0 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <PieChartIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Total allotted:{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {formatCurrency(total, currency)}
          </span>
        </p>
      </div>
      <div className="relative min-h-0 flex-1 p-3">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="78%"
              dataKey="value"
              nameKey="name"
              paddingAngle={hasData ? 2 : 0}
            >
              {chartData.map((_, i) => (
                <Cell
                  key={i}
                  fill={
                    hasData
                      ? CHART_PALETTE[i % CHART_PALETTE.length]
                      : "hsl(var(--muted))"
                  }
                  stroke="hsl(var(--background))"
                  strokeWidth={1}
                />
              ))}
            </Pie>
            <RechartsTooltip
              formatter={(value: number, _name, item) => {
                const payload = item?.payload as { name?: string; code?: string };
                const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
                return [
                  `${formatCurrency(value, currency)} (${pct}%)`,
                  payload?.name ?? "L1 category",
                ];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              iconSize={8}
              formatter={(value) => (
                <span className="text-foreground">{String(value)}</span>
              )}
            />
            {hasData ? (
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-foreground text-[11px] font-semibold"
              >
                <tspan x="50%" dy="-0.4em" className="text-[10px] font-normal fill-muted-foreground">
                  Total
                </tspan>
                <tspan x="50%" dy="1.4em" className="text-xs">
                  {formatCurrency(total, currency)}
                </tspan>
              </text>
            ) : null}
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
