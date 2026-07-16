"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJsonWithTimeout } from "@/lib/utils/fetch-with-timeout";

export function invoicesByVesselQueryKey(vesselId: string) {
  return ["invoices-by-vessel", vesselId] as const;
}

export async function fetchInvoicesByVessel(vesselId: string) {
  const params = new URLSearchParams({
    vesselId,
    page: "1",
    limit: "500",
  });
  const data = await fetchJsonWithTimeout<{
    invoices?: Record<string, unknown>[];
  }>(`/api/invoices?${params.toString()}`, {
    timeout: 20000,
    credentials: "include",
  });
  return data.invoices ?? [];
}

/** All invoices for a vessel (up to 500) — used to merge with PO list on invoice workbench. */
export function useInvoicesByVessel(vesselId: string | null, enabled = true) {
  return useQuery({
    queryKey: vesselId ? invoicesByVesselQueryKey(vesselId) : ["invoices-by-vessel", "disabled"],
    enabled: enabled && Boolean(vesselId),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    queryFn: () => fetchInvoicesByVessel(vesselId!),
  });
}
