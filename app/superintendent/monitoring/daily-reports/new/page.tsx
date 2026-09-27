"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  blankDailyReportFormValues,
  DailyReportForm,
  type DailyReportFormValues,
} from "@/components/superintendent/DailyReportForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { useActiveDryDockProject } from "@/components/superintendent/ActiveDryDockProjectProvider";

export const dynamic = "force-dynamic";

export default function NewDailyReportPage() {
  const router = useRouter();
  const { activeProjectId } = useActiveDryDockProject();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: DailyReportFormValues) {
    if (!values.dryDockProjectId) {
      setError("Dry dock project is required");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/superintendent/daily-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dryDockProjectId: values.dryDockProjectId,
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
    const d = (await res.json()) as { dailyReport?: { id: string } };
    if (d.dailyReport?.id) {
      router.push(`/superintendent/monitoring/daily-reports/${d.dailyReport.id}/edit`);
    } else {
      router.push("/superintendent/monitoring/daily-reports");
    }
    router.refresh();
  }

  return (
    <PageShell>
      <PageHeader
        title="New daily report"
        description="One report per project calendar day — weather and six work sections."
      />
      <DailyReportForm
        key={activeProjectId ?? "none"}
        mode="create"
        initial={blankDailyReportFormValues(activeProjectId ?? "")}
        saving={saving}
        error={error}
        onSubmit={(v) => void handleSubmit(v)}
      />
    </PageShell>
  );
}
