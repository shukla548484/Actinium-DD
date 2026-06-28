"use client";

import { Fragment } from "react";
import { TableCard } from "@/components/layout/TableCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ComparisonResult } from "@/lib/types";

function money(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

interface ComparisonTableProps {
  result: ComparisonResult;
}

export function ComparisonTable({ result }: ComparisonTableProps) {
  const { vendors, rows } = result;

  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No services matched yet. Upload vendor files.</p>
    );
  }

  return (
    <TableCard>
      <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 hover:bg-zinc-50">
              <TableHead className="sticky left-0 z-10 bg-zinc-50 px-4 font-semibold text-zinc-900">
                Standard service
              </TableHead>
              <TableHead className="px-3 font-semibold text-zinc-700">Category</TableHead>
              {vendors.map((v) => (
                <TableHead
                  key={v}
                  colSpan={4}
                  className="border-l px-3 text-center font-semibold text-blue-900"
                >
                  {v}
                </TableHead>
              ))}
            </TableRow>
            <TableRow className="bg-zinc-50/80 text-xs text-zinc-600 hover:bg-zinc-50/80">
              <TableHead className="sticky left-0 bg-zinc-50/80" />
              <TableHead />
              {vendors.map((v) => (
                <Fragment key={`${v}-sub`}>
                  <TableHead className="border-l px-2">As quoted</TableHead>
                  <TableHead className="px-2">Qty</TableHead>
                  <TableHead className="px-2">Unit</TableHead>
                  <TableHead className="px-2 font-medium text-zinc-800">Total</TableHead>
                </Fragment>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const totals = vendors
                .map((v) => row.byVendor[v]?.item?.totalPrice)
                .filter((t): t is number => t != null);
              const min = totals.length ? Math.min(...totals) : null;

              return (
                <TableRow key={row.service.id}>
                  <TableCell className="sticky left-0 z-10 max-w-[220px] bg-white px-4 font-medium text-zinc-900">
                    {row.service.name}
                    {row.service.category && (
                      <span className="mt-0.5 block text-xs font-normal text-zinc-500">
                        from {row.service.category}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 text-zinc-600">
                    {row.service.category ?? "—"}
                  </TableCell>
                  {vendors.map((v) => {
                    const cell = row.byVendor[v];
                    const item = cell?.item;
                    const match = cell?.match;
                    const isLow = match && match.score < 0.7 && match.autoMatched;
                    const isBest =
                      item?.totalPrice != null && min != null && item.totalPrice === min;

                    return (
                      <Fragment key={`${v}-${row.service.id}`}>
                        <TableCell
                          className={`border-l px-2 ${isLow ? "bg-amber-50" : ""}`}
                          title={
                            match && item && item.serviceName !== row.service.name
                              ? `Matched at ${Math.round(match.score * 100)}%`
                              : undefined
                          }
                        >
                          <span className="text-zinc-800">{item?.serviceName ?? "—"}</span>
                          {isLow && (
                            <span className="ml-1 text-xs text-amber-700">?</span>
                          )}
                        </TableCell>
                        <TableCell className="px-2 text-zinc-600">
                          {item?.quantity ?? "—"}
                        </TableCell>
                        <TableCell className="px-2 text-zinc-600">
                          {money(item?.unitPrice)}
                        </TableCell>
                        <TableCell
                          className={`px-2 font-medium ${isBest ? "text-emerald-700" : "text-zinc-900"}`}
                        >
                          {money(item?.totalPrice)}
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
  );
}
