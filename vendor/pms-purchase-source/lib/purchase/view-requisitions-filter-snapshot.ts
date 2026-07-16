import type { TablePageSize } from "@/components/ui/table-pagination";

export const VIEW_REQUISITIONS_FILTERS_SESSION_KEY =
  "view-requisitions-filters-snapshot";

export const VIEW_REQUISITIONS_RESTORE_QUERY = "restoreFilters";

export type ViewRequisitionsFiltersSnapshot = {
  selectedVessel: string;
  selectedVessels: string[];
  page: number;
  limit: TablePageSize;
  searchTerm: string;
  reqNumberFilter: string;
  headerFilter: string;
  selectedStatuses: string[];
  selectedTypes: string[];
  dateFrom: string | null;
  dateTo: string | null;
  hasDeclinedSuppliers: boolean;
  priorityFilter: string;
  reasonForRequisitionFilter: string;
  poIssuedFilter: string;
  showFilters: boolean;
  viewMode: "list" | "grid";
};

export function saveViewRequisitionsFiltersSnapshot(
  snapshot: ViewRequisitionsFiltersSnapshot
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      VIEW_REQUISITIONS_FILTERS_SESSION_KEY,
      JSON.stringify(snapshot)
    );
  } catch (error) {
    console.error("Failed to save view-requisitions filter snapshot:", error);
  }
}

export function loadViewRequisitionsFiltersSnapshot():
  | ViewRequisitionsFiltersSnapshot
  | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(VIEW_REQUISITIONS_FILTERS_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ViewRequisitionsFiltersSnapshot;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (error) {
    console.error("Failed to load view-requisitions filter snapshot:", error);
    return null;
  }
}

export function clearViewRequisitionsFiltersSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(VIEW_REQUISITIONS_FILTERS_SESSION_KEY);
  } catch {
    // ignore
  }
}

export function buildViewRequisitionsRestorePath(): string {
  return `/purchase/view-requisitions?${VIEW_REQUISITIONS_RESTORE_QUERY}=1`;
}

export function buildMasterApprovalHref(returnToPath: string): string {
  return `/purchase/master-approval?returnTo=${encodeURIComponent(returnToPath)}`;
}
