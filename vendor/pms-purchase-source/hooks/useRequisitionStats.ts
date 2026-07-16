"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJsonWithTimeout } from "@/lib/utils/fetch-with-timeout";
import { getWarmCache, setWarmCache } from "@/lib/performance/route-warm-cache";
import {
  requisitionsStatsQueryKey,
  warmRequisitionsStatsKey,
  type RequisitionStatsSummary,
} from "@/lib/requisitions-list-query";

const EMPTY_STATS: RequisitionStatsSummary = {
  total: 0,
  drafts: 0,
  created: 0,
  approved: 0,
  inProcess: 0,
  completed: 0,
  pendingApproval: 0,
};

async function fetchStats(vesselIds: string[]): Promise<RequisitionStatsSummary> {
  const params = new URLSearchParams({
    vesselId: vesselIds.slice(0, 50).join(","),
  });
  const data = await fetchJsonWithTimeout<RequisitionStatsSummary>(
    `/api/requisitions/stats?${params}`,
    { timeout: 10000, credentials: "include" }
  );

  const stats = {
    total: data.total ?? 0,
    drafts: data.drafts ?? 0,
    created: data.created ?? 0,
    approved: data.approved ?? 0,
    inProcess: data.inProcess ?? 0,
    completed: data.completed ?? 0,
    pendingApproval: data.pendingApproval ?? 0,
  };

  if (vesselIds.length === 1) {
    setWarmCache(warmRequisitionsStatsKey(vesselIds[0]), stats);
  }

  return stats;
}

/**
 * Requisition status counts for the view-requisitions header cards — always from API.
 */
export function useRequisitionStats(vesselIds: string[], enabled = true) {
  return useQuery({
    queryKey: requisitionsStatsQueryKey(vesselIds),
    enabled: enabled && vesselIds.length > 0,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 1,
    queryFn: async () => {
      try {
        if (vesselIds.length === 1) {
          const warmed = getWarmCache<RequisitionStatsSummary>(
            warmRequisitionsStatsKey(vesselIds[0])
          );
          if (warmed) {
            void fetchStats(vesselIds).catch(() => undefined);
            return warmed;
          }
        }
        return await fetchStats(vesselIds);
      } catch {
        return EMPTY_STATS;
      }
    },
  });
}

export type { RequisitionStatsSummary };
