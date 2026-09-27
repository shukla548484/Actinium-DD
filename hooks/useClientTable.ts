"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type SortDirection = "asc" | "desc";

export type ClientSortState = {
  key: string;
  direction: SortDirection;
};

export const DEFAULT_CLIENT_PAGE_SIZE = 25;

export type ComparableValue = string | number | Date | null | undefined;

function normalizeComparable(value: ComparableValue): string | number | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

export function compareComparableValues(
  a: ComparableValue,
  b: ComparableValue,
  direction: SortDirection,
): number {
  const av = normalizeComparable(a);
  const bv = normalizeComparable(b);
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;

  let result = 0;
  if (typeof av === "number" && typeof bv === "number") {
    result = av - bv;
  } else {
    result = String(av).localeCompare(String(bv), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }
  return direction === "asc" ? result : -result;
}

/**
 * Client-side sort + pagination for in-memory table rows.
 * Pass already-filtered items; call `setPage(1)` when filters change.
 */
export function useClientTable<T>({
  items,
  pageSize = DEFAULT_CLIENT_PAGE_SIZE,
  getSortValue,
  defaultSort,
  resetKey,
}: {
  items: readonly T[];
  pageSize?: number;
  getSortValue?: (item: T, key: string) => ComparableValue;
  defaultSort?: ClientSortState | null;
  /** When this value changes, page resets to 1 (e.g. filter string). */
  resetKey?: string | number;
}) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ClientSortState | null>(defaultSort ?? null);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize, items.length]);

  const toggleSort = useCallback((key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
    setPage(1);
  }, []);

  const sorted = useMemo(() => {
    if (!sort || !getSortValue) return items;
    const copy = [...items];
    copy.sort((a, b) =>
      compareComparableValues(
        getSortValue(a, sort.key),
        getSortValue(b, sort.key),
        sort.direction,
      ),
    );
    return copy;
  }, [items, sort, getSortValue]);

  const total = sorted.length;
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
  const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = sorted.slice(start, start + pageSize);

  return {
    pageItems,
    page: safePage,
    setPage,
    totalPages,
    total,
    pageSize,
    sortKey: sort?.key ?? null,
    sortDirection: sort?.direction ?? "asc",
    toggleSort,
  };
}
