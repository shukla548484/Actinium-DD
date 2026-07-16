"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, DollarSign, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import type { BudgetMonitorStats } from "@/lib/purchase-budget-monitor-vs-actual";
import type { BudgetMonitorYtdMetrics } from "@/lib/purchase-budget-monitor-ytd";

type BudgetExposureKpiStripProps = {
  stats: BudgetMonitorStats;
  ytdMetrics?: BudgetMonitorYtdMetrics | null;
  accrualActual?: number;
  pmsForecastTotal?: number;
  formatCurrency: (amount: number, currency?: string) => string;
};

export function BudgetExposureKpiStrip({
  stats,
  ytdMetrics,
  accrualActual = 0,
  pmsForecastTotal = 0,
  formatCurrency,
}: BudgetExposureKpiStripProps) {
  const currency = stats.currency;

  return (
    <div className="space-y-3">
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium">Allocated</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold tabular-nums">
            {formatCurrency(stats.allocatedBudget, currency)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium">Committed</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold tabular-nums">
            {formatCurrency(stats.committedBudget, currency)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium">Actual</CardTitle>
          <TrendingDown className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold tabular-nums text-destructive">
            {formatCurrency(stats.spentBudget, currency)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium">Exposure</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold tabular-nums">
            {formatCurrency(stats.exposureBudget, currency)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.utilizationPercentage.toFixed(1)}% utilized
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium">Remaining</CardTitle>
          <TrendingUp className="h-4 w-4 text-success" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold tabular-nums text-success">
            {formatCurrency(stats.remainingBudget, currency)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium">Variance</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div
            className={`text-lg font-bold tabular-nums ${
              stats.remainingBudget < 0 ? "text-destructive" : "text-foreground"
            }`}
          >
            {formatCurrency(stats.remainingBudget, currency)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Budget − exposure</p>
        </CardContent>
      </Card>
    </div>

    {ytdMetrics ? (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">YTD Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold tabular-nums">
              {formatCurrency(ytdMetrics.ytdBudget, currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {ytdMetrics.elapsedMonths} of {ytdMetrics.totalMonths} months
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">YTD Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold tabular-nums text-destructive">
              {formatCurrency(ytdMetrics.ytdActual, currency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">YTD Variance</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-lg font-bold tabular-nums ${
                ytdMetrics.ytdVariance < 0 ? "text-destructive" : "text-success"
              }`}
            >
              {formatCurrency(ytdMetrics.ytdVariance, currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {ytdMetrics.ytdVariancePct.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Forecast YE</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold tabular-nums">
              {formatCurrency(ytdMetrics.forecastYearEnd, currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Run-rate projection</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Proj. variance</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-lg font-bold tabular-nums ${
                ytdMetrics.projectedVariance < 0 ? "text-destructive" : "text-success"
              }`}
            >
              {formatCurrency(ytdMetrics.projectedVariance, currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Budget − forecast</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Budget / day</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold tabular-nums">
              {formatCurrency(ytdMetrics.budgetPerDay, currency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Actual / day</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold tabular-nums text-destructive">
              {formatCurrency(ytdMetrics.actualPerDay, currency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Operating days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold tabular-nums">{ytdMetrics.operatingDays}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {ytdMetrics.operatingDaysSource === "noon_reports"
                ? "From noon reports"
                : "Calendar days"}
            </p>
          </CardContent>
        </Card>
      </div>
    ) : null}

    {(accrualActual > 0 || pmsForecastTotal > 0) && (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {accrualActual > 0 ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium">Accrual OPEX</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold tabular-nums">
                {formatCurrency(accrualActual, currency)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Non-procurement actuals</p>
            </CardContent>
          </Card>
        ) : null}
        {pmsForecastTotal > 0 ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium">PMS forecast</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold tabular-nums">
                {formatCurrency(pmsForecastTotal, currency)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Jobs, defects, spare pipeline</p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    )}
    </div>
  );
}
