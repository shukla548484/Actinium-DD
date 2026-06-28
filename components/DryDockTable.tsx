"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TableCard } from "@/components/layout/TableCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DryDockComparison } from "@/lib/dryDock/types";

function fmtMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtDays(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return String(n);
}

function lowestTotalVendor(
  vendors: string[],
  byVendor: DryDockComparison["byVendor"],
): string | null {
  let best: string | null = null;
  let bestVal = Infinity;
  for (const v of vendors) {
    const t = byVendor[v]?.calculatedTotal;
    if (t != null && t < bestVal) {
      bestVal = t;
      best = v;
    }
  }
  return best;
}

export function DryDockTable({ result }: { result: DryDockComparison }) {
  const lowest = lowestTotalVendor(result.vendors, result.byVendor);

  return (
    <div className="space-y-4">
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 hover:bg-zinc-50">
              <TableHead className="px-4 font-semibold text-zinc-700">Vendor</TableHead>
              <TableHead className="px-4 font-semibold text-zinc-700">
                Stated dry-dock days
              </TableHead>
              <TableHead className="px-4 font-semibold text-zinc-700">Daily rate</TableHead>
              <TableHead className="px-4 font-semibold text-zinc-700">
                Calculated total
              </TableHead>
              <TableHead className="px-4 font-semibold text-zinc-700">
                Quoted line total
              </TableHead>
              <TableHead className="px-4 font-semibold text-zinc-700">
                Rate line (as quoted)
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.vendors.map((vendor) => {
              const q = result.byVendor[vendor];
              const isLowest =
                lowest === vendor && q.calculatedTotal != null;
              return (
                <TableRow key={vendor}>
                  <TableCell className="px-4 font-medium text-zinc-900">{vendor}</TableCell>
                  <TableCell className="px-4 text-zinc-800">
                    <span title={q.daysSource ?? undefined}>{fmtDays(q.dryDockDays)}</span>
                  </TableCell>
                  <TableCell className="px-4 text-zinc-800" title={q.rateSource ?? undefined}>
                    {fmtMoney(q.dailyRatePerDay)}
                  </TableCell>
                  <TableCell
                    className={`px-4 font-medium ${
                      isLowest ? "bg-emerald-50 text-emerald-900" : "text-zinc-900"
                    }`}
                  >
                    {fmtMoney(q.calculatedTotal)}
                  </TableCell>
                  <TableCell className="px-4 text-zinc-700">
                    {fmtMoney(q.quotedTotal)}
                  </TableCell>
                  <TableCell
                    className="max-w-xs truncate px-4 text-zinc-600"
                    title={q.rateLineLabel ?? undefined}
                  >
                    {q.rateLineLabel ?? "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableCard>

      {result.vendors.some((v) => result.byVendor[v].warnings.length > 0) && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTitle>Parsing notes</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-inside list-disc space-y-1">
              {result.vendors.map((v) =>
                result.byVendor[v].warnings.map((w) => (
                  <li key={`${v}-${w}`}>
                    <strong>{v}:</strong> {w}
                  </li>
                )),
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <p className="text-xs text-muted-foreground">
        Dry-dock days are taken only from the shipyard&apos;s stated figure in the
        header or summary (e.g. &quot;Days in dry dock: 12&quot;), not from line-item
        quantities or date ranges. Total cost = stated days × daily dock hire rate.
      </p>
    </div>
  );
}
