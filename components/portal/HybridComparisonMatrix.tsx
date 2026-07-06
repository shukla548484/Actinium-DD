"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { categoryLabelFromList, formatCategoryLabel } from "@/lib/tender/categories";
import { TableCard } from "@/components/layout/TableCard";
import { fmtMoney } from "@/lib/tender/format";
import type { HybridComparison, ComparisonRow } from "@/lib/tender/types";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

interface Props {
  projectId: string;
  /** Defaults to `/api/projects/{id}/comparison` (office portal). */
  comparisonUrl?: string;
  /** Defaults to `/api/projects/{id}/comparison/export`. */
  exportUrl?: string;
}

function lowestYard(
  row: ComparisonRow,
  yardIds: string[],
): string | null {
  let lowest: string | null = null;
  let lowestVal = Infinity;
  for (const id of yardIds) {
    const cell = row.byYard[id];
    const val = cell?.netTotal ?? cell?.calculatedTotal;
    if (val != null && val < lowestVal) {
      lowestVal = val;
      lowest = id;
    }
  }
  return lowest;
}

export function HybridComparisonMatrix({
  projectId,
  comparisonUrl,
  exportUrl,
}: Props) {
  const fetchUrl = comparisonUrl ?? `/api/projects/${projectId}/comparison`;
  const downloadUrl = exportUrl ?? `/api/projects/${projectId}/comparison/export`;
  const [data, setData] = useState<HybridComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetch(fetchUrl);
      const json = await res.json();
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setError(json.error ?? "Failed to load comparison.");
        return;
      }
      setData(json.comparison);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchUrl]);

  if (loading) {
    return <ActiniumLoadingState label="Loading comparison…" size="sm" />;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!data || data.yards.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Invite shipyards and collect online portal quotes to see the comparison matrix.
        </CardContent>
      </Card>
    );
  }

  const currency = data.project.currency;
  const categories = data.project.categories ?? [];
  const rowCategoryLabel = (bucket: string) => categoryLabelFromList(categories, bucket);
  const allRows = [...data.rows, ...data.extraRows];
  const yardIds = data.yards.map((y) => y.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {data.yards.length} yard{data.yards.length === 1 ? "" : "s"} · {allRows.length} lines
        </p>
        <Button
          variant="outline"
          render={
            <a href={downloadUrl} />
          }
        >
          Download Excel
        </Button>
      </div>

      <TableCard>
        <ScrollArea className="w-full">
          <Table className="min-w-full text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-muted">Bucket</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="min-w-[180px]">Description</TableHead>
                <TableHead className="text-muted-foreground">Scope qty</TableHead>
                <TableHead className="text-muted-foreground">Days</TableHead>
                <TableHead className="text-muted-foreground">Unit</TableHead>
                {data.yards.map((y) => (
                  <TableHead
                    key={y.id}
                    colSpan={3}
                    className="border-l text-center"
                  >
                    {y.name}
                    <div className="font-normal text-muted-foreground">{y.status}</div>
                  </TableHead>
                ))}
              </TableRow>
              <TableRow className="text-[10px] text-muted-foreground">
                <TableHead colSpan={6} />
                {data.yards.map((y) => (
                  <React.Fragment key={y.id}>
                    <TableHead className="border-l px-2">Rate</TableHead>
                    <TableHead className="px-2">Disc%</TableHead>
                    <TableHead className="px-2">Net</TableHead>
                  </React.Fragment>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {allRows.map((row, i) => {
                const lowest = lowestYard(row, yardIds);
                return (
                  <TableRow key={`${row.specLineId ?? "extra"}-${i}`}>
                    <TableCell className="sticky left-0 z-10 bg-card text-muted-foreground">
                      {rowCategoryLabel(row.bucket)}
                    </TableCell>
                    <TableCell className="font-mono">{row.lineCode ?? "—"}</TableCell>
                    <TableCell>
                      {row.description}
                      {row.scopeNotes && (
                        <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                          {row.scopeNotes}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{row.scopeQty ?? "—"}</TableCell>
                    <TableCell>{row.scopeDays ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{row.unit ?? "—"}</TableCell>
                    {data.yards.map((y) => {
                      const cell = row.byYard[y.id];
                      if (!cell) {
                        return (
                          <React.Fragment key={y.id}>
                            <TableCell className="border-l text-muted-foreground/50">—</TableCell>
                            <TableCell className="text-muted-foreground/50">—</TableCell>
                            <TableCell className="text-muted-foreground/50">—</TableCell>
                          </React.Fragment>
                        );
                      }
                      const net = cell.netTotal ?? cell.calculatedTotal;
                      const isLowest = lowest === y.id && net != null;
                      return (
                        <React.Fragment key={y.id}>
                          <TableCell className="border-l">
                            {cell.unitRate != null ? fmtMoney(cell.unitRate, currency) : "—"}
                          </TableCell>
                          <TableCell>
                            {cell.discountPct ? `${cell.discountPct}%` : "—"}
                          </TableCell>
                          <TableCell
                            className={`font-medium ${isLowest ? "bg-emerald-50 text-emerald-700" : ""}`}
                          >
                            {net != null ? fmtMoney(net, currency) : "—"}
                            {cell.pricingStatus !== "priced" && (
                              <span className="ml-1 text-[10px] text-muted-foreground">
                                {cell.pricingStatus}
                              </span>
                            )}
                          </TableCell>
                        </React.Fragment>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="font-semibold">
                <TableCell colSpan={6}>Grand total (net)</TableCell>
                {data.yards.map((y) => {
                  const val = data.grandTotals[y.id];
                  const allVals = yardIds
                    .map((id) => data.grandTotals[id])
                    .filter((v): v is number => v != null);
                  const isLowest =
                    val != null && allVals.length > 1 && val === Math.min(...allVals);
                  return (
                    <TableCell
                      key={y.id}
                      colSpan={3}
                      className={`border-l text-center ${isLowest ? "bg-emerald-50 text-emerald-700" : ""}`}
                    >
                      {fmtMoney(val, currency)}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableFooter>
          </Table>
        </ScrollArea>
      </TableCard>

      {data.bucketTotals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Bucket totals</CardTitle>
          </CardHeader>
          <CardContent>
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="text-muted-foreground">
                  <TableHead>Bucket</TableHead>
                  {data.yards.map((y) => (
                    <TableHead key={y.id}>{y.name}</TableHead>
                  ))}
                  <TableHead className="text-emerald-700">Lowest</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.bucketTotals.map((b) => {
                  const vals = data.yards.map((y) => b.byYard[y.id]);
                  const nums = vals.filter((v): v is number => v != null);
                  const min = nums.length > 0 ? Math.min(...nums) : null;
                  return (
                    <TableRow key={b.bucket}>
                      <TableCell>{b.label}</TableCell>
                      {data.yards.map((y) => {
                        const val = b.byYard[y.id];
                        const isMin = val != null && nums.length > 1 && val === min;
                        return (
                          <TableCell
                            key={y.id}
                            className={isMin ? "font-semibold text-emerald-700" : ""}
                          >
                            {fmtMoney(val, currency)}
                          </TableCell>
                        );
                      })}
                      <TableCell className="font-semibold text-emerald-700">
                        {fmtMoney(min, currency)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
