"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { CHART_PALETTE } from "@/lib/chart-theme";
import type { L1WithL2BudgetRollup } from "@/lib/purchase-budget-l1-rollup";
import { cn } from "@/lib/utils";

interface BudgetL2PieChartsByL1Props {
  groups: L1WithL2BudgetRollup[];
  formatCurrency: (amount: number, currency?: string) => string;
  currency: string;
  loading?: boolean;
}

function MiniL2Pie({
  group,
  formatCurrency,
  currency,
}: {
  group: L1WithL2BudgetRollup;
  formatCurrency: (amount: number, currency?: string) => string;
  currency: string;
}) {
  const chartData = group.l2Slices.map((s) => ({
    name: s.label,
    value: s.value,
    code: s.code,
  }));
  const total = group.total;
  const hasData = total > 0;

  return (
    <div className="flex flex-col rounded-md border bg-card/80 p-2">
      <p className="truncate text-xs font-medium text-foreground" title={group.label}>
        {group.label}
      </p>
      <p className="mb-1 text-[10px] tabular-nums text-muted-foreground">
        {formatCurrency(total, currency)}
      </p>
      <div className="h-[140px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="45%"
              outerRadius="72%"
              dataKey="value"
              nameKey="name"
              paddingAngle={hasData && chartData.length > 1 ? 1 : 0}
            >
              {chartData.map((_, i) => (
                <Cell
                  key={i}
                  fill={CHART_PALETTE[i % CHART_PALETTE.length]}
                  stroke="hsl(var(--background))"
                  strokeWidth={1}
                />
              ))}
            </Pie>
            <RechartsTooltip
              formatter={(value: number, _name, item) => {
                const payload = item?.payload as { name?: string };
                const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
                return [
                  `${formatCurrency(value, currency)} (${pct}%)`,
                  payload?.name ?? "L2 line",
                ];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function BudgetL2PieChartsByL1({
  groups,
  formatCurrency,
  currency,
  loading = false,
}: BudgetL2PieChartsByL1Props) {
  if (groups.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        No L2 breakdown available for the selected period filter.
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", loading && "opacity-60")}>
      <p className="text-xs font-medium text-muted-foreground">L2 breakdown by L1 group</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {groups.map((group) => (
          <MiniL2Pie
            key={`${group.code}-${group.name}`}
            group={group}
            formatCurrency={formatCurrency}
            currency={currency}
          />
        ))}
      </div>
    </div>
  );
}
