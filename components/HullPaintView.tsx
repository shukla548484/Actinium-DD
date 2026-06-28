"use client";

import { Fragment } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TableCard } from "@/components/layout/TableCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { HullPaintComparison, VendorHullPaintQuote } from "@/lib/hull/types";

function money(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtArea(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);
}

interface HullPaintViewProps {
  quotes: VendorHullPaintQuote[];
  comparison: HullPaintComparison | null;
}

export function HullPaintView({ quotes, comparison }: HullPaintViewProps) {
  if (quotes.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Upload vendor Excel files to extract hull zones, areas (m²), and prep treatment
        rates (SA 1, SA 2, blasting, washing, drying, etc.).
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <Alert className="border-blue-200 bg-blue-50/60 text-blue-950">
        <AlertTitle>Hull paint — how areas & costs are read</AlertTitle>
        <AlertDescription className="text-blue-900/90">
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              <strong>Zones</strong> (Boot Top, Flat Bottom, Vertical Bottom, etc.) are
              detected from section headings or labels in the sheet.
            </li>
            <li>
              <strong>Area (m²)</strong> from the sheet, or{" "}
              <strong>estimated</strong> from LOA / LBP / Breadth / Depth / Draught using
              the Paint Consultants formula when missing.
            </li>
            <li>
              <strong>Unit rate</strong> is read from rate/m² or unit price columns;{" "}
              <strong>total = area × rate</strong> when both are present.
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      {quotes.map((q) => (
        <Card key={q.vendorName}>
          <CardHeader>
            <CardTitle>{q.vendorName}</CardTitle>
            <CardDescription>{q.fileName}</CardDescription>
          </CardHeader>
          <CardContent>
            {q.zoneAreas.length > 0 ? (
              <Table className="max-w-xl">
                <TableHeader>
                  <TableRow className="text-left text-zinc-600 hover:bg-transparent">
                    <TableHead className="h-8 py-1 pr-4">Hull zone</TableHead>
                    <TableHead className="h-8 py-1 pr-4">Area (m²)</TableHead>
                    <TableHead className="h-8 py-1">Found at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.zoneAreas.map((z) => (
                    <TableRow key={z.zoneId}>
                      <TableCell className="py-2 font-medium">
                        {z.zoneName}
                        {z.estimated && (
                          <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-800">
                            estimated
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-2">{fmtArea(z.areaSqm)}</TableCell>
                      <TableCell className="py-2 text-xs text-zinc-500">{z.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Alert>
                <AlertDescription>
                  No areas in sheet — enter vessel dimensions above to propose estimated m²
                  for paint cost calculation.
                </AlertDescription>
              </Alert>
            )}

            <p className="mt-3 text-xs text-zinc-500">
              {q.lineItems.length} prep/treatment line items parsed
            </p>
          </CardContent>
        </Card>
      ))}

      {comparison && comparison.rows.length > 0 && (
        <TableCard title="Prep cost comparison (per zone × treatment)">
          <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50 hover:bg-zinc-50">
                  <TableHead className="px-3">Zone</TableHead>
                  <TableHead className="px-3">Treatment</TableHead>
                  {comparison.vendors.map((v) => (
                    <TableHead key={v} colSpan={4} className="border-l px-3 text-center">
                      {v}
                    </TableHead>
                  ))}
                </TableRow>
                <TableRow className="bg-zinc-50/80 text-xs text-zinc-500 hover:bg-zinc-50/80">
                  <TableHead colSpan={2} className="h-8" />
                  {comparison.vendors.map((v) => (
                    <Fragment key={`${v}-sub`}>
                      <TableHead className="h-8 border-l px-2">m²</TableHead>
                      <TableHead className="h-8 px-2">/m²</TableHead>
                      <TableHead className="h-8 px-2">Calc</TableHead>
                      <TableHead className="h-8 px-2">Quoted</TableHead>
                    </Fragment>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparison.rows.map((row) => {
                  const calcTotals = comparison.vendors
                    .map((v) => row.byVendor[v]?.calculatedTotal)
                    .filter((t): t is number => t != null);
                  const minCalc = calcTotals.length ? Math.min(...calcTotals) : null;

                  return (
                    <TableRow key={`${row.zoneId}-${row.serviceId}`}>
                      <TableCell className="px-3 font-medium text-zinc-800">
                        {row.zoneName}
                      </TableCell>
                      <TableCell className="px-3 text-zinc-700">{row.serviceName}</TableCell>
                      {comparison.vendors.map((v) => {
                        const cell = row.byVendor[v];
                        const isBest =
                          cell?.calculatedTotal != null &&
                          minCalc != null &&
                          cell.calculatedTotal === minCalc;
                        return (
                          <Fragment key={v}>
                            <TableCell className="border-l px-2 text-zinc-600">
                              {fmtArea(row.areaByVendor[v])}
                            </TableCell>
                            <TableCell className="px-2">{money(cell?.unitRatePerSqm)}</TableCell>
                            <TableCell
                              className={`px-2 font-medium ${isBest ? "text-emerald-700" : ""}`}
                            >
                              {money(cell?.calculatedTotal)}
                            </TableCell>
                            <TableCell className="px-2 text-zinc-600">
                              {money(cell?.quotedTotal)}
                            </TableCell>
                          </Fragment>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
        </TableCard>
      )}

      {quotes.length > 0 && comparison?.rows.length === 0 && (
        <Alert>
          <AlertDescription>
            Areas or prep lines not matched yet. Ensure rows list treatments (SA 2, spot
            blasting, HP wash, etc.) with area and rate under each hull zone section.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
