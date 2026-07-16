"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJsonWithTimeout } from "@/lib/utils/fetch-with-timeout";
import { getWarmCache, setWarmCache } from "@/lib/performance/route-warm-cache";
import {
  buildRequisitionsListParams,
  isDefaultWarmListFilters,
  requisitionsListQueryKey,
  warmRequisitionsListKey,
  type PaginatedRequisitions,
  type RequisitionsListFilters,
} from "@/lib/requisitions-list-query";
import { DEFAULT_TABLE_PAGE_SIZE } from "@/lib/table-page-size";

const EMPTY: PaginatedRequisitions = {
  requisitions: [],
  total: 0,
  page: 1,
  limit: DEFAULT_TABLE_PAGE_SIZE,
  totalPages: 0,
};

async function fetchRequisitionsList(filters: RequisitionsListFilters): Promise<PaginatedRequisitions> {
  const params = buildRequisitionsListParams(filters);
  const data = await fetchJsonWithTimeout<PaginatedRequisitions>(
    `/api/requisitions?${params}`,
    { timeout: 15000, credentials: "include" }
  );

  const result = {
    requisitions: data.requisitions ?? [],
    total: data.total ?? 0,
    page: data.page ?? filters.page,
    limit: data.limit ?? filters.limit,
    totalPages: data.totalPages ?? 0,
  };

  if (isDefaultWarmListFilters(filters) && filters.vesselIds.length === 1) {
    setWarmCache(warmRequisitionsListKey(filters.vesselIds[0]), result);
  }

  return result;
}

/**
 * Paginated requisitions list — always loads from the API (no warm-cache or stale hydration).
 */
export function useRequisitionsPaginated(
  filters: RequisitionsListFilters | null,
  enabled = true
) {
  const listEnabled =
    enabled && !!filters && (filters.draftsOnly === true || filters.vesselIds.length > 0);

  return useQuery({
    queryKey: filters ? requisitionsListQueryKey(filters) : ["requisitions-list", "disabled"],
    enabled: listEnabled,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 1,
    queryFn: async () => {
      if (!filters) return EMPTY;

      if (isDefaultWarmListFilters(filters) && filters.vesselIds.length === 1) {
        const warmed = getWarmCache<PaginatedRequisitions>(
          warmRequisitionsListKey(filters.vesselIds[0])
        );
        if (warmed?.requisitions) {
          void fetchRequisitionsList(filters).catch(() => undefined);
          return warmed;
        }
      }

      return fetchRequisitionsList(filters);
    },
  });
}
