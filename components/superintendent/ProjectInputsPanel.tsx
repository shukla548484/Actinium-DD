"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputSectionForm } from "@/components/superintendent/InputSectionForm";
import type { InputReadinessReport, InputSubmissionDto } from "@/lib/db/superintendent/inputs";
import type { InputPageKey, InputSectionDef } from "@/lib/superintendent/inputCatalog/types";

type Props = {
  dryDockProjectId: string;
  pageKey?: InputPageKey;
  readOnly?: boolean;
  /** Override role sent on save (e.g. superintendent entering yard data). */
  enteredByRole?: InputSectionDef["enteredBy"];
};

type InputsPayload = {
  catalog: InputSectionDef[];
  submissions: InputSubmissionDto[];
  readiness: InputReadinessReport;
};

const STATUS_DOT: Record<string, string> = {
  missing: "bg-muted-foreground/40",
  draft: "bg-amber-400",
  submitted: "bg-blue-500",
  reviewed: "bg-violet-500",
  approved: "bg-emerald-500",
  rejected: "bg-destructive",
  inactive: "bg-muted-foreground/40",
};

export function ProjectInputsPanel({ dryDockProjectId, pageKey = "vessel", readOnly, enteredByRole }: Props) {
  const [data, setData] = useState<InputsPayload | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/superintendent/projects/${dryDockProjectId}/inputs?pageKey=${pageKey}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load inputs");
      setData(json as InputsPayload);
      setActiveKey((prev) => prev ?? json.catalog?.[0]?.key ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [dryDockProjectId, pageKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSaved = (submission: InputSubmissionDto | null) => {
    if (!submission) {
      setData((prev) => {
        if (!prev) return prev;
        const key = activeSection.key;
        return {
          ...prev,
          submissions: prev.submissions.filter((s) => s.sectionKey !== key),
        };
      });
      void fetch(
        `/api/superintendent/projects/${dryDockProjectId}/inputs/readiness?pageKey=${pageKey}`,
      )
        .then((r) => r.json())
        .then((d: { readiness?: InputReadinessReport }) => {
          if (d.readiness) {
            setData((prev) => (prev ? { ...prev, readiness: d.readiness! } : prev));
          }
        });
      return;
    }
    setData((prev) => {
      if (!prev) return prev;
      const others = prev.submissions.filter((s) => s.sectionKey !== submission.sectionKey);
      return { ...prev, submissions: [...others, submission] };
    });
    void fetch(
      `/api/superintendent/projects/${dryDockProjectId}/inputs/readiness?pageKey=${pageKey}`,
    )
      .then((r) => r.json())
      .then((d: { readiness?: InputReadinessReport }) => {
        if (d.readiness) {
          setData((prev) => (prev ? { ...prev, readiness: d.readiness! } : prev));
        }
      });
  };

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">Loading input sections…</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!data?.catalog.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No input sections configured for this project type.
      </p>
    );
  }

  const submissionByKey = new Map(data.submissions.map((s) => [s.sectionKey, s]));
  const readinessByKey = new Map(data.readiness.sections.map((s) => [s.sectionKey, s.status]));
  const activeSection = data.catalog.find((s) => s.key === activeKey) ?? data.catalog[0];
  const activeSubmission = submissionByKey.get(activeSection.key) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(12rem,16rem)_1fr]">
      <Card className="h-fit">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Sections</CardTitle>
          <p className="text-xs text-muted-foreground">
            {data.readiness.mandatoryCompleted}/{data.readiness.mandatorySections} mandatory complete
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y">
            {data.catalog.map((section) => {
              const status = readinessByKey.get(section.key) ?? "missing";
              return (
                <li key={section.key}>
                  <button
                    type="button"
                    onClick={() => setActiveKey(section.key)}
                    className={cn(
                      "flex w-full items-start gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/50",
                      activeSection.key === section.key && "bg-muted/60",
                    )}
                  >
                    <span
                      className={cn("mt-1.5 size-2 shrink-0 rounded-full", STATUS_DOT[status])}
                      aria-hidden
                    />
                    <span>
                      <span className="block font-medium leading-tight">{section.label}</span>
                      {section.mandatory ? (
                        <span className="text-xs text-muted-foreground">Mandatory</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <InputSectionForm
            key={activeSection.key}
            section={activeSection}
            submission={activeSubmission}
            dryDockProjectId={dryDockProjectId}
            onSaved={onSaved}
            readOnly={readOnly}
            enteredByRole={enteredByRole ?? activeSection.enteredBy}
          />
        </CardContent>
      </Card>
    </div>
  );
}
