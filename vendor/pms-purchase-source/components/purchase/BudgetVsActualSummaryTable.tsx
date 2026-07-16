"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BudgetVsActualL1Row } from "@/lib/purchase-budget-monitor-vs-actual";
import { cn } from "@/lib/utils";

export type BudgetDrilldownTarget = {
  l1Id: string | null;
  l1Label: string;
  kind?: "actual" | "committed";
  unbudgetedOnly?: boolean;
  missingCodeOnly?: boolean;
};

type BudgetVsActualSummaryTableProps = {
  rows: BudgetVsActualL1Row[];
  currency: string;
  formatCurrency: (amount: number, currency?: string) => string;
  onDrilldown?: (target: BudgetDrilldownTarget) => void;
};

function statusBadge(status: BudgetVsActualL1Row["status"]) {
  if (status === "EXCEEDED") {
    return <Badge className="bg-destructive">Exceeded</Badge>;
  }
  if (status === "WARNING") {
    return <Badge className="bg-warning">Warning</Badge>;
  }
  return <Badge className="bg-success">On track</Badge>;
}

export function BudgetVsActualSummaryTable({
  rows,
  currency,
  formatCurrency,
  onDrilldown,
}: BudgetVsActualSummaryTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        No budget consumption data for the selected filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/60 hover:bg-muted/60">
            <TableHead className="min-w-[220px]">L1 category</TableHead>
            <TableHead className="text-right">Budget</TableHead>
            <TableHead className="text-right">Actual</TableHead>
            <TableHead className="text-right">Committed</TableHead>
            <TableHead className="text-right">Exposure</TableHead>
            <TableHead className="text-right">Variance</TableHead>
            <TableHead className="text-right">Var %</TableHead>
            <TableHead className="text-right">Remaining</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const drillTarget = (): BudgetDrilldownTarget => ({
              l1Id: row.l1Id,
              l1Label: row.label,
              kind: "actual",
              unbudgetedOnly: row.alertKind === "unbudgeted",
              missingCodeOnly: row.alertKind === "missing_code",
            });
            return (
            <TableRow
              key={`${row.code}-${row.name}`}
              className={cn(onDrilldown && "cursor-pointer hover:bg-muted/40")}
              onClick={() => onDrilldown?.(drillTarget())}
            >
              <TableCell className="font-medium">{row.label}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(row.budget, currency)}
              </TableCell>
              <TableCell
                className="text-right tabular-nums text-destructive"
                onClick={(e) => {
                  if (!onDrilldown) return;
                  e.stopPropagation();
                  onDrilldown({ ...drillTarget(), kind: "actual" });
                }}
              >
                {formatCurrency(row.actual, currency)}
              </TableCell>
              <TableCell
                className="text-right tabular-nums"
                onClick={(e) => {
                  if (!onDrilldown) return;
                  e.stopPropagation();
                  onDrilldown({ ...drillTarget(), kind: "committed" });
                }}
              >
                {formatCurrency(row.committed, currency)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(row.exposure, currency)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right tabular-nums font-medium",
                  row.variance < 0 ? "text-destructive" : "text-success"
                )}
              >
                {formatCurrency(row.variance, currency)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right tabular-nums",
                  row.variancePct < 0 ? "text-destructive" : "text-success"
                )}
              >
                {row.variancePct.toFixed(1)}%
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(row.remaining, currency)}
              </TableCell>
              <TableCell>{statusBadge(row.status)}</TableCell>
            </TableRow>
          );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
