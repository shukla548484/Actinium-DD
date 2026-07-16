"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import type { PurchaseDashboardStats } from "@/lib/purchase/types";
import { EMPTY_PURCHASE_DASHBOARD_STATS } from "@/lib/purchase/types";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  ShoppingCart,
} from "lucide-react";

type VesselOption = { id: string; code: string; name: string };

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function PurchaseDashboardPanel() {
  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const [vesselId, setVesselId] = useState("all");
  const [stats, setStats] = useState<PurchaseDashboardStats>(EMPTY_PURCHASE_DASHBOARD_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/purchase/vessels")
      .then((r) => (r.ok ? r.json() : { vessels: [] }))
      .then((data) => setVessels((data.vessels as VesselOption[]) ?? []))
      .catch(() => setVessels([]));
  }, []);

  const loadStats = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = id !== "all" ? `?vesselId=${encodeURIComponent(id)}` : "";
      const res = await fetch(`/api/purchase/dashboard/stats${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load stats");
      setStats(data.stats as PurchaseDashboardStats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
      setStats(EMPTY_PURCHASE_DASHBOARD_STATS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats(vesselId);
  }, [vesselId, loadStats]);

  const cards = [
    {
      label: "Total requisitions",
      value: stats.totalRequisitions,
      icon: FileText,
      href: "/purchase/view-requisitions",
    },
    {
      label: "Pending",
      value: stats.pendingRequisitions,
      icon: Clock,
      href: "/purchase/view-requisitions?status=NOT_READY",
    },
    {
      label: "Approved",
      value: stats.approvedRequisitions,
      icon: CheckCircle2,
      href: "/purchase/view-requisitions?status=REQ_APPROVED",
    },
    {
      label: "Quotes",
      value: stats.totalQuotes,
      icon: BarChart3,
      href: "/purchase/view-requisitions",
    },
    {
      label: "Purchase orders",
      value: stats.totalPurchaseOrders,
      icon: ShoppingCart,
      href: "/purchase/purchase-orders",
    },
    {
      label: "Invoices",
      value: stats.totalInvoices,
      icon: FileText,
      href: "/purchase/invoices",
    },
  ];

  return (
    <PageShell size="wide">
      <PageHeader
        title="Purchase Dashboard"
        description="Requisitions, quotes, purchase orders, and invoice spend overview."
        showBack={false}
        actions={
          <div className="min-w-56">
            <SearchableSelect
              items={[
                { value: "all", label: "All vessels" },
                ...vessels.map((v) => ({
                  value: v.id,
                  label: `${v.name} (${v.code})`,
                  searchText: `${v.name} ${v.code}`,
                })),
              ]}
              value={vesselId}
              onValueChange={setVesselId}
              placeholder="Filter by vessel…"
            />
          </div>
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <ActiniumLoadingState label="Loading purchase KPIs…" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.label}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardDescription>{card.label}</CardDescription>
                      <Icon className="size-4 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-2xl font-semibold tabular-nums">
                      <Link href={card.href} className="hover:underline">
                        {card.value}
                      </Link>
                    </CardTitle>
                  </CardHeader>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="size-4" />
                  PO total amount
                </CardTitle>
                <CardDescription>Sum of issued purchase orders</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums">{formatCurrency(stats.totalAmount)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="size-4" />
                  Pending invoice amount
                </CardTitle>
                <CardDescription>Invoices not yet paid</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums">
                  {formatCurrency(stats.pendingAmount)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button render={<Link href="/purchase/create-requisition" />} nativeButton={false}>
              Create requisition
            </Button>
            <Button
              variant="outline"
              render={<Link href="/purchase/view-requisitions" />}
              nativeButton={false}
            >
              View requisitions
            </Button>
            <Button
              variant="outline"
              render={<Link href="/purchase/purchase-orders" />}
              nativeButton={false}
            >
              Purchase orders
            </Button>
            <Badge variant="secondary">Live KPIs from purchase_* tables</Badge>
          </div>
        </>
      )}
    </PageShell>
  );
}
