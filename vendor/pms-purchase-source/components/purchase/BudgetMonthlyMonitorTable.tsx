"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BudgetMonthlyMonitorPayload } from "@/lib/purchase-budget-monthly-monitor";
import type { BudgetDrilldownTarget } from "@/components/purchase/BudgetVsActualSummaryTable";

type BudgetMonthlyMonitorTableProps = {
  data: BudgetMonthlyMonitorPayload;
  formatCurrency: (amount: number, currency?: string) => string;
  title?: string;
  onMonthDrilldown?: (target: BudgetDrilldownTarget, monthKey: string) => void;
};

function CellTriplet({
  budget,
  actual,
  committed,
  variance,
  formatCurrency,
  currency,
}: {
  budget: number;
  actual: number;
  committed: number;
  variance: number;
  formatCurrency: (amount: number, currency?: string) => string;
  currency: string;
}) {
  return (
    <div className="space-y-0.5 text-right text-xs tabular-nums leading-tight">
      <div>
        <span className="text-muted-foreground">B </span>
        {formatCurrency(budget, currency)}
      </div>
      <div>
        <span className="text-muted-foreground">A </span>
        <span className="text-destructive">{formatCurrency(actual, currency)}</span>
      </div>
      <div>
        <span className="text-muted-foreground">C </span>
        {formatCurrency(committed, currency)}
      </div>
      <div>
        <span className="text-muted-foreground">V </span>
        <span className={variance < 0 ? "text-destructive" : "text-success"}>
          {formatCurrency(variance, currency)}
        </span>
      </div>
    </div>
  );
}

export function BudgetMonthlyMonitorTable({
  data,
  formatCurrency,
  title = "Operating Expenses Breakdown",
  onMonthDrilldown,
}: BudgetMonthlyMonitorTableProps) {
  const { columns, rows, columnTotals, grandTotal, currency } = data;

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-card py-12 text-center text-muted-foreground">
        No monthly budget vs actual data for the selected filters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="flex items-start justify-between border-b px-4 py-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">
            B = Budget, A = Actual, C = Committed, V = Variance · {currency}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary hover:bg-primary">
              <TableHead className="min-w-[220px] sticky left-0 z-10 bg-primary text-primary-foreground">
                Expense category
              </TableHead>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className="min-w-[108px] text-center text-primary-foreground whitespace-nowrap"
                >
                  {col.label}
                </TableHead>
              ))}
              <TableHead className="min-w-[120px] text-center text-primary-foreground">
                Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.l1Id}>
                <TableCell className="sticky left-0 z-10 bg-card font-medium">
                  {row.label}
                </TableCell>
                {columns.map((col) => {
                  const cell = row.months[col.key];
                  return (
                    <TableCell
                      key={col.key}
                      className={onMonthDrilldown ? "cursor-pointer hover:bg-muted/30" : undefined}
                      onClick={() =>
                        onMonthDrilldown?.(
                          { l1Id: row.l1Id, l1Label: row.label, kind: "actual" },
                          col.key
                        )
                      }
                    >
                      <CellTriplet
                        budget={cell?.budget ?? 0}
                        actual={cell?.actual ?? 0}
                        committed={cell?.committed ?? 0}
                        variance={cell?.variance ?? 0}
                        formatCurrency={formatCurrency}
                        currency={currency}
                      />
                    </TableCell>
                  );
                })}
                <TableCell>
                  <CellTriplet
                    budget={row.totals.budget}
                    actual={row.totals.actual}
                    committed={row.totals.committed}
                    variance={row.totals.variance}
                    formatCurrency={formatCurrency}
                    currency={currency}
                  />
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/40 font-semibold">
              <TableCell className="sticky left-0 z-10 bg-muted/40">Total</TableCell>
              {columns.map((col) => {
                const cell = columnTotals[col.key];
                return (
                  <TableCell key={col.key}>
                    <CellTriplet
                      budget={cell?.budget ?? 0}
                      actual={cell?.actual ?? 0}
                      committed={cell?.committed ?? 0}
                      variance={cell?.variance ?? 0}
                      formatCurrency={formatCurrency}
                      currency={currency}
                    />
                  </TableCell>
                );
              })}
              <TableCell>
                <CellTriplet
                  budget={grandTotal.budget}
                  actual={grandTotal.actual}
                  committed={grandTotal.committed}
                  variance={grandTotal.variance}
                  formatCurrency={formatCurrency}
                  currency={currency}
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
