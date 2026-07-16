"use client";

import { toast } from "sonner";

export type ClientFilteredExcelColumn = {
  key: string;
  header: string;
  width?: number;
  align?: "left" | "center" | "right";
};

export type DownloadFilteredExcelArgs = {
  title: string;
  subtitle?: string;
  fileName: string;
  columns: ClientFilteredExcelColumn[];
  rows: Array<Record<string, string | number | null | undefined>>;
  totals?: Array<{ label: string; value: string | number }>;
  companyName?: string;
};

/**
 * Download filtered table rows as Actinium-branded Excel via server export.
 */
export async function downloadFilteredTableExcel(
  args: DownloadFilteredExcelArgs
): Promise<boolean> {
  if (!args.rows.length) {
    toast.info("No filtered data to download");
    return false;
  }

  try {
    const res = await fetch("/api/exports/filtered-table", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: args.title,
        subtitle: args.subtitle,
        fileName: args.fileName,
        columns: args.columns,
        rows: args.rows,
        totals: args.totals,
        companyName: args.companyName,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to export Excel");
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = args.fileName.endsWith(".xlsx") ? args.fileName : `${args.fileName}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Excel downloaded");
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to export Excel";
    toast.error(message);
    return false;
  }
}
