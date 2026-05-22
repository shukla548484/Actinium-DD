"use client";

import { useCallback, useMemo, useState } from "react";
import { ComparisonTable } from "@/components/ComparisonTable";
import { QuoteUploader } from "@/components/QuoteUploader";
import { downloadComparisonExcel } from "@/lib/excel/exportComparison";
import { parseExcelFile } from "@/lib/excel/parseQuote";
import { buildComparison } from "@/lib/matching/matchServices";
import type { ComparisonResult, VendorQuote } from "@/lib/types";

export function QuoteCompareApp() {
  const [quotes, setQuotes] = useState<VendorQuote[]>([]);
  const [threshold, setThreshold] = useState(0.55);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const comparison: ComparisonResult | null = useMemo(() => {
    if (quotes.length < 2) return null;
    return buildComparison(quotes, threshold);
  }, [quotes, threshold]);

  const handleAddFiles = useCallback(async (files: FileList) => {
    setError(null);
    setLoading(true);
    try {
      const parsed: VendorQuote[] = [];
      for (const file of Array.from(files)) {
        const quote = await parseExcelFile(file);
        parsed.push(quote);
      }
      setQuotes((prev) => [...prev, ...parsed]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse Excel file");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRemove = useCallback((index: number) => {
    setQuotes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleRename = useCallback((index: number, name: string) => {
    setQuotes((prev) =>
      prev.map((q, i) => (i === index ? { ...q, vendorName: name } : q)),
    );
  }, []);

  const lowConfidenceCount =
    comparison?.rows.reduce((acc, row) => {
      for (const v of comparison.vendors) {
        const m = row.byVendor[v]?.match;
        if (m?.autoMatched && m.score < 0.7) acc++;
      }
      return acc;
    }, 0) ?? 0;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          Excel Sheet Comparison
        </h1>
        <p className="mt-2 max-w-3xl text-zinc-600">
          Compare vendor service quotes side by side. Different wording and row
          layouts are normalized into one standard service list, then costs are
          aligned vertically for easy comparison.
        </p>
      </header>

      <div className="space-y-8">
        <QuoteUploader
          quotes={quotes}
          onAdd={handleAddFiles}
          onRemove={handleRemove}
          onRename={handleRename}
        />

        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Matching sensitivity</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Lower = stricter (fewer fuzzy matches). Raise if vendors use very
                different labels for the same service.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0.35}
                max={0.85}
                step={0.05}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-40"
              />
              <span className="w-12 text-sm font-medium text-zinc-800">
                {Math.round(threshold * 100)}%
              </span>
            </div>
          </div>
        </section>

        {loading && (
          <p className="text-sm text-blue-600">Parsing Excel files…</p>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        )}

        {quotes.length === 1 && (
          <p className="text-sm text-amber-800">
            Add at least one more vendor file to generate a comparison.
          </p>
        )}

        {comparison && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">
                  Standardized comparison
                </h2>
                <p className="text-sm text-zinc-600">
                  {comparison.rows.length} services · {comparison.vendors.length}{" "}
                  vendors
                  {lowConfidenceCount > 0 && (
                    <span className="text-amber-700">
                      {" "}
                      · {lowConfidenceCount} cells with low match confidence (?)
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  downloadComparisonExcel(
                    comparison,
                    `quote-comparison-${new Date().toISOString().slice(0, 10)}.xlsx`,
                  )
                }
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Download comparison Excel
              </button>
            </div>

            <ComparisonTable result={comparison} />

            {Object.entries(comparison.unmatchedByVendor).some(
              ([, items]) => items.length > 0,
            ) && (
              <details className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
                <summary className="cursor-pointer font-medium text-zinc-800">
                  Unparsed / skipped rows
                </summary>
                <ul className="mt-2 space-y-2 text-zinc-600">
                  {Object.entries(comparison.unmatchedByVendor).map(([vendor, items]) =>
                    items.length > 0 ? (
                      <li key={vendor}>
                        <strong>{vendor}</strong>: {items.length} rows
                      </li>
                    ) : null,
                  )}
                </ul>
              </details>
            )}
          </>
        )}
      </div>

      <footer className="mt-16 border-t border-zinc-200 pt-8 text-xs text-zinc-500">
        <p>
          <strong>How it works:</strong> Each sheet is scanned for line items (text +
          price). Section headings become categories. Services are fuzzy-matched across
          vendors (Fuse.js), merged into a canonical list, and exported as a vertical
          comparison matrix.
        </p>
      </footer>
    </div>
  );
}
