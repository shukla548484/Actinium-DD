"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import {
  projectBudgetHref,
  projectMonitoringHref,
  projectPlanningHref,
  projectScopedHref,
} from "@/lib/superintendent/engine/workspaceLinks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function ProjectReportsPage() {
  const { id } = useParams<{ id: string }>();

  const reports = [
    {
      title: "Daily progress reports",
      description: "Daily yard progress, weather, and photos.",
      href: projectMonitoringHref(id, "daily-reports"),
    },
    {
      title: "Delay register",
      description: "Delay log with impact on schedule and cost.",
      href: projectMonitoringHref(id, "delays"),
    },
    {
      title: "Variation orders",
      description: "Commercial growth and reduction tracking.",
      href: projectBudgetHref(id, "variations"),
    },
    {
      title: "Risk register",
      description: "Identified risks and mitigations.",
      href: projectPlanningHref(id, "risks"),
    },
    {
      title: "Approvals",
      description: "Technical and commercial sign-off status.",
      href: projectScopedHref("approvals", id),
    },
    {
      title: "Budget vs actual",
      description: "Budget lines and yard quote comparison.",
      href: projectBudgetHref(id),
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Reports"
        description="Progress and commercial reporting for this dry dock project."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report) => (
          <Card key={report.href}>
            <CardHeader>
              <CardTitle className="text-base">{report.title}</CardTitle>
              <CardDescription>{report.description}</CardDescription>
              <Button
                variant="link"
                className="h-auto w-fit p-0"
                render={<Link href={report.href} />}
                nativeButton={false}
              >
                Open register →
              </Button>
            </CardHeader>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
