import {
  PURCHASE_ORDERS_HUB_PATH,
  PURCHASE_ORDERS_HUB_TABS,
  type PurchaseOrdersHubTab,
} from "@/lib/purchase/purchase-orders-hub";

/** Build redirect URL for legacy PO pages → unified hub tab. */
export function purchaseOrdersHubRedirectUrl(
  tab: PurchaseOrdersHubTab,
  searchParams?: Record<string, string | string[] | undefined>
): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === "tab" || value === undefined) continue;
      if (Array.isArray(value)) {
        if (value[0]) params.set(key, value.join(","));
      } else if (value) {
        params.set(key, value);
      }
    }
  }
  return `${PURCHASE_ORDERS_HUB_PATH}?${params.toString()}`;
}

export const LEGACY_PO_HUB_TAB: Record<string, PurchaseOrdersHubTab> = {
  "/purchase/create-po": PURCHASE_ORDERS_HUB_TABS.create,
  "/purchase/view-pos": PURCHASE_ORDERS_HUB_TABS.view,
  "/purchase/freight/pending": PURCHASE_ORDERS_HUB_TABS.freightPending,
  "/purchase/freight-approvals": PURCHASE_ORDERS_HUB_TABS.freightApprovals,
  "/purchase/po-variance": PURCHASE_ORDERS_HUB_TABS.variance,
  "/purchase/po-budget-change": PURCHASE_ORDERS_HUB_TABS.budgetChange,
};
