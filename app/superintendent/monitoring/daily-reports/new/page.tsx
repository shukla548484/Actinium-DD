"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  blankDailyReportFormValues,
  DailyReportForm,
  type DailyReportFormValues,
} from "@/components/superintendent/DailyReportForm";
import { uploadPendingDailyReportPhotos } from "@/components/superintendent/DailyReportSectionPhotos";
import { PageShell } from "@/components/layout/PageShell";
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
    try {
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
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Save failed");
        return;
      }
      const d = (await res.json()) as { dailyReport?: { id: string } };
      const reportId = d.dailyReport?.id;
      if (!reportId) {
        router.push("/superintendent/monitoring/daily-reports");
        router.refresh();
        return;
      }

      const pending = values.pendingPhotos ?? [];
      if (pending.length > 0) {
        const upload = await uploadPendingDailyReportPhotos(reportId, pending);
        if (upload.error) {
          setError(
            `Report saved, but ${upload.uploaded}/${pending.length} photos uploaded: ${upload.error}`,
          );
          router.push(`/superintendent/monitoring/daily-reports/${reportId}/edit`);
          router.refresh();
          return;
        }
      }

      router.push(`/superintendent/monitoring/daily-reports/${reportId}/edit`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell size="wide">
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
