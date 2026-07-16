"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJsonWithTimeout } from "@/lib/utils/fetch-with-timeout";
import { getWarmCache, setWarmCache } from "@/lib/performance/route-warm-cache";
import {
  buildPurchaseOrdersListParams,
  isDefaultWarmPurchaseOrdersFilters,
  purchaseOrdersListQueryKey,
  warmPurchaseOrdersListKey,
  type PaginatedPurchaseOrders,
  type PurchaseOrdersListFilters,
} from "@/lib/purchase-orders-list-query";

const EMPTY: PaginatedPurchaseOrders = {
  purchaseOrders: [],
  count: 0,
  page: 1,
  accessLevel: 0,
  totals: { totalUsd: 0 },
};

type ViewPosApiResponse = {
  purchaseOrders?: PaginatedPurchaseOrders["purchaseOrders"];
  count?: number;
  page?: number;
  totals?: { totalUsd?: number };
  currentUser?: { designationAccessLevel?: number };
  error?: string;
};

async function fetchPurchaseOrdersList(
  filters: PurchaseOrdersListFilters
): Promise<PaginatedPurchaseOrders> {
  const params = buildPurchaseOrdersListParams(filters);
  const data = await fetchJsonWithTimeout<ViewPosApiResponse>(
    `/api/purchase-orders/view-pos?${params}`,
    { timeout: 15000, credentials: "include" }
  );

  const result: PaginatedPurchaseOrders = {
    purchaseOrders: data.purchaseOrders ?? [],
    count: data.count ?? 0,
    page: data.page ?? filters.page,
    accessLevel: data.currentUser?.designationAccessLevel ?? 0,
    totals: { totalUsd: Number(data.totals?.totalUsd) || 0 },
  };

  if (
    isDefaultWarmPurchaseOrdersFilters(filters) &&
    filters.vesselId &&
    filters.vesselId !== "all"
  ) {
    setWarmCache(warmPurchaseOrdersListKey(filters.vesselId), data);
  }

  return result;
}

/**
 * Paginated purchase orders list for view-pos with React Query caching.
 */
export function usePurchaseOrdersPaginated(
  filters: PurchaseOrdersListFilters | null,
  enabled = true
) {
  return useQuery({
    queryKey: filters ? purchaseOrdersListQueryKey(filters) : ["purchase-orders-list", "disabled"],
    enabled: enabled && !!filters,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
    queryFn: async () => {
      if (!filters) return EMPTY;

      if (isDefaultWarmPurchaseOrdersFilters(filters) && filters.vesselId) {
        const warmed = getWarmCache<ViewPosApiResponse>(
          warmPurchaseOrdersListKey(filters.vesselId)
        );
        if (warmed?.purchaseOrders) {
          void fetchPurchaseOrdersList(filters).catch(() => {});
          return {
            purchaseOrders: warmed.purchaseOrders ?? [],
            count: warmed.count ?? 0,
            page: warmed.page ?? 1,
            accessLevel: warmed.currentUser?.designationAccessLevel ?? 0,
            totals: { totalUsd: Number(warmed.totals?.totalUsd) || 0 },
          };
        }
      }

      return fetchPurchaseOrdersList(filters);
    },
  });
}
