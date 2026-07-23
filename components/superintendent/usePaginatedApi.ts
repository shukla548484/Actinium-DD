"use client";

import { useCallback, useEffect, useState } from "react";

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export function usePaginatedApi<T>(
  baseUrl: string,
  params: Record<string, string | undefined>,
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const paramKey = JSON.stringify(params);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ page: String(page), limit: "20" });
    for (const [k, v] of Object.entries(params)) {
      if (v && v !== "all") qs.set(k, v);
    }
    try {
      const res = await fetch(`${baseUrl}?${qs}`);
      if (!res.ok) {
        setItems([]);
        setError("Failed to load data");
        return;
      }
      const data = (await res.json()) as PaginatedResponse<T> & {
        completedCount?: number;
      };
      setItems(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
      setCompletedCount(data.completedCount ?? 0);
    } catch {
      setError("Network error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, page, paramKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    items,
    loading,
    page,
    setPage,
    totalPages,
    total,
    completedCount,
    error,
    reload,
  };
}

export async function deleteResource(apiPath: string): Promise<boolean> {
  const res = await fetch(apiPath, { method: "DELETE" });
  return res.ok;
}
