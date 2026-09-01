"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import { SeaValvesPanel } from "@/components/superintendent/SeaValvesPanel";
import type { InputSubmissionDto } from "@/lib/db/superintendent/inputs";

type Props = {
  dryDockProjectId: string;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  enteredByName: string;
  onEnteredByNameChange: (name: string) => void;
  disabled?: boolean;
  onSubmissionLoaded?: (submission: InputSubmissionDto | null) => void;
};

export function SeaValveInputJobBanner({ dryDockProjectId }: { dryDockProjectId: string }) {
  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
      <p className="font-medium">Shared with Sea valves input</p>
      <p className="mt-0.5 text-muted-foreground">
        Valve rows are stored in the vessel Sea valves section. Add, edit, or remove valves here —
        the same data appears on the condition page. Title, priority, and status can be edited below.
      </p>
      <Link
        href={`/superintendent/projects/${dryDockProjectId}/inputs/vessel/condition`}
        className="mt-2 inline-flex items-center gap-1 text-primary hover:underline"
      >
        Open Sea valves on vessel condition
        <ExternalLink className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}

export function SeaValveJobScopeSection({
  dryDockProjectId,
  values,
  onChange,
  enteredByName,
  onEnteredByNameChange,
  disabled,
  onSubmissionLoaded,
}: Props) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/superintendent/projects/${dryDockProjectId}/inputs/sea_valves`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (res.status === 404) return { submission: null as InputSubmissionDto | null };
        const data = (await res.json()) as { submission?: InputSubmissionDto; error?: string };
        return { submission: data.submission ?? null };
      })
      .then(({ submission }) => {
        if (cancelled) return;
        if (submission) {
          onChange(submission.valuesJson ?? { valves: [] });
          onEnteredByNameChange(submission.enteredByName ?? "");
        }
        onSubmissionLoaded?.(submission);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Load once per project — parent receives values via callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dryDockProjectId]);

  function setField(key: string, value: unknown) {
    onChange({ ...values, [key]: value });
  }

  if (loading) {
    return <ActiniumLoadingState size="sm" />;
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="seaValveEnteredByName">Entered by (name)</Label>
        <Input
          id="seaValveEnteredByName"
          className="mt-1.5"
          value={enteredByName}
          onChange={(e) => onEnteredByNameChange(e.target.value)}
          placeholder="Chief Engineer / Master"
          disabled={disabled}
        />
      </div>
      <SeaValvesPanel
        values={values}
        onChange={setField}
        dryDockProjectId={dryDockProjectId}
        disabled={disabled}
        onImported={(submission) => {
          onChange(submission.valuesJson ?? { valves: [] });
          onEnteredByNameChange(submission.enteredByName ?? "");
          onSubmissionLoaded?.(submission);
        }}
      />
    </div>
  );
}

export function SeaValveScopeJobLink({
  dryDockProjectId,
  jobId,
}: {
  dryDockProjectId: string;
  jobId: string | null;
}) {
  if (!jobId) return null;

  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm">
      <p className="font-medium">Linked scope job</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Valves appear on Scope of work. Edit here or on the job page — both stay in sync when you
        save.
      </p>
      <p className="mt-2">
        <Link
          href={`/superintendent/jobs/${jobId}/edit`}
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          Sea Valve Survey
          <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        <Link
          href={`/superintendent/projects/${dryDockProjectId}/scope`}
          className="text-primary hover:underline"
        >
          Open full scope of work
        </Link>
      </p>
    </div>
  );
}
