"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { fmtDate } from "@/lib/superintendent/formatters";
import { getStatusLabel } from "@/lib/superintendent/engine/statusWorkflow";
import type { DryDockProjectStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

export const dynamic = "force-dynamic";

type CloseoutData = {
  status: string | null;
  counts: {
    incompleteJobs: number;
    pendingApprovals: number;
    incompleteChecklist: number;
  };
  readyToClose: boolean;
  outstandingItems: {
    id: string;
    title: string;
    category: string | null;
    dueDate: string | null;
  }[];
};

export default function ProjectCloseoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [closeout, setCloseout] = useState<CloseoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch(`/api/superintendent/projects/${id}/closeout`)
      .then((r) => r.json())
      .then((d: { closeout?: CloseoutData }) => setCloseout(d.closeout ?? null))
      .finally(() => setLoading(false));
  }, [id]);

  async function advanceStatus(next: DryDockProjectStatus) {
    setBusy(true);
    const res = await fetch(`/api/superintendent/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
      void fetch(`/api/superintendent/projects/${id}/closeout`)
        .then((r) => r.json())
        .then((d: { closeout?: CloseoutData }) => setCloseout(d.closeout ?? null));
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Close Project"
        description="Outstanding items, sign-off readiness, and archive workflow."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/superintendent/projects/${id}/inputs/closeout`} />}
              nativeButton={false}
            >
              Closeout inputs
            </Button>
            {closeout?.readyToClose ? (
              <Button size="sm" disabled={busy} onClick={() => void advanceStatus("closed")}>
                Mark closed
              </Button>
            ) : null}
          </>
        }
      />

      {loading ? (
        <ActiniumLoadingState label="Loading closeout status…" size="sm" />
      ) : closeout ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Status", value: closeout.status ? getStatusLabel(closeout.status as DryDockProjectStatus) : "—" },
              { label: "Incomplete jobs", value: String(closeout.counts.incompleteJobs) },
              { label: "Pending approvals", value: String(closeout.counts.pendingApprovals) },
              { label: "Open checklist", value: String(closeout.counts.incompleteChecklist) },
            ].map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-lg font-semibold">{kpi.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {closeout.readyToClose ? "Ready to close" : "Outstanding items"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {closeout.readyToClose ? (
                <p className="text-muted-foreground">
                  All jobs, approvals, and checklist items are complete. You can mark this project closed,
                  then archive when records are filed.
                </p>
              ) : (
                <>
                  <p className="text-muted-foreground">
                    Resolve the items below before closing the project.
                  </p>
                  <ul className="space-y-2">
                    {closeout.outstandingItems.map((item) => (
                      <li key={item.id} className="rounded-md border px-3 py-2">
                        <Link
                          href={`/superintendent/planning/checklist/${item.id}/edit?dryDockProjectId=${encodeURIComponent(id)}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {item.title}
                        </Link>
                        {item.dueDate ? (
                          <p className="text-xs text-muted-foreground">Due {fmtDate(item.dueDate)}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {closeout.counts.incompleteJobs > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        render={<Link href={`/superintendent/projects/${id}/scope`} />}
                        nativeButton={false}
                      >
                        Review jobs
                      </Button>
                    ) : null}
                    {closeout.counts.pendingApprovals > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        render={
                          <Link
                            href={`/superintendent/approvals?dryDockProjectId=${encodeURIComponent(id)}`}
                          />
                        }
                        nativeButton={false}
                      >
                        Review approvals
                      </Button>
                    ) : null}
                  </div>
                </>
              )}

              {closeout.status === "closed" ? (
                <Button size="sm" disabled={busy} onClick={() => void advanceStatus("archived")}>
                  Archive project
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-sm text-destructive">Closeout data not available.</p>
      )}
    </PageShell>
  );
}
