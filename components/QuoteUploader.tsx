"use client";

import type { VendorQuote } from "@/lib/types";

interface QuoteUploaderProps {
  quotes: VendorQuote[];
  onAdd: (files: FileList) => void;
  onRemove: (index: number) => void;
  onRename: (index: number, name: string) => void;
}

export function QuoteUploader({
  quotes,
  onAdd,
  onRemove,
  onRename,
}: QuoteUploaderProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">Vendor quote files</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Upload one Excel file (.xlsx, .xls) per vendor. Services are read from every
        sheet; section headings are detected automatically.
      </p>

      <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 transition hover:border-blue-400 hover:bg-blue-50/50">
        <span className="text-sm font-medium text-zinc-700">
          Drop Excel files here or click to browse
        </span>
        <span className="mt-1 text-xs text-zinc-500">.xlsx, .xls — multiple files allowed</span>
        <input
          type="file"
          accept=".xlsx,.xls,.xlsm"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onAdd(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {quotes.length > 0 && (
        <ul className="mt-4 space-y-2">
          {quotes.map((q, i) => (
            <li
              key={`${q.fileName}-${i}`}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2"
            >
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Vendor
              </span>
              <input
                type="text"
                value={q.vendorName}
                onChange={(e) => onRename(i, e.target.value)}
                className="min-w-[140px] flex-1 rounded border border-zinc-200 px-2 py-1 text-sm"
              />
              <span className="text-xs text-zinc-500">
                {q.fileName} · {q.items.length} line items
              </span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-sm text-red-600 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
