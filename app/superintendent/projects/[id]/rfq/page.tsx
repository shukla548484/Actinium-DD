"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BudgetVsQuotePanel } from "@/components/superintendent/BudgetVsQuotePanel";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { fmtDate } from "@/lib/superintendent/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

export const dynamic = "force-dynamic";

type RfqStep = {
  id: string;
  title: string;
  isCompleted: boolean;
  dueDate: string | null;
};

type ProjectMeta = {
  tenderProject: { id: string; name: string } | null;
};

export default function ProjectRfqPage() {
  const { id } = useParams<{ id: string }>();
  const [rfqSteps, setRfqSteps] = useState<RfqStep[]>([]);
  const [project, setProject] = useState<ProjectMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      fetch(`/api/superintendent/projects/${id}/documents`).then((r) => r.json()),
      fetch(`/api/superintendent/projects/${id}`).then((r) => r.json()),
    ]).then(([docs, detail]) => {
      setRfqSteps((docs.rfqSteps ?? []) as RfqStep[]);
      const p = detail.project as { tenderProject?: ProjectMeta["tenderProject"] } | undefined;
      setProject({ tenderProject: p?.tenderProject ?? null });
    }).finally(() => setLoading(false));
  }, [id]);

  const completed = rfqSteps.filter((s) => s.isCompleted).length;

  return (
    <PageShell>
      <PageHeader
        title="RFQ & Tender"
        description="Yard quote workflow for this dry dock project."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/projects/new" />}
              nativeButton={false}
            >
              New tender
            </Button>
            {project?.tenderProject ? (
              <Button
                size="sm"
                render={<Link href={`/projects/${project.tenderProject.id}`} />}
                nativeButton={false}
              >
                Open tender
              </Button>
            ) : null}
          </>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading RFQ workflow…</p>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                RFQ steps ({completed}/{rfqSteps.length} complete)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rfqSteps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No RFQ steps provisioned for this project type.</p>
              ) : (
                <ol className="space-y-2">
                  {rfqSteps.map((step, index) => (
                    <li
                      key={step.id}
                      className="flex items-start gap-3 rounded-md border px-3 py-2 text-sm"
                    >
                      <span className="mt-0.5 text-xs font-medium text-muted-foreground">
                        {index + 1}.
                      </span>
                      <Checkbox checked={step.isCompleted} disabled className="mt-0.5" />
                      <div className="flex-1">
                        <Link
                          href={`/superintendent/planning/checklist/${step.id}/edit?dryDockProjectId=${encodeURIComponent(id)}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {step.title}
                        </Link>
                        {step.dueDate ? (
                          <p className="text-xs text-muted-foreground">Due {fmtDate(step.dueDate)}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <BudgetVsQuotePanel
            dryDockProjectId={id}
            tenderProjectId={project?.tenderProject?.id}
          />
        </div>
      )}
    </PageShell>
  );
}
