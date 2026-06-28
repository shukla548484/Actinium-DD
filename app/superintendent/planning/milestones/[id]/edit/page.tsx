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

export const dynamic = "force-dynamic";

type Item = {
  id: string;
  title: string;
  dryDockProjectId: string;
  plannedDate: string | null;
  baselineDate: string | null;
  actualDate: string | null;
  status: string;
  notes: string | null;
  dependsOnMilestoneId: string | null;
};

type MilestoneOption = { id: string; title: string };

export default function EditMilestonePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<Item | null>(null);
  const [siblings, setSiblings] = useState<MilestoneOption[]>([]);
  const [dependsOnId, setDependsOnId] = useState<string>("");

  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/milestones",
    "edit",
    id,
    "/superintendent/planning/milestones",
  );

  useEffect(() => {
    void fetch(`/api/superintendent/milestones/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const row = d.milestone as Item | undefined;
        if (row) {
          setItem(row);
          setDependsOnId(row.dependsOnMilestoneId ?? "");
          void fetch(
            `/api/superintendent/milestones?dryDockProjectId=${encodeURIComponent(row.dryDockProjectId)}&limit=100`,
          )
            .then((r2) => r2.json())
            .then((d2: { items?: MilestoneOption[] }) => {
              setSiblings((d2.items ?? []).filter((m) => m.id !== row.id));
            });
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
      <PageHeader title="Edit milestone" description={item.title} />

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
              void submit({
                title: form.get("title") as string,
                plannedDate: (form.get("plannedDate") as string) || null,
                baselineDate: (form.get("baselineDate") as string) || null,
                actualDate: (form.get("actualDate") as string) || null,
                status: (form.get("status") as string) || item.status,
                notes: (form.get("notes") as string) || null,
                dependsOnMilestoneId: dependsOnId || null,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" defaultValue={item.title} required />
            </div>
            <div className="space-y-2">
              <Label>Depends on</Label>
              <Select
                value={dependsOnId || "__none__"}
                onValueChange={(v) => setDependsOnId(v === "__none__" ? "" : (v ?? ""))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No dependency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (root milestone)</SelectItem>
                  {siblings.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <DatePickerField
                id="baselineDate"
                name="baselineDate"
                label="Baseline date"
                defaultValue={toDateInput(item.baselineDate)}
              />
              <DatePickerField
                id="plannedDate"
                name="plannedDate"
                label="Planned date"
                defaultValue={toDateInput(item.plannedDate)}
              />
              <DatePickerField
                id="actualDate"
                name="actualDate"
                label="Actual date"
                defaultValue={toDateInput(item.actualDate)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Input id="status" name="status" defaultValue={item.status} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} defaultValue={item.notes ?? ""} />
            </div>
            <EntityFormActions saving={saving} />
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
