import type { QueryClient } from "@tanstack/react-query";
import { clearWarmCache } from "@/lib/performance/route-warm-cache";

const REQUISITIONS_QUERY_ROOTS = new Set(["requisitions-list", "requisitions-stats"]);

/** Requisitions list/stats must always hit the API — never persist to localStorage. */
export function isRequisitionsListQueryKey(queryKey: readonly unknown[]): boolean {
  return typeof queryKey[0] === "string" && REQUISITIONS_QUERY_ROOTS.has(queryKey[0]);
}

/** Drop route warm-cache and mark requisitions React Query entries stale (refetch on next read). */
export async function invalidateRequisitionsListQueries(
  queryClient: QueryClient
): Promise<void> {
  clearWarmCache();
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["requisitions-list"] }),
    queryClient.invalidateQueries({ queryKey: ["requisitions-stats"] }),
  ]);
}
