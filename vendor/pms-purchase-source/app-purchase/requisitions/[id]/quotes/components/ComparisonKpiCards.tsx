"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Trophy, TrendingDown, Star, Package } from "lucide-react";
import type { ComparisonKpiData } from "@/lib/procurement/quote-comparison-metrics";

type Props = {
  kpis: ComparisonKpiData;
  formatAmount: (amount: number, currency: string) => string;
  className?: string;
};

export function ComparisonKpiCards({ kpis, formatAmount, className }: Props) {
  // Default Card adds py-6 (24px) on inner shell — override shell + content for compact KPI strip
  const cardShellClass =
    "min-w-[9.5rem] flex-1 border-border bg-card shadow-sm [&>div.relative]:!gap-0 [&>div.relative]:!py-1";
  const cardContentClass = "px-3 py-1";

  return (
    <div className={`flex min-w-0 flex-1 flex-nowrap items-stretch gap-2 ${className ?? ""}`}>
      <Card variant="compact" className={cardShellClass}>
        <CardContent className={cardContentClass}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Lowest bid</p>
              <p className="mt-0.5 truncate text-base font-bold leading-tight text-foreground">{formatAmount(kpis.lowestBid, kpis.lowestCurrency)}</p>
              <p className="truncate text-[11px] text-muted-foreground">{kpis.lowestVendorName}</p>
            </div>
            <span className="rounded-md bg-warning/10 p-1.5 text-warning">
              <Trophy className="h-4 w-4 shrink-0" />
            </span>
          </div>
          {kpis.diffToSecond != null && kpis.secondVendorName && (
            <p className="mt-2 rounded bg-success/10 px-2 py-1 text-[11px] font-medium text-success">
              {formatAmount(kpis.diffToSecond, kpis.lowestCurrency)} below #{2} ({kpis.diffToSecondPct?.toFixed(1)}%)
            </p>
          )}
        </CardContent>
      </Card>

      <Card variant="compact" className={cardShellClass}>
        <CardContent className={cardContentClass}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Potential saving</p>
              <p className="mt-0.5 text-base font-bold leading-tight text-foreground">{kpis.savingPct != null ? `${kpis.savingPct}%` : "—"}</p>
              <p className="text-[11px] text-muted-foreground">vs highest bid</p>
            </div>
            <span className="rounded-md bg-success/10 p-1.5 text-success">
              <TrendingDown className="h-4 w-4 shrink-0" />
            </span>
          </div>
        </CardContent>
      </Card>

      <Card variant="compact" className={cardShellClass}>
        <CardContent className={cardContentClass}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Award candidate</p>
              <p className="mt-0.5 truncate text-base font-bold leading-tight text-foreground">{kpis.awardVendorName}</p>
              <p className="text-[11px] text-muted-foreground">Commercial {kpis.commercialScore}% · Complete {kpis.completenessScore}%</p>
            </div>
            <span className="rounded-md bg-primary/10 p-1.5 text-primary">
              <Star className="h-4 w-4 shrink-0" />
            </span>
          </div>
        </CardContent>
      </Card>

      <Card variant="compact" className={cardShellClass}>
        <CardContent className={cardContentClass}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Line coverage</p>
              <p className="mt-0.5 text-base font-bold leading-tight text-foreground">
                {kpis.itemStats.quoted}/{kpis.itemStats.total} quoted
              </p>
              <p className="text-[11px] text-muted-foreground">{kpis.itemStats.missing} missing avg</p>
            </div>
            <span className="rounded-md bg-muted p-1.5 text-muted-foreground">
              <Package className="h-4 w-4 shrink-0" />
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
