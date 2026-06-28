"use client";

import { TableCard } from "@/components/layout/TableCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { YardServicesComparison } from "@/lib/yardServices/types";

function fmtMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtNum(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return String(n);
}

function lowestVendor(
  vendors: string[],
  totals: Record<string, number | null | undefined>,
): string | null {
  let best: string | null = null;
  let bestVal = Infinity;
  for (const v of vendors) {
    const t = totals[v];
    if (t != null && t < bestVal) {
      bestVal = t;
      best = v;
    }
  }
  return best;
}

export function YardServicesTable({ result }: { result: YardServicesComparison }) {
  const lowestEquipment = lowestVendor(
    result.vendors,
    Object.fromEntries(
      result.vendors.map((v) => [v, result.totalsByVendor[v]?.equipmentGrandTotal]),
    ),
  );
  const lowestGrand = lowestVendor(
    result.vendors,
    Object.fromEntries(
      result.vendors.map((v) => [v, result.totalsByVendor[v]?.grandTotal]),
    ),
  );

  const equipmentRows = result.rows.filter((r) => r.kind === "equipment");
  const watchRows = result.rows.filter((r) => r.kind === "watch");

  return (
    <div className="space-y-6">
      <TableCard title="Service duration by vendor">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 hover:bg-zinc-50">
              <TableHead className="px-4 font-semibold text-zinc-700">Vendor</TableHead>
              <TableHead className="px-4 font-semibold text-zinc-700">Shipyard days</TableHead>
              <TableHead className="px-4 font-semibold text-zinc-700">Dry-dock days</TableHead>
              <TableHead className="px-4 font-semibold text-zinc-700">Total service days</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.vendors.map((vendor) => {
              const d = result.durationByVendor[vendor];
              return (
                <TableRow key={vendor}>
                  <TableCell className="px-4 font-medium text-zinc-900">{vendor}</TableCell>
                  <TableCell
                    className="px-4 text-zinc-800"
                    title={d?.shipyardDaysSource ?? undefined}
                  >
                    {fmtNum(d?.shipyardDays)}
                  </TableCell>
                  <TableCell
                    className="px-4 text-zinc-800"
                    title={d?.dryDockDaysSource ?? undefined}
                  >
                    {fmtNum(d?.dryDockDays)}
                  </TableCell>
                  <TableCell className="px-4 font-medium text-zinc-900">
                    {fmtNum(d?.totalServiceDays)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableCard>

      <TableCard title="Temporary ventilation, exhaust fan & lighting">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 hover:bg-zinc-50">
              <TableHead className="px-4 font-semibold text-zinc-700">Service</TableHead>
              {result.vendors.map((v) => (
                <TableHead key={v} className="px-4 font-semibold text-zinc-700">
                  {v}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipmentRows.map((row) => (
              <TableRow key={row.serviceId}>
                <TableCell className="px-4 font-medium text-zinc-900">{row.serviceName}</TableCell>
                {result.vendors.map((vendor) => {
                  const c = row.byVendor[vendor];
                  return (
                    <TableCell key={vendor} className="px-4 align-top text-zinc-800">
                      {c?.rate != null ? (
                        <div className="space-y-0.5">
                          <div>
                            {fmtMoney(c.rate)}/unit/day × {fmtNum(c.effectiveUnits)} unit
                            {c.effectiveUnits === 1 ? "" : "s"}
                            {c.minimumUnits != null && (
                              <span className="text-zinc-500"> (min {c.minimumUnits})</span>
                            )}
                          </div>
                          <div className="text-zinc-600">
                            Daily: {fmtMoney(c.dailyCost)} · {fmtNum(c.serviceDays)} days
                          </div>
                          <div className="font-medium text-zinc-900">
                            {fmtMoney(c.calculatedTotal)}
                          </div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            <TableRow className="bg-zinc-50 font-semibold hover:bg-zinc-50">
              <TableCell className="px-4 text-zinc-900">Equipment subtotal</TableCell>
              {result.vendors.map((vendor) => {
                const total = result.totalsByVendor[vendor]?.equipmentGrandTotal;
                const isLowest = lowestEquipment === vendor && total != null;
                return (
                  <TableCell
                    key={vendor}
                    className={`px-4 ${
                      isLowest ? "bg-emerald-50 text-emerald-900" : "text-zinc-900"
                    }`}
                  >
                    {fmtMoney(total)}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableBody>
        </Table>
      </TableCard>

      {watchRows.some((row) =>
        result.vendors.some((v) => row.byVendor[v]?.calculatedTotal != null),
      ) && (
        <TableCard title="Fireman watch & security patrol">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50 hover:bg-zinc-50">
                <TableHead className="px-4 font-semibold text-zinc-700">Service</TableHead>
                {result.vendors.map((v) => (
                  <TableHead key={v} className="px-4 font-semibold text-zinc-700">
                    {v}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {watchRows.map((row) => (
                <TableRow key={row.serviceId}>
                  <TableCell className="px-4 font-medium text-zinc-900">{row.serviceName}</TableCell>
                  {result.vendors.map((vendor) => {
                    const c = row.byVendor[vendor];
                    return (
                      <TableCell key={vendor} className="px-4 align-top text-zinc-800">
                        {c?.rate != null ? (
                          <div className="space-y-0.5">
                            <div>
                              {fmtMoney(c.rate)}/person/shift × {fmtNum(c.personsPerDay)} persons
                            </div>
                            <div className="text-zinc-600">
                              Daily: {fmtMoney(c.dailyCost)} · {fmtNum(c.serviceDays)} days
                            </div>
                            <div className="font-medium text-zinc-900">
                              {fmtMoney(c.calculatedTotal)}
                            </div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              <TableRow className="bg-zinc-50 font-semibold hover:bg-zinc-50">
                <TableCell className="px-4 text-zinc-900">Watch services subtotal</TableCell>
                {result.vendors.map((vendor) => (
                  <TableCell key={vendor} className="px-4 text-zinc-900">
                    {fmtMoney(result.totalsByVendor[vendor]?.watchGrandTotal)}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </TableCard>
      )}

      <div className="space-y-3">
        <TableCard title="Grand totals" className="bg-muted/30">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4 font-semibold text-zinc-700">Vendor</TableHead>
                <TableHead className="px-4 font-semibold text-zinc-700">Equipment total</TableHead>
                <TableHead className="px-4 font-semibold text-zinc-700">Watch total</TableHead>
                <TableHead className="px-4 font-semibold text-zinc-700">Grand total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.vendors.map((vendor) => {
                const t = result.totalsByVendor[vendor];
                const isLowest = lowestGrand === vendor && t?.grandTotal != null;
                return (
                  <TableRow key={vendor}>
                    <TableCell className="px-4 font-medium text-zinc-900">{vendor}</TableCell>
                    <TableCell className="px-4 text-zinc-800">
                      {fmtMoney(t?.equipmentGrandTotal)}
                    </TableCell>
                    <TableCell className="px-4 text-zinc-800">{fmtMoney(t?.watchGrandTotal)}</TableCell>
                    <TableCell
                      className={`px-4 font-semibold ${
                        isLowest ? "bg-emerald-100 text-emerald-900" : "text-zinc-900"
                      }`}
                    >
                      {fmtMoney(t?.grandTotal)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableCard>
        <p className="text-xs text-muted-foreground">
          Temporary equipment: total = rate per unit per day × effective units × service days.
          Effective units = max(quoted quantity, minimum units). Service days = shipyard days +
          dry-dock days (from the shipyard&apos;s stated figures in the quote header). Watch
          services: daily cost = rate per person × persons per day (24 ÷ shift hours); total =
          daily cost × service days.
        </p>
      </div>
    </div>
  );
}
