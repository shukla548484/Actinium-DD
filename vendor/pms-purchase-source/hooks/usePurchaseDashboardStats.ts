"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJsonWithTimeout } from "@/lib/utils/fetch-with-timeout";
import { getWarmCache, setWarmCache } from "@/lib/performance/route-warm-cache";

export type PurchaseDashboardStats = {
  totalRequisitions: number;
  pendingRequisitions: number;
  approvedRequisitions: number;
  totalQuotes: number;
  totalPurchaseOrders: number;
  totalInvoices: number;
  totalAmount: number;
  pendingAmount: number;
};

const EMPTY_STATS: PurchaseDashboardStats = {
  totalRequisitions: 0,
  pendingRequisitions: 0,
  approvedRequisitions: 0,
  totalQuotes: 0,
  totalPurchaseOrders: 0,
  totalInvoices: 0,
  totalAmount: 0,
  pendingAmount: 0,
};

async function fetchStats(vesselId: string | "all"): Promise<PurchaseDashboardStats> {
  const params = new URLSearchParams();
  if (vesselId !== "all") params.append("vesselId", vesselId);

  const data = await fetchJsonWithTimeout<{ stats: PurchaseDashboardStats }>(
    `/api/purchase/dashboard/stats?${params}`,
    { timeout: 15000, credentials: "include" }
  );

  const stats = data.stats ?? EMPTY_STATS;
  if (vesselId !== "all") {
    setWarmCache(`warm:purchase-dashboard:${vesselId}`, { stats });
  }
  return stats;
}

/**
 * Purchase module dashboard KPIs with warm-cache hydration per vessel.
 */
export function usePurchaseDashboardStats(vesselId: string | "all", enabled = true) {
  return useQuery({
    queryKey: ["purchase-dashboard-stats", vesselId],
    enabled,
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
    queryFn: async () => {
      if (vesselId !== "all") {
        const warmed = getWarmCache<{ stats: PurchaseDashboardStats }>(
          `warm:purchase-dashboard:${vesselId}`
        );
        if (warmed?.stats) {
          void fetchStats(vesselId).catch(() => {});
          return warmed.stats;
        }
      }
      try {
        return await fetchStats(vesselId);
      } catch {
        return EMPTY_STATS;
      }
    },
  });
}
