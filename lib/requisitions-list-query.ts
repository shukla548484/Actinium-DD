import type { PaginatedRequisitions } from "@/lib/types/requisition";
import { DEFAULT_TABLE_PAGE_SIZE } from "@/lib/table-page-size";

export type RequisitionsListFilters = {
  vesselIds: string[];
  page: number;
  limit: number;
  draftsOnly?: boolean;
  searchTerm?: string;
  reqNumberFilter?: string;
  headerFilter?: string;
  selectedTypes?: string[];
  selectedStatuses?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  hasDeclinedSuppliers?: boolean;
  priorityFilter?: string;
  reasonForRequisitionFilter?: string;
  /** all | yes (QUOTE_CONFIRMED_PO_SENT) | no */
  poIssuedFilter?: string;
};

export type RequisitionStatsSummary = {
  total: number;
  drafts: number;
  created: number;
  approved: number;
  inProcess: number;
  completed: number;
  pendingApproval: number;
};

export function buildRequisitionsListParams(filters: RequisitionsListFilters): URLSearchParams {
  const params = new URLSearchParams({
    page: filters.page.toString(),
    limit: filters.limit.toString(),
  });

  if (filters.vesselIds.length > 0) {
    params.set("vesselId", filters.vesselIds.slice(0, 50).join(","));
  }
  if (filters.searchTerm) params.set("search", filters.searchTerm);
  if (filters.reqNumberFilter) params.set("requisitionNumber", filters.reqNumberFilter);
  if (filters.headerFilter) params.set("heading", filters.headerFilter);
  if (filters.selectedTypes?.length) params.set("requisitionType", filters.selectedTypes.join(","));
  if (filters.selectedStatuses?.length) params.set("status", filters.selectedStatuses.join(","));
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom.toISOString().split("T")[0]);
  if (filters.dateTo) params.set("dateTo", filters.dateTo.toISOString().split("T")[0]);
  if (filters.hasDeclinedSuppliers) params.set("hasDeclinedSuppliers", "true");
  if (filters.priorityFilter && filters.priorityFilter !== "all") {
    params.set("priority", filters.priorityFilter);
  }
  if (filters.reasonForRequisitionFilter && filters.reasonForRequisitionFilter !== "all") {
    params.set("reasonForRequisition", filters.reasonForRequisitionFilter);
  }
  if (filters.poIssuedFilter && filters.poIssuedFilter !== "all") {
    params.set("poIssued", filters.poIssuedFilter);
  }
  if (filters.draftsOnly) params.set("draftsOnly", "true");

  return params;
}

export function requisitionsListQueryKey(filters: RequisitionsListFilters) {
  return [
    "requisitions-list",
    filters.vesselIds.join(","),
    filters.page,
    filters.limit,
    filters.searchTerm ?? "",
    filters.reqNumberFilter ?? "",
    filters.headerFilter ?? "",
    (filters.selectedTypes ?? []).join(","),
    (filters.selectedStatuses ?? []).join(","),
    filters.dateFrom?.toISOString().split("T")[0] ?? "",
    filters.dateTo?.toISOString().split("T")[0] ?? "",
    filters.hasDeclinedSuppliers ? "1" : "0",
    filters.priorityFilter ?? "all",
    filters.reasonForRequisitionFilter ?? "all",
    filters.poIssuedFilter ?? "all",
    filters.draftsOnly ? "1" : "0",
  ] as const;
}

export function requisitionsStatsQueryKey(vesselIds: string[]) {
  return ["requisitions-stats", vesselIds.slice(0, 50).join(",")] as const;
}

export function isDefaultWarmListFilters(filters: RequisitionsListFilters): boolean {
  return (
    filters.page === 1 &&
    filters.limit === DEFAULT_TABLE_PAGE_SIZE &&
    !filters.searchTerm &&
    !filters.reqNumberFilter &&
    !filters.headerFilter &&
    !(filters.selectedTypes?.length) &&
    !(filters.selectedStatuses?.length) &&
    !filters.dateFrom &&
    !filters.dateTo &&
    !filters.hasDeclinedSuppliers &&
    (!filters.priorityFilter || filters.priorityFilter === "all") &&
    (!filters.reasonForRequisitionFilter || filters.reasonForRequisitionFilter === "all") &&
    (!filters.poIssuedFilter || filters.poIssuedFilter === "all") &&
    filters.vesselIds.length === 1
  );
}

export function warmRequisitionsListKey(vesselId: string): string {
  return `warm:requisitions:${vesselId}`;
}

export function warmRequisitionsStatsKey(vesselId: string): string {
  return `warm:requisitions-stats:${vesselId}`;
}

export type { PaginatedRequisitions };
