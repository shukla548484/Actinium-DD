"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  blankDailyReportFormValues,
  DailyReportForm,
  type DailyReportFormValues,
  type DailyReportProjectMeta,
} from "@/components/superintendent/DailyReportForm";
import { PageShell } from "@/components/layout/PageShell";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import { Button } from "@/components/ui/button";
import { toDateInput } from "@/components/ui/DatePickerField";
import type { DailyReportSections } from "@/lib/superintendent/dailyReportSections";

export const dynamic = "force-dynamic";

type Loaded = {
  id: string;
  reportNumber: string;
  reportDate: string;
  weatherCondition: string | null;
  progressPct: number | null;
  dryDockProjectId: string;
  sections: DailyReportSections;
};

export default function EditDailyReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<Loaded | null>(null);
  const [project, setProject] = useState<DailyReportProjectMeta | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/superintendent/daily-reports/${id}`)
      .then((r) => r.json())
      .then(
        (d: {
          dailyReport?: Loaded;
          project?: DailyReportProjectMeta;
        }) => {
          if (d.dailyReport) setItem(d.dailyReport);
          if (d.project) setProject(d.project);
        },
      )
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(values: DailyReportFormValues) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/superintendent/daily-reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportDate: values.reportDate,
        weatherCondition: values.weatherCondition || null,
        progressPct: values.progressPct ? Number(values.progressPct) : null,
        sections: values.sections,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "Save failed");
      return;
    }
    router.push("/superintendent/monitoring/daily-reports");
    router.refresh();
  }

  if (loading) {
    return (
      <PageShell>
        <ActiniumLoadingState size="sm" />
      </PageShell>
    );
  }

  if (!item) {
    return (
      <PageShell>
        <p className="text-sm text-destructive">Record not found.</p>
      </PageShell>
    );
  }

  const initial: DailyReportFormValues = {
    ...blankDailyReportFormValues(item.dryDockProjectId),
    dryDockProjectId: item.dryDockProjectId,
    reportNumber: item.reportNumber,
    reportDate: toDateInput(item.reportDate),
    weatherCondition: item.weatherCondition ?? "",
    progressPct: item.progressPct != null ? String(item.progressPct) : "",
    sections: item.sections,
  };

  return (
    <PageShell size="wide">
      <div className="flex justify-end print:hidden">
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/superintendent/monitoring/daily-reports/${item.id}/print`} />}
          nativeButton={false}
        >
          Print / PDF
        </Button>
      </div>
      <DailyReportForm
        mode="edit"
        reportId={item.id}
        initial={initial}
        project={project}
        saving={saving}
        error={error}
        onSubmit={(v) => void handleSubmit(v)}
      />
    </PageShell>
  );
}
