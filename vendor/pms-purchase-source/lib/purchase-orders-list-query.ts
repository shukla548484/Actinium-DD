import { format } from "date-fns";

export type PurchaseOrderListItem = {
  id: string;
  poNumber: string;
  dateOfIssue: string | null;
  totalAmount: number | null;
  currency: string;
  status: string;
  [key: string]: unknown;
};

export type PurchaseOrdersListFilters = {
  page: number;
  limit: number;
  statusFilter?: string;
  workflowStatusFilter?: string;
  poTypeFilter?: string;
  vesselId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  searchKeyword?: string;
};

export type PaginatedPurchaseOrders = {
  purchaseOrders: PurchaseOrderListItem[];
  count: number;
  page: number;
  accessLevel: number;
  totals?: { totalUsd: number };
};

export function buildPurchaseOrdersListParams(filters: PurchaseOrdersListFilters): URLSearchParams {
  const params = new URLSearchParams({
    page: String(filters.page),
    limit: String(filters.limit),
  });

  const status = filters.statusFilter ?? "all";
  const workflowStatus = filters.workflowStatusFilter ?? "all";
  const poType = filters.poTypeFilter ?? "all";
  const vesselId = filters.vesselId ?? "all";

  if (status !== "all") params.set("status", status);
  if (workflowStatus !== "all") params.set("workflowStatus", workflowStatus);
  if (poType !== "all") params.set("poType", poType);
  if (vesselId !== "all") params.set("vesselId", vesselId);
  if (filters.dateFrom) {
    params.set("dateFrom", format(filters.dateFrom, "yyyy-MM-dd"));
  }
  if (filters.dateTo) {
    params.set("dateTo", format(filters.dateTo, "yyyy-MM-dd"));
  }
  if (filters.searchKeyword?.trim()) {
    params.set("search", filters.searchKeyword.trim());
  }

  return params;
}

export function purchaseOrdersListQueryKey(filters: PurchaseOrdersListFilters) {
  return [
    "purchase-orders-list",
    filters.page,
    filters.limit,
    filters.statusFilter ?? "all",
    filters.workflowStatusFilter ?? "all",
    filters.poTypeFilter ?? "all",
    filters.vesselId ?? "all",
    filters.dateFrom ? format(filters.dateFrom, "yyyy-MM-dd") : "",
    filters.dateTo ? format(filters.dateTo, "yyyy-MM-dd") : "",
    filters.searchKeyword?.trim() ?? "",
  ] as const;
}

export function warmPurchaseOrdersListKey(vesselId: string): string {
  return `warm:purchase-orders:${vesselId}`;
}

export function isDefaultWarmPurchaseOrdersFilters(filters: PurchaseOrdersListFilters): boolean {
  return (
    filters.page === 1 &&
    (filters.statusFilter ?? "all") === "all" &&
    (filters.vesselId ?? "all") !== "all" &&
    !filters.dateFrom &&
    !filters.dateTo &&
    !filters.searchKeyword?.trim()
  );
}
