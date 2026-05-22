"use client";

import { Fragment } from "react";
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
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50">
            <th className="sticky left-0 z-10 bg-zinc-50 px-4 py-3 font-semibold text-zinc-900">
              Standard service
            </th>
            <th className="px-3 py-3 font-semibold text-zinc-700">Category</th>
            {vendors.map((v) => (
              <th
                key={v}
                colSpan={4}
                className="border-l border-zinc-200 px-3 py-3 text-center font-semibold text-blue-900"
              >
                {v}
              </th>
            ))}
          </tr>
          <tr className="border-b border-zinc-100 bg-zinc-50/80 text-xs text-zinc-600">
            <th className="sticky left-0 bg-zinc-50/80" />
            <th />
            {vendors.map((v) => (
              <Fragment key={`${v}-sub`}>
                <th className="border-l border-zinc-100 px-2 py-1">As quoted</th>
                <th className="px-2 py-1">Qty</th>
                <th className="px-2 py-1">Unit</th>
                <th className="px-2 py-1 font-medium text-zinc-800">Total</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const totals = vendors
              .map((v) => row.byVendor[v]?.item?.totalPrice)
              .filter((t): t is number => t != null);
            const min = totals.length ? Math.min(...totals) : null;

            return (
              <tr key={row.service.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                <td className="sticky left-0 z-10 max-w-[220px] bg-white px-4 py-2.5 font-medium text-zinc-900">
                  {row.service.name}
                  {row.service.category && (
                    <span className="mt-0.5 block text-xs font-normal text-zinc-500">
                      from {row.service.category}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-zinc-600">{row.service.category ?? "—"}</td>
                {vendors.map((v) => {
                  const cell = row.byVendor[v];
                  const item = cell?.item;
                  const match = cell?.match;
                  const isLow = match && match.score < 0.7 && match.autoMatched;
                  const isBest =
                    item?.totalPrice != null && min != null && item.totalPrice === min;

                  return (
                    <Fragment key={`${v}-${row.service.id}`}>
                      <td
                        className={`border-l border-zinc-100 px-2 py-2.5 ${isLow ? "bg-amber-50" : ""}`}
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
                      </td>
                      <td className="px-2 py-2.5 text-zinc-600">
                        {item?.quantity ?? "—"}
                      </td>
                      <td className="px-2 py-2.5 text-zinc-600">
                        {money(item?.unitPrice)}
                      </td>
                      <td
                        className={`px-2 py-2.5 font-medium ${isBest ? "text-emerald-700" : "text-zinc-900"}`}
                      >
                        {money(item?.totalPrice)}
                      </td>
                    </Fragment>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
