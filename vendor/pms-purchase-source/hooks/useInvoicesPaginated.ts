"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJsonWithTimeout } from "@/lib/utils/fetch-with-timeout";
import { getWarmCache, setWarmCache } from "@/lib/performance/route-warm-cache";
import {
  buildInvoicesListParams,
  invoicesListQueryKey,
  isDefaultWarmInvoicesFilters,
  warmInvoicesListKey,
  type InvoicesListFilters,
  type PaginatedInvoices,
} from "@/lib/invoices-list-query";

const EMPTY: PaginatedInvoices = {
  invoices: [],
  total: 0,
  page: 1,
  limit: 25,
  totalPages: 0,
};

type InvoicesApiResponse = {
  invoices?: Record<string, unknown>[];
  pagination?: { total?: number; totalPages?: number; page?: number; limit?: number };
};

async function fetchInvoicesList(filters: InvoicesListFilters): Promise<PaginatedInvoices> {
  const params = buildInvoicesListParams(filters);
  const data = await fetchJsonWithTimeout<InvoicesApiResponse>(
    `/api/invoices?${params}`,
    { timeout: 15000, credentials: "include" }
  );

  const result: PaginatedInvoices = {
    invoices: data.invoices ?? [],
    total: data.pagination?.total ?? data.invoices?.length ?? 0,
    page: data.pagination?.page ?? filters.page,
    limit: data.pagination?.limit ?? filters.limit,
    totalPages: data.pagination?.totalPages ?? 0,
  };

  if (isDefaultWarmInvoicesFilters(filters)) {
    setWarmCache(warmInvoicesListKey(filters.vesselId), data);
  }

  return result;
}

/** Paginated invoices list with React Query caching. */
export function useInvoicesPaginated(filters: InvoicesListFilters | null, enabled = true) {
  const listEnabled = enabled && !!filters?.vesselId;

  return useQuery({
    queryKey: filters ? invoicesListQueryKey(filters) : ["invoices-list", "disabled"],
    enabled: listEnabled,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
    queryFn: async () => {
      if (!filters) return EMPTY;

      if (isDefaultWarmInvoicesFilters(filters)) {
        const warmed = getWarmCache<InvoicesApiResponse>(warmInvoicesListKey(filters.vesselId));
        if (warmed?.invoices && warmed.pagination?.page === filters.page && warmed.pagination?.limit === filters.limit) {
          void fetchInvoicesList(filters).catch(() => {});
          return {
            invoices: warmed.invoices ?? [],
            total: warmed.pagination?.total ?? warmed.invoices?.length ?? 0,
            page: warmed.pagination?.page ?? 1,
            limit: warmed.pagination?.limit ?? filters.limit,
            totalPages: warmed.pagination?.totalPages ?? 0,
          };
        }
      }

      return fetchInvoicesList(filters);
    },
  });
}
