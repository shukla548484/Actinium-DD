"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJsonWithTimeout } from "@/lib/utils/fetch-with-timeout";
import { getWarmCache, setWarmCache } from "@/lib/performance/route-warm-cache";

export type PurchaseOrderListRecord = Record<string, unknown>;

type PurchaseOrdersListApiResponse = {
  purchaseOrders?: PurchaseOrderListRecord[];
};

function warmPoListKey(vesselId: string): string {
  return `warm:po-list:${vesselId}`;
}

export function purchaseOrdersListByVesselQueryKey(vesselId: string) {
  return ["purchase-orders-list-api", vesselId] as const;
}

export async function fetchPurchaseOrdersList(
  vesselId: string
): Promise<PurchaseOrderListRecord[]> {
  const data = await fetchJsonWithTimeout<PurchaseOrdersListApiResponse>(
    `/api/purchase-orders/list?vesselId=${encodeURIComponent(vesselId)}`,
    { timeout: 15000, credentials: "include" }
  );
  const orders = data.purchaseOrders ?? [];
  setWarmCache(warmPoListKey(vesselId), data);
  return orders;
}

/**
 * Full purchase order list for a vessel (`/api/purchase-orders/list`).
 * Used by invoices and delivery-note status pages.
 */
export function usePurchaseOrdersListByVessel(vesselId: string | null, enabled = true) {
  const queryEnabled = enabled && !!vesselId;

  return useQuery({
    queryKey: vesselId ? purchaseOrdersListByVesselQueryKey(vesselId) : ["purchase-orders-list-api", "disabled"],
    enabled: queryEnabled,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      if (!vesselId) return [];

      const warmed = getWarmCache<PurchaseOrdersListApiResponse>(warmPoListKey(vesselId));
      if (warmed?.purchaseOrders) {
        void fetchPurchaseOrdersList(vesselId).catch(() => {});
        return warmed.purchaseOrders;
      }

      return fetchPurchaseOrdersList(vesselId);
    },
  });
}

export function confirmedQuotesQueryKey(vesselId: string) {
  return ["purchase-confirmed-quotes", vesselId] as const;
}

async function fetchConfirmedQuotes(vesselId: string): Promise<Record<string, unknown>[]> {
  const data = await fetchJsonWithTimeout<{ confirmedQuotes?: Record<string, unknown>[] }>(
    `/api/purchase-orders/confirmed-quotes?vesselId=${encodeURIComponent(vesselId)}`,
    { timeout: 15000, credentials: "include" }
  );
  return data.confirmedQuotes ?? [];
}

/** Approved quotes awaiting PO issuance for a vessel. */
export function useConfirmedQuotes(vesselId: string | null, enabled = true) {
  const queryEnabled = enabled && !!vesselId;

  return useQuery({
    queryKey: vesselId ? confirmedQuotesQueryKey(vesselId) : ["purchase-confirmed-quotes", "disabled"],
    enabled: queryEnabled,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
    placeholderData: (prev) => prev,
    queryFn: () => fetchConfirmedQuotes(vesselId!),
  });
}
