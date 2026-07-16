export const PURCHASE_ORDERS_HUB_TABS = {
  all: "all",
  view: "view",
  create: "create",
  freightPending: "freight-pending",
  freightApprovals: "freight-approvals",
  variance: "variance",
  budgetChange: "budget-change",
} as const;

export type PurchaseOrdersHubTab =
  (typeof PURCHASE_ORDERS_HUB_TABS)[keyof typeof PURCHASE_ORDERS_HUB_TABS];

export const PURCHASE_ORDERS_HUB_TAB_LABELS: Record<PurchaseOrdersHubTab, string> = {
  all: "Purchase Orders (All)",
  view: "View Purchase Orders",
  create: "Create Purchase Order",
  "freight-pending": "Freight Pending",
  "freight-approvals": "Freight PO Approvals",
  variance: "PO Variance",
  "budget-change": "PO Budget Change",
};

export const PURCHASE_ORDERS_HUB_PATH = "/purchase/purchase-orders";

export function isPurchaseOrdersHubTab(value: string | null | undefined): value is PurchaseOrdersHubTab {
  return (
    value === PURCHASE_ORDERS_HUB_TABS.all ||
    value === PURCHASE_ORDERS_HUB_TABS.view ||
    value === PURCHASE_ORDERS_HUB_TABS.create ||
    value === PURCHASE_ORDERS_HUB_TABS.freightPending ||
    value === PURCHASE_ORDERS_HUB_TABS.freightApprovals ||
    value === PURCHASE_ORDERS_HUB_TABS.variance ||
    value === PURCHASE_ORDERS_HUB_TABS.budgetChange
  );
}

export function purchaseOrdersHubTabFromLegacyPath(pathname: string): PurchaseOrdersHubTab | null {
  if (pathname === "/purchase/create-po") return PURCHASE_ORDERS_HUB_TABS.create;
  if (pathname === "/purchase/view-pos") return PURCHASE_ORDERS_HUB_TABS.view;
  if (pathname === "/purchase/freight/pending") return PURCHASE_ORDERS_HUB_TABS.freightPending;
  if (pathname === "/purchase/freight-approvals") return PURCHASE_ORDERS_HUB_TABS.freightApprovals;
  if (pathname === "/purchase/po-variance") return PURCHASE_ORDERS_HUB_TABS.variance;
  if (pathname === "/purchase/po-budget-change") return PURCHASE_ORDERS_HUB_TABS.budgetChange;
  if (pathname === PURCHASE_ORDERS_HUB_PATH) return PURCHASE_ORDERS_HUB_TABS.all;
  return null;
}

export type PurchaseOrdersHubFilters = {
  vesselIds: string[];
  poNumber: string;
  requisitionNumber: string;
  vendorIds: string[];
  startDate?: string;
  endDate?: string;
  workflowStatus: string;
  legacyStatus: string;
  poType: string;
  searchKeyword: string;
};

export function parsePurchaseOrdersHubFilters(
  searchParams: URLSearchParams
): PurchaseOrdersHubFilters {
  const vesselParam = searchParams.get("vesselId");
  const vendorParam = searchParams.get("vendorId");
  return {
    vesselIds: vesselParam ? vesselParam.split(",").filter(Boolean) : [],
    poNumber: searchParams.get("poNumber") ?? "",
    requisitionNumber: searchParams.get("requisitionNumber") ?? "",
    vendorIds: vendorParam ? vendorParam.split(",").filter(Boolean) : [],
    startDate: searchParams.get("startDate") ?? undefined,
    endDate: searchParams.get("endDate") ?? undefined,
    workflowStatus: searchParams.get("workflowStatus") ?? "all",
    legacyStatus: searchParams.get("legacyStatus") ?? "all",
    poType: searchParams.get("poType") ?? "all",
    searchKeyword: searchParams.get("q") ?? "",
  };
}

export function buildPurchaseOrdersHubQuery(
  tab: PurchaseOrdersHubTab,
  filters: PurchaseOrdersHubFilters,
  extra?: Record<string, string>
): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (filters.vesselIds.length > 0) params.set("vesselId", filters.vesselIds.join(","));
  if (filters.poNumber) params.set("poNumber", filters.poNumber);
  if (filters.requisitionNumber) params.set("requisitionNumber", filters.requisitionNumber);
  if (filters.vendorIds.length > 0) params.set("vendorId", filters.vendorIds.join(","));
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.workflowStatus !== "all") params.set("workflowStatus", filters.workflowStatus);
  if (filters.legacyStatus !== "all") params.set("legacyStatus", filters.legacyStatus);
  if (filters.poType !== "all") params.set("poType", filters.poType);
  if (filters.searchKeyword) params.set("q", filters.searchKeyword);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  return params.toString();
}

/** Single vessel id for tabs that only support one vessel filter. */
export function hubPrimaryVesselId(filters: PurchaseOrdersHubFilters): string {
  return filters.vesselIds.length === 1 ? filters.vesselIds[0]! : "all";
}
