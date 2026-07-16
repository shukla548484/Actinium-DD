"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  type PurchaseOrdersHubFilters,
  type PurchaseOrdersHubTab,
  isPurchaseOrdersHubTab,
  parsePurchaseOrdersHubFilters,
  PURCHASE_ORDERS_HUB_TABS,
} from "@/lib/purchase/purchase-orders-hub";

type PurchaseOrdersHubContextValue = {
  tab: PurchaseOrdersHubTab;
  filters: PurchaseOrdersHubFilters;
  embedded: boolean;
};

const PurchaseOrdersHubContext = React.createContext<PurchaseOrdersHubContextValue | null>(
  null
);

export function PurchaseOrdersHubProvider({
  children,
  tab,
}: {
  children: React.ReactNode;
  tab: PurchaseOrdersHubTab;
}) {
  const searchParams = useSearchParams();
  const filters = React.useMemo(
    () => parsePurchaseOrdersHubFilters(searchParams),
    [searchParams]
  );

  const value = React.useMemo(
    () => ({
      tab,
      filters,
      embedded: true,
    }),
    [tab, filters]
  );

  return (
    <PurchaseOrdersHubContext.Provider value={value}>
      {children}
    </PurchaseOrdersHubContext.Provider>
  );
}

export function usePurchaseOrdersHub(): PurchaseOrdersHubContextValue {
  const ctx = React.useContext(PurchaseOrdersHubContext);
  if (!ctx) {
    throw new Error("usePurchaseOrdersHub must be used within PurchaseOrdersHubProvider");
  }
  return ctx;
}

export function usePurchaseOrdersHubOptional(): PurchaseOrdersHubContextValue | null {
  return React.useContext(PurchaseOrdersHubContext);
}

export function usePurchaseOrdersHubTab(): PurchaseOrdersHubTab {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  if (isPurchaseOrdersHubTab(tabParam)) return tabParam;
  return PURCHASE_ORDERS_HUB_TABS.all;
}
