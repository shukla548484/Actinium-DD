"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";
import { persistLastVesselId } from "@/lib/performance/last-vessel-preference";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShoppingCart,
  FileText,
  CheckCircle2,
  Clock,
  DollarSign,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { useVessels } from "@/hooks/useStaticData";
import { usePurchaseDashboardStats } from "@/hooks/usePurchaseDashboardStats";
import { useState } from "react";

const PurchaseOverviewPieChart = dynamic(
  () =>
    import("@/components/purchase/PurchaseOverviewPieChart").then((mod) => ({
      default: mod.PurchaseOverviewPieChart,
    })),
  { ssr: false, loading: () => <Skeleton className="h-[280px] w-full rounded-lg" /> }
);

export default function PurchaseDashboardPage() {
  const { ready, markSuccess } = usePageBootstrap();
  const { data: vessels = [], isLoading: vesselsLoading } = useVessels({ limit: 100, isActive: true });
  const [selectedVessel, setSelectedVessel] = useState<string>("all");

  const { data: stats, isLoading: statsLoading, isFetching } = usePurchaseDashboardStats(
    selectedVessel,
    ready
  );

  useEffect(() => {
    if (!vesselsLoading) markSuccess();
  }, [vesselsLoading, markSuccess]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleVesselChange = (value: string) => {
    setSelectedVessel(value);
    if (value !== "all") persistLastVesselId(value);
  };

  const loading = statsLoading || isFetching;

  const content = !stats && loading ? (
      <div className="space-y-4 animate-pulse">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <div className="h-6 w-56 rounded bg-card" />
            <div className="h-4 w-72 mt-1 rounded bg-card" />
          </div>
          <div className="h-10 w-64 rounded bg-card" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-lg bg-card" />
          ))}
        </div>
        <div className="h-80 rounded-lg bg-card" />
      </div>
  ) : (
    <div className="space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Purchase Dashboard</h1>
            <p className="text-sm text-muted-foreground">Overview of purchase and procurement activities</p>
          </div>
          <div className="flex gap-2">
            <Select value={selectedVessel} onValueChange={handleVesselChange}>
              <SelectTrigger className="w-64" width="vessel">
                <SelectValue placeholder="Select vessel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vessels</SelectItem>
                {vessels.map((vessel) => (
                  <SelectItem key={vessel.id} value={vessel.id}>
                    {vessel.name} ({vessel.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading && !stats ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading statistics...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4 mb-6">
              <Card className="min-w-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Purchase Overview</CardTitle>
                  <CardDescription>Requisitions, orders, invoices and total amount</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Total Requisitions</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold">{stats?.totalRequisitions ?? 0}</span>
                      <p className="text-xs text-muted-foreground">{stats?.pendingRequisitions ?? 0} pending</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-info" />
                      <span className="text-sm font-medium text-foreground">Purchase Orders</span>
                    </div>
                    <span className="text-xl font-bold text-info">{stats?.totalPurchaseOrders ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span className="text-sm font-medium text-foreground">Total Invoices</span>
                    </div>
                    <span className="text-xl font-bold text-success">{stats?.totalInvoices ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-info" />
                      <span className="text-sm font-medium text-foreground">Total Amount</span>
                    </div>
                    <span className="text-xl font-bold text-info">{formatCurrency(stats?.totalAmount ?? 0)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="min-w-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Overview by type
                  </CardTitle>
                  <CardDescription>Count distribution for requisitions, orders, and invoices</CardDescription>
                </CardHeader>
                <CardContent>
                  <PurchaseOverviewPieChart
                    totalRequisitions={stats?.totalRequisitions ?? 0}
                    totalPurchaseOrders={stats?.totalPurchaseOrders ?? 0}
                    totalInvoices={stats?.totalInvoices ?? 0}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="cursor-pointer hover:shadow-md transition-shadow" asChild>
                <Link href="/purchase/create-requisition">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Create Requisition
                    </CardTitle>
                    <CardDescription>Create a new purchase requisition</CardDescription>
                  </CardHeader>
                </Link>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow" asChild>
                <Link href="/purchase/view-requisitions">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-warning" />
                      View Requisitions
                    </CardTitle>
                    <CardDescription>View and manage requisitions</CardDescription>
                  </CardHeader>
                </Link>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow" asChild>
                <Link href="/purchase/purchase-orders?tab=create">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5 text-info" />
                      Create Purchase Order
                    </CardTitle>
                    <CardDescription>Generate purchase orders</CardDescription>
                  </CardHeader>
                </Link>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow" asChild>
                <Link href="/purchase/invoices">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      Invoices
                    </CardTitle>
                    <CardDescription>Manage invoices</CardDescription>
                  </CardHeader>
                </Link>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow" asChild>
                <Link href="/purchase/reports">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Reports
                    </CardTitle>
                    <CardDescription>View purchase reports</CardDescription>
                  </CardHeader>
                </Link>
              </Card>
            </div>
          </>
        )}
    </div>
  );

  return <PageReadyGate ready={ready}>{content}</PageReadyGate>;
}
