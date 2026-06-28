"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type DashboardStats = {
  vesselCount: number;
  projectsByStatus: Record<string, number>;
  activeJobs: number;
  pendingApprovals: number;
  openRisks: number;
  openDelays: number;
  upcomingMilestones: number;
};

export default function SuperintendentDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/superintendent/dashboard")
      .then((r) => r.json())
      .then((d) => setStats(d.stats ?? null))
      .finally(() => setLoading(false));
  }, []);

  const projectTotal = stats
    ? Object.values(stats.projectsByStatus).reduce((a, b) => a + b, 0)
    : 0;

  const cards = stats
    ? [
        { label: "Assigned vessels", value: stats.vesselCount, href: "/superintendent/vessels" },
        { label: "Dry dock projects", value: projectTotal, href: "/superintendent/projects" },
        { label: "Active jobs", value: stats.activeJobs, href: "/superintendent/jobs" },
        { label: "Pending approvals", value: stats.pendingApprovals, href: "/superintendent/approvals" },
        { label: "Open risks", value: stats.openRisks, href: "/superintendent/planning/risks" },
        { label: "Open delays", value: stats.openDelays, href: "/superintendent/monitoring/delays" },
        {
          label: "Upcoming milestones",
          value: stats.upcomingMilestones,
          href: "/superintendent/planning/milestones",
        },
      ]
    : [];

  return (
    <PageShell>
      <PageHeader
        title="Technical Superintendent"
        description="Fleet dry-dock overview, planning, and execution tracking."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading dashboard…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link key={card.href} href={card.href} className="block transition-opacity hover:opacity-90">
              <Card>
                <CardHeader>
                  <CardTitle className="text-3xl font-semibold tabular-nums">{card.value}</CardTitle>
                  <CardDescription>{card.label}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {stats && Object.keys(stats.projectsByStatus).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projects by status</CardTitle>
            <CardDescription>
              {Object.entries(stats.projectsByStatus).map(([status, count]) => (
                <span key={status} className="mr-4">
                  {status.replace(/_/g, " ")}: {count}
                </span>
              ))}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </PageShell>
  );
}
