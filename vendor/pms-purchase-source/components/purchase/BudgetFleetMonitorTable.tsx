"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BudgetFleetMonitorPayload } from "@/lib/purchase-budget-monitor-fleet";
import { cn } from "@/lib/utils";

type BudgetFleetMonitorTableProps = {
  data: BudgetFleetMonitorPayload;
  formatCurrency: (amount: number, currency?: string) => string;
};

function statusBadge(status: "ON_TRACK" | "WARNING" | "EXCEEDED") {
  if (status === "EXCEEDED") return <Badge className="bg-destructive">Exceeded</Badge>;
  if (status === "WARNING") return <Badge className="bg-warning">Warning</Badge>;
  return <Badge className="bg-success">On track</Badge>;
}

export function BudgetFleetMonitorTable({ data, formatCurrency }: BudgetFleetMonitorTableProps) {
  const currency = data.displayCurrency;

  if (data.vessels.length === 0) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        No fleet budget data for the selected filters.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{data.fxNote}</p>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead>Vessel</TableHead>
              <TableHead className="text-right">Allocated</TableHead>
              <TableHead className="text-right">Committed</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Exposure</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead className="text-right">Util %</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-muted/30 font-semibold">
              <TableCell>Fleet total ({currency})</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(data.fleetTotals.allocated, currency)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(data.fleetTotals.committed, currency)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(data.fleetTotals.actual, currency)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(data.fleetTotals.exposure, currency)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(data.fleetTotals.remaining, currency)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {data.fleetTotals.utilizationPct.toFixed(1)}%
              </TableCell>
              <TableCell>{statusBadge(data.fleetTotals.status)}</TableCell>
            </TableRow>
            {data.vessels.map((row) => (
              <TableRow key={row.vesselId}>
                <TableCell>
                  <div className="space-y-0.5">
                    <Link
                      href={`/purchase/budget-control?tab=monitor&vesselId=${encodeURIComponent(row.vesselId)}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {row.vesselName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {row.vesselCode}
                      {row.nativeCurrency !== currency ? ` · native ${row.nativeCurrency}` : ""}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(row.allocated, currency)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(row.committed, currency)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-destructive">
                  {formatCurrency(row.actual, currency)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(row.exposure, currency)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    row.remaining < 0 ? "text-destructive" : "text-success"
                  )}
                >
                  {formatCurrency(row.remaining, currency)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.utilizationPct.toFixed(1)}%
                </TableCell>
                <TableCell>{statusBadge(row.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        {data.warningCount} vessel(s) in warning · {data.exceededCount} exceeded · Period:{" "}
        {data.periodLabel}
      </p>
    </div>
  );
}
