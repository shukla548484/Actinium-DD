"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { CombinedInputReadinessPanel } from "@/components/superintendent/CombinedInputReadinessPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtPct } from "@/lib/superintendent/formatters";
import type { CombinedInputReadinessReport } from "@/lib/db/superintendent/inputs";
import { INPUT_PAGE_LABELS, inputPageHref } from "@/lib/superintendent/inputCatalog/constants";
import type { InputPageKey } from "@/lib/superintendent/inputCatalog/types";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

const STATUS_LABEL: Record<string, string> = {
  missing: "Not started",
  draft: "Draft",
  submitted: "Submitted",
  reviewed: "Reviewed",
  approved: "Approved",
  rejected: "Rejected",
  inactive: "Inactive",
};

export default function PreDockReadinessPage() {
  const { id } = useParams<{ id: string }>();
  const [combined, setCombined] = useState<CombinedInputReadinessReport | null>(null);
  const [vesselOnly, setVesselOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch(`/api/superintendent/projects/${id}/inputs/readiness?combined=true`)
      .then((r) => r.json())
      .then((d: { combinedReadiness?: CombinedInputReadinessReport }) =>
        setCombined(d.combinedReadiness ?? null),
      )
      .finally(() => setLoading(false));
  }, [id]);

  const vesselReport = combined?.byPage.vessel;

  return (
    <PageShell size="wide">
      <PageHeader
        title="Input readiness"
        description="Combined completion across vessel, superintendent, workshop, procurement, and closeout."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              render={
                <a
                  href={`/api/superintendent/projects/${id}/inputs/readiness/export?format=xlsx&combined=true`}
                />
              }
              nativeButton={false}
            >
              Export combined Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              render={
                <Link href={`/superintendent/projects/${id}/inputs/vessel-portal`} />
              }
              nativeButton={false}
            >
              Vessel portal
            </Button>
          </>
        }
      />

      {loading ? (
        <ActiniumLoadingState label="Loading readiness report…" size="sm" />
      ) : !combined ? (
        <p className="text-sm text-muted-foreground">No readiness data available.</p>
      ) : (
        <div className="space-y-4">
          <CombinedInputReadinessPanel dryDockProjectId={id} />

          <div className="flex gap-2">
            <Button
              variant={vesselOnly ? "outline" : "default"}
              size="sm"
              onClick={() => setVesselOnly(false)}
            >
              All roles
            </Button>
            <Button
              variant={vesselOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setVesselOnly(true)}
            >
              Vessel only
            </Button>
          </div>

          {!vesselOnly
            ? (Object.keys(combined.byPage) as InputPageKey[]).map((pageKey) => {
                const page = combined.byPage[pageKey];
                if (!page) return null;
                return (
                  <Card key={pageKey}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-base">{INPUT_PAGE_LABELS[pageKey]}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={inputPageHref(id, pageKey)} />}
                        nativeButton={false}
                      >
                        Edit
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <p className="mb-3 text-sm text-muted-foreground">
                        {page.completedSections}/{page.totalSections} complete ·{" "}
                        {fmtPct(page.completionPct)}
                      </p>
                      <ul className="divide-y text-sm">
                        {page.sections.map((section) => (
                          <li
                            key={section.sectionKey}
                            className="flex items-center justify-between py-2"
                          >
                            <span>
                              {section.label}
                              {section.mandatory ? (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  (mandatory)
                                </span>
                              ) : null}
                            </span>
                            <span className="text-muted-foreground">
                              {STATUS_LABEL[section.status] ?? section.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })
            : vesselReport ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Vessel sections</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="divide-y text-sm">
                      {vesselReport.sections.map((section) => (
                        <li
                          key={section.sectionKey}
                          className="flex items-center justify-between py-2"
                        >
                          <span>{section.label}</span>
                          <span className="text-muted-foreground">
                            {STATUS_LABEL[section.status] ?? section.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ) : null}
        </div>
      )}
    </PageShell>
  );
}
