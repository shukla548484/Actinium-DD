export type InvoicesListFilters = {
  vesselId: string;
  page: number;
  limit: number;
  search?: string;
};

export type PaginatedInvoices = {
  invoices: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export function buildInvoicesListParams(filters: InvoicesListFilters): URLSearchParams {
  const params = new URLSearchParams({
    vesselId: filters.vesselId,
    page: String(filters.page),
    limit: String(filters.limit),
  });
  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }
  return params;
}

export function invoicesListQueryKey(filters: InvoicesListFilters) {
  return [
    "invoices-list",
    filters.vesselId,
    filters.page,
    filters.limit,
    filters.search?.trim() ?? "",
  ] as const;
}

export function warmInvoicesListKey(vesselId: string): string {
  return `warm:invoices-list:${vesselId}`;
}

export function isDefaultWarmInvoicesFilters(filters: InvoicesListFilters): boolean {
  return filters.page === 1 && !filters.search?.trim();
}
