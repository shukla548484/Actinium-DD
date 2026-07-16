"use client";

import { Suspense, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ActiniumLoader from "@/components/ActiniumLoader";
import { PurchaseOrdersHubFilter } from "@/components/purchase/purchase-orders-hub-filter";
import {
  PurchaseOrdersHubProvider,
  usePurchaseOrdersHubTab,
} from "@/components/purchase/purchase-orders-hub-context";
import {
  buildPurchaseOrdersHubQuery,
  isPurchaseOrdersHubTab,
  parsePurchaseOrdersHubFilters,
  PURCHASE_ORDERS_HUB_TABS,
  PURCHASE_ORDERS_HUB_TAB_LABELS,
  type PurchaseOrdersHubTab,
} from "@/lib/purchase/purchase-orders-hub";

const loading = (text: string) => (
  <div className="flex min-h-[40vh] w-full flex-col items-center justify-center py-12">
    <ActiniumLoader size="lg" text={text} showDots />
  </div>
);

const PurchaseOrdersAllTab = dynamic(
  () =>
    import("@/components/purchase/purchase-orders-page-client").then((m) => ({
      default: m.PurchaseOrdersAllTab,
    })),
  { ssr: false, loading: () => loading("Loading purchase orders…") }
);

const ViewPosContent = dynamic(
  () =>
    import("@/app/purchase/view-pos/ViewPosContent").then((m) => ({
      default: m.ViewPosContent,
    })),
  { ssr: false, loading: () => loading("Loading view POs…") }
);

const CreatePOContent = dynamic(
  () =>
    import("@/app/purchase/create-po/CreatePOContent").then((m) => ({
      default: m.CreatePOContent,
    })),
  { ssr: false, loading: () => loading("Loading create PO…") }
);

const FreightPendingContent = dynamic(
  () =>
    import("@/app/purchase/freight/pending/FreightPendingContent").then((m) => ({
      default: m.FreightPendingContent,
    })),
  { ssr: false, loading: () => loading("Loading freight pending…") }
);

const FreightApprovalsContent = dynamic(
  () =>
    import("@/app/purchase/freight-approvals/FreightApprovalsContent").then((m) => ({
      default: m.FreightApprovalsContent,
    })),
  { ssr: false, loading: () => loading("Loading freight approvals…") }
);

const PoVarianceContent = dynamic(
  () =>
    import("@/app/purchase/po-variance/PoVarianceContent").then((m) => ({
      default: m.PoVarianceContent,
    })),
  { ssr: false, loading: () => loading("Loading PO variance…") }
);

const PoBudgetChangeContent = dynamic(
  () =>
    import("@/app/purchase/po-budget-change/PoBudgetChangeContent").then((m) => ({
      default: m.PoBudgetChangeContent,
    })),
  { ssr: false, loading: () => loading("Loading PO budget change…") }
);

function PurchaseOrdersHubTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = usePurchaseOrdersHubTab();

  const onTabChange = useCallback(
    (value: string) => {
      if (!isPurchaseOrdersHubTab(value)) return;
      const filters = parsePurchaseOrdersHubFilters(searchParams);
      const preserved: Record<string, string> = {};
      const quoteId = searchParams.get("quoteId");
      const po = searchParams.get("po");
      const purchaseOrderId = searchParams.get("purchaseOrderId");
      const from = searchParams.get("from");
      const revision = searchParams.get("revision");
      if (quoteId) preserved.quoteId = quoteId;
      if (po) preserved.po = po;
      if (purchaseOrderId) preserved.purchaseOrderId = purchaseOrderId;
      if (from) preserved.from = from;
      if (revision) preserved.revision = revision;
      const qs = buildPurchaseOrdersHubQuery(value, filters, preserved);
      router.replace(`/purchase/purchase-orders?${qs}`);
    },
    [router, searchParams]
  );

  return (
    <Tabs value={tab} onValueChange={onTabChange} className="w-full">
      <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1">
        {(Object.keys(PURCHASE_ORDERS_HUB_TAB_LABELS) as PurchaseOrdersHubTab[]).map((key) => (
          <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">
            {PURCHASE_ORDERS_HUB_TAB_LABELS[key]}
          </TabsTrigger>
        ))}
      </TabsList>

      <PurchaseOrdersHubFilter />

      <TabsContent value={PURCHASE_ORDERS_HUB_TABS.all} className="mt-0">
        <PurchaseOrdersAllTab />
      </TabsContent>

      <TabsContent value={PURCHASE_ORDERS_HUB_TABS.view} className="mt-0">
        <ViewPosContent embedded />
      </TabsContent>

      <TabsContent value={PURCHASE_ORDERS_HUB_TABS.create} className="mt-0">
        <CreatePOContent embedded />
      </TabsContent>

      <TabsContent value={PURCHASE_ORDERS_HUB_TABS.freightPending} className="mt-0">
        <FreightPendingContent embedded />
      </TabsContent>

      <TabsContent value={PURCHASE_ORDERS_HUB_TABS.freightApprovals} className="mt-0">
        <FreightApprovalsContent embedded />
      </TabsContent>

      <TabsContent value={PURCHASE_ORDERS_HUB_TABS.variance} className="mt-0">
        <PoVarianceContent embedded />
      </TabsContent>

      <TabsContent value={PURCHASE_ORDERS_HUB_TABS.budgetChange} className="mt-0">
        <PoBudgetChangeContent embedded />
      </TabsContent>
    </Tabs>
  );
}

function PurchaseOrdersHubInner() {
  const tab = usePurchaseOrdersHubTab();

  return (
    <PurchaseOrdersHubProvider tab={tab}>
      <div className="w-full px-4 py-4">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold tracking-tight">Purchase Orders (All)</h1>
        </div>
        <PurchaseOrdersHubTabs />
      </div>
    </PurchaseOrdersHubProvider>
  );
}

export function PurchaseOrdersHubContent() {
  return (
    <Suspense fallback={loading("Loading purchase orders…")}>
      <PurchaseOrdersHubInner />
    </Suspense>
  );
}
