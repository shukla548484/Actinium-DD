/** Standard rows-per-page choices for data tables (app-wide). */
export const TABLE_PAGE_SIZE_OPTIONS = [5, 10, 15, 25, 50, 100] as const;

export type TablePageSize = (typeof TABLE_PAGE_SIZE_OPTIONS)[number];

/** Default rows per page when a table does not persist user preference. */
export const DEFAULT_TABLE_PAGE_SIZE: TablePageSize = 15;

/** Smallest allowed page size (same as minimum option). */
export const MIN_TABLE_PAGE_SIZE: TablePageSize = TABLE_PAGE_SIZE_OPTIONS[0];

export function isTablePageSize(n: number): n is TablePageSize {
  return (TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(n);
}

/** Parse query/body page size; returns fallback unless value is an allowed option. */
export function parseTablePageSize(
  value: string | number | null | undefined,
  fallback: TablePageSize = DEFAULT_TABLE_PAGE_SIZE
): TablePageSize {
  const n =
    typeof value === "number"
      ? value
      : parseInt(String(value ?? ""), 10);
  return isTablePageSize(n) ? n : fallback;
}
