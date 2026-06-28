"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtPct } from "@/lib/superintendent/formatters";
import type { InputReadinessReport } from "@/lib/db/superintendent/inputs";

type Props = {
  dryDockProjectId: string;
  pageKey?: "vessel" | "review";
};

export function InputReadinessSummary({ dryDockProjectId, pageKey = "vessel" }: Props) {
  const [readiness, setReadiness] = useState<InputReadinessReport | null>(null);

  useEffect(() => {
    void fetch(
      `/api/superintendent/projects/${dryDockProjectId}/inputs/readiness?pageKey=${pageKey}`,
    )
      .then((r) => r.json())
      .then((d: { readiness?: InputReadinessReport }) => setReadiness(d.readiness ?? null));
  }, [dryDockProjectId, pageKey]);

  if (!readiness || readiness.totalSections === 0) return null;

  const href =
    pageKey === "review"
      ? `/superintendent/projects/${dryDockProjectId}/inputs/review`
      : `/superintendent/projects/${dryDockProjectId}/inputs/vessel`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Pre-dock vessel inputs</CardTitle>
          <CardDescription>
            {readiness.completedSections}/{readiness.totalSections} sections complete ·{" "}
            {readiness.pendingReview} pending review
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" render={<Link href={href} />} nativeButton={false}>
          Open
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <p className="text-2xl font-semibold tabular-nums">{fmtPct(readiness.completionPct)}</p>
            <p className="text-muted-foreground">Overall</p>
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums">
              {readiness.mandatoryCompleted}/{readiness.mandatorySections}
            </p>
            <p className="text-muted-foreground">Mandatory</p>
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums">{readiness.approved}</p>
            <p className="text-muted-foreground">Approved</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
