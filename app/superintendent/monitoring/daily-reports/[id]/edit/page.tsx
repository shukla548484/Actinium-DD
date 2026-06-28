"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import {
  EntityFormActions,
  useEntityFormSubmit,
} from "@/components/superintendent/EntityListPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerField, toDateInput } from "@/components/ui/DatePickerField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fmtDate } from "@/lib/superintendent/formatters";

export const dynamic = "force-dynamic";

type Item = { id: string; reportDate: string; completedWork: string | null; plannedWork: string | null; manpowerCount: number | null; progressPct: number | null; safetyNotes: string | null; delayNotes: string | null; };

export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<Item | null>(null);
  
  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/daily-reports",
    "edit",
    id,
    "/superintendent/monitoring/daily-reports",
  );

  useEffect(() => {
    void fetch(`/api/superintendent/daily-reports/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const row = d.dailyReport;
        if (row) {
          setItem(row);
          
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Loading…</p>
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

  return (
    <PageShell>
      <PageHeader title="Edit record" description={fmtDate(item.reportDate)} />

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void submit({ reportDate: form.get("reportDate") as string, completedWork: (form.get("completedWork") as string) || null, plannedWork: (form.get("plannedWork") as string) || null, manpowerCount: form.get("manpowerCount") ? Number(form.get("manpowerCount")) : null, progressPct: form.get("progressPct") ? Number(form.get("progressPct")) : null });
            }}
          >

            <DatePickerField
              id="reportDate"
              name="reportDate"
              label="Report date *"
              defaultValue={toDateInput(item.reportDate)}
              required
            />
            <div className="space-y-2">
              <Label htmlFor="completedWork">Completed work</Label>
              <Textarea id="completedWork" name="completedWork" rows={2} defaultValue={item.completedWork ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plannedWork">Planned work</Label>
              <Textarea id="plannedWork" name="plannedWork" rows={2} defaultValue={item.plannedWork ?? ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manpowerCount">Manpower count</Label>
                <Input id="manpowerCount" name="manpowerCount" type="number" defaultValue={item.manpowerCount ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="progressPct">Progress %</Label>
                <Input id="progressPct" name="progressPct" type="number" min={0} max={100} defaultValue={item.progressPct ?? ""} />
              </div>
            </div>
            <EntityFormActions saving={saving} />
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
