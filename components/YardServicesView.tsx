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
import type {
  VendorYardServicesQuote,
  YardServicesComparison,
  YardServicesComparisonRow,
} from "@/lib/yardServices/types";

function fmtMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtDays(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return String(n);
}

function rowHasData(row: YardServicesComparisonRow, vendor: string): boolean {
  const cell = row.byVendor[vendor];
  return !!(cell?.calculatedTotal ?? cell?.quotedTotal ?? cell?.rate);
}

function lowestTotalVendor(
  vendors: string[],
  row: YardServicesComparisonRow,
): string | null {
  let best: string | null = null;
  let bestVal = Infinity;
  for (const v of vendors) {
    const t = row.byVendor[v]?.calculatedTotal;
    if (t != null && t < bestVal) {
      bestVal = t;
      best = v;
    }
  }
  return best;
}

function rateLabel(row: YardServicesComparisonRow): string {
  if (row.kind === "watch") return "$/person/shift";
  if (row.kind === "equipment") return "$/unit/day";
  return "$/conn/day";
}

function unitsLabel(row: YardServicesComparisonRow): string {
  if (row.kind === "watch") return "Persons/day";
  if (row.kind === "equipment") return "Units";
  return "Connections";
}

function ServiceRow({
  row,
  vendors,
}: {
  row: YardServicesComparisonRow;
  vendors: string[];
}) {
  const lowest = lowestTotalVendor(vendors, row);

  return (
    <TableRow>
      <TableCell className="px-3 py-2.5 align-top font-medium text-zinc-900">
        {row.serviceName}
        <span className="mt-0.5 block text-xs font-normal capitalize text-zinc-500">
          {row.kind}
          {row.kind === "connection" && row.connectDisconnectMultiplier != null && (
            <> · hookup ×{row.connectDisconnectMultiplier}</>
          )}
        </span>
      </TableCell>
      {vendors.map((vendor) => {
        const cell = row.byVendor[vendor];
        const isLowest = lowest === vendor && cell.calculatedTotal != null;
        const units =
          row.kind === "watch"
            ? cell.personsPerDay
            : cell.effectiveUnits;

        return (
          <TableCell
            key={vendor}
            className={`border-l px-3 py-2.5 align-top ${
              isLowest ? "bg-emerald-50" : ""
            }`}
          >
            {!rowHasData(row, vendor) ? (
              <span className="text-zinc-400">—</span>
            ) : (
              <dl className="space-y-1 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">{rateLabel(row)}</dt>
                  <dd className="text-zinc-800">{fmtMoney(cell.rate)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">{unitsLabel(row)}</dt>
                  <dd className="text-zinc-800">
                    {units ?? "—"}
                    {row.kind === "equipment" &&
                      cell.minimumUnits != null &&
                      cell.effectiveUnits === cell.minimumUnits && (
                        <span className="text-zinc-500"> (min)</span>
                      )}
                  </dd>
                </div>
                {row.kind === "connection" && cell.rateConnectDisconnect != null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-zinc-500">
                      Hookup ×{cell.connectDisconnectMultiplier ?? row.connectDisconnectMultiplier}
                    </dt>
                    <dd className="text-zinc-800">
                      {fmtMoney(cell.connectDisconnectTotal)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">Daily</dt>
                  <dd className="text-zinc-800">{fmtMoney(cell.dailyCost)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">Days</dt>
                  <dd className="text-zinc-800">{fmtDays(cell.serviceDays)}</dd>
                </div>
                <div className="flex justify-between gap-2 border-t border-zinc-100 pt-1 font-medium">
                  <dt className="text-zinc-600">Total</dt>
                  <dd className={isLowest ? "text-emerald-900" : "text-zinc-900"}>
                    {fmtMoney(cell.calculatedTotal)}
                  </dd>
                </div>
              </dl>
            )}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

interface YardServicesViewProps {
  quotes: VendorYardServicesQuote[];
  comparison: YardServicesComparison | null;
}

export function YardServicesView({ quotes, comparison }: YardServicesViewProps) {
  if (quotes.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Upload vendor Excel files to calculate watch, equipment, and utility connection costs.
      </p>
    );
  }

  if (!comparison) return null;

  const watchRows = comparison.rows.filter((r) => r.kind === "watch");
  const equipmentRows = comparison.rows.filter((r) => r.kind === "equipment");
  const connectionRows = comparison.rows.filter((r) => r.kind === "connection");

  const allWarnings = quotes.flatMap((q) =>
    q.warnings.map((w) => ({ vendor: q.vendorName, message: w })),
  );

  return (
    <div className="space-y-6">
      <Alert className="border-blue-200 bg-blue-50/60 text-blue-950">
        <AlertTitle>Watch services</AlertTitle>
        <AlertDescription className="text-blue-900/90">
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Daily cost = rate per person × persons for 24 h (e.g. 80 × 3 = 240).</li>
            <li>Days = shipyard + dry dock from the stated header/summary.</li>
          </ul>
        </AlertDescription>
      </Alert>

      <Alert className="border-amber-200 bg-amber-50/60 text-amber-950">
        <AlertTitle>Temporary ventilation, exhaust fan &amp; lighting</AlertTitle>
        <AlertDescription className="text-amber-900/90">
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              <strong>Daily cost</strong> = rate per unit per day × effective units (e.g. 25 × 4 = 100).
            </li>
            <li>
              <strong>Effective units</strong> = max(quoted quantity, minimum units from the line item).
            </li>
            <li>
              <strong>Total</strong> = daily cost × service days (shipyard + dry dock from the header).
            </li>
            <li>
              Equipment subtotal sums ventilation, exhaust fan, and lighting — not a single line only.
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      <Alert className="border-violet-200 bg-violet-50/60 text-violet-950">
        <AlertTitle>Utility connections (cooling water, shore power, etc.)</AlertTitle>
        <AlertDescription className="text-violet-900/90">
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              <strong>Cooling water</strong> defaults to <strong>5 connections</strong> unless qty is stated in the sheet.
            </li>
            <li>
              <strong>Daily charge</strong> = $/connection/day × connections × CPR stay days.
            </li>
            <li>
              <strong>Connect / disconnect</strong> = quoted hookup rate × <strong>2</strong> (connection + disconnection) × connections. Same ×2 rule applies to shore power, compressed air, and fresh water.
            </li>
            <li>
              <strong>CPR days</strong> from header; falls back to shipyard days, then shipyard + dry dock.
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      <TableCard title="Yard services comparison">
        <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50 hover:bg-zinc-50">
                <TableHead className="px-3 font-semibold text-zinc-700">Service</TableHead>
                {comparison.vendors.map((v) => (
                  <TableHead key={v} className="border-l px-3 font-semibold text-zinc-700">
                    {v}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {watchRows.some((r) => comparison.vendors.some((v) => rowHasData(r, v))) && (
                <>
                  <TableRow className="bg-zinc-50/80 hover:bg-zinc-50/80">
                    <TableCell
                      colSpan={comparison.vendors.length + 1}
                      className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500"
                    >
                      Watch
                    </TableCell>
                  </TableRow>
                  {watchRows.map((row) => (
                    <ServiceRow key={row.serviceId} row={row} vendors={comparison.vendors} />
                  ))}
                </>
              )}
              {equipmentRows.some((r) => comparison.vendors.some((v) => rowHasData(r, v))) && (
                <>
                  <TableRow className="bg-zinc-50/80 hover:bg-zinc-50/80">
                    <TableCell
                      colSpan={comparison.vendors.length + 1}
                      className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500"
                    >
                      Temporary equipment
                    </TableCell>
                  </TableRow>
                  {equipmentRows.map((row) => (
                    <ServiceRow key={row.serviceId} row={row} vendors={comparison.vendors} />
                  ))}
                </>
              )}
              {connectionRows.some((r) => comparison.vendors.some((v) => rowHasData(r, v))) && (
                <>
                  <TableRow className="bg-zinc-50/80 hover:bg-zinc-50/80">
                    <TableCell
                      colSpan={comparison.vendors.length + 1}
                      className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500"
                    >
                      Utility connections
                    </TableCell>
                  </TableRow>
                  {connectionRows.map((row) => (
                    <ServiceRow key={row.serviceId} row={row} vendors={comparison.vendors} />
                  ))}
                </>
              )}
            </TableBody>
          </Table>
      </TableCard>

      <TableCard title="Vendor totals">
        <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50 hover:bg-zinc-50">
                <TableHead className="px-4 font-semibold text-zinc-700">Vendor</TableHead>
                <TableHead className="px-4 font-semibold text-zinc-700">Watch total</TableHead>
                <TableHead className="px-4 font-semibold text-zinc-700">Equipment total</TableHead>
                <TableHead className="px-4 font-semibold text-zinc-700">Connections total</TableHead>
                <TableHead className="px-4 font-semibold text-zinc-700">Grand total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparison.vendors.map((vendor) => {
                const t = comparison.totalsByVendor[vendor];
                return (
                  <TableRow key={vendor}>
                    <TableCell className="px-4 font-medium text-zinc-900">{vendor}</TableCell>
                    <TableCell className="px-4 text-zinc-800">{fmtMoney(t?.watchGrandTotal)}</TableCell>
                    <TableCell className="px-4 text-zinc-800">{fmtMoney(t?.equipmentGrandTotal)}</TableCell>
                    <TableCell className="px-4 text-zinc-800">{fmtMoney(t?.connectionGrandTotal)}</TableCell>
                    <TableCell className="px-4 font-medium text-zinc-900">{fmtMoney(t?.grandTotal)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
      </TableCard>

      <TableCard title="Service duration" className="bg-muted/30">
        <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4 font-semibold text-zinc-600">Vendor</TableHead>
                <TableHead className="px-4 font-semibold text-zinc-600">Shipyard days</TableHead>
                <TableHead className="px-4 font-semibold text-zinc-600">Dry-dock days</TableHead>
                <TableHead className="px-4 font-semibold text-zinc-600">CPR days</TableHead>
                <TableHead className="px-4 font-semibold text-zinc-600">Total service days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparison.vendors.map((vendor) => {
                const d = comparison.durationByVendor[vendor];
                return (
                  <TableRow key={vendor}>
                    <TableCell className="px-4 font-medium text-zinc-900">{vendor}</TableCell>
                    <TableCell className="px-4 text-zinc-800">{fmtDays(d?.shipyardDays)}</TableCell>
                    <TableCell className="px-4 text-zinc-800">{fmtDays(d?.dryDockDays)}</TableCell>
                    <TableCell className="px-4 text-zinc-800">{fmtDays(d?.cprDays)}</TableCell>
                    <TableCell className="px-4 text-zinc-800">{fmtDays(d?.totalServiceDays)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
      </TableCard>

      {allWarnings.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTitle>Parsing notes</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-inside list-disc space-y-1">
              {allWarnings.map((w) => (
                <li key={`${w.vendor}-${w.message}`}>
                  <strong>{w.vendor}:</strong> {w.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
