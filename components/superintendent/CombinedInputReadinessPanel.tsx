"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtPct } from "@/lib/superintendent/formatters";
import type { CombinedInputReadinessReport } from "@/lib/db/superintendent/inputs";
import { INPUT_PAGE_LABELS, inputPageHref } from "@/lib/superintendent/inputCatalog/constants";
import type { InputPageKey } from "@/lib/superintendent/inputCatalog/types";

type Props = {
  dryDockProjectId: string;
  compact?: boolean;
};

export function CombinedInputReadinessPanel({ dryDockProjectId, compact }: Props) {
  const [data, setData] = useState<CombinedInputReadinessReport | null>(null);

  useEffect(() => {
    void fetch(
      `/api/superintendent/projects/${dryDockProjectId}/inputs/readiness?combined=true`,
    )
      .then((r) => r.json())
      .then((d: { combinedReadiness?: CombinedInputReadinessReport }) =>
        setData(d.combinedReadiness ?? null),
      );
  }, [dryDockProjectId]);

  if (!data || data.overall.totalSections === 0) return null;

  const { overall, byPage } = data;

  if (compact) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
          <div>
            <CardTitle className="text-base">Input readiness (all roles)</CardTitle>
            <CardDescription>
              {overall.completedSections}/{overall.totalSections} sections ·{" "}
              {overall.pendingReview} pending review
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href={`/superintendent/projects/${dryDockProjectId}/inputs/readiness`} />
            }
            nativeButton={false}
          >
            Details
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">{fmtPct(overall.completionPct)}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Overall completion", value: fmtPct(overall.completionPct) },
          {
            label: "Sections complete",
            value: `${overall.completedSections}/${overall.totalSections}`,
          },
          {
            label: "Mandatory complete",
            value: `${overall.mandatoryCompleted}/${overall.mandatorySections}`,
          },
          { label: "Pending review", value: String(overall.pendingReview) },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-semibold tabular-nums">{kpi.value}</CardTitle>
              <CardDescription>{kpi.label}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By role</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {(Object.keys(byPage) as InputPageKey[]).map((pageKey) => {
              const page = byPage[pageKey];
              if (!page) return null;
              return (
                <li key={pageKey} className="flex items-center justify-between gap-4 py-2">
                  <Link
                    href={inputPageHref(dryDockProjectId, pageKey)}
                    className="font-medium hover:underline"
                  >
                    {INPUT_PAGE_LABELS[pageKey]}
                  </Link>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {page.completedSections}/{page.totalSections} · {fmtPct(page.completionPct)}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
