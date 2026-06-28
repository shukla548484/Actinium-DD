"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import {
  EntityFormActions,
  useEntityFormSubmit,
} from "@/components/superintendent/EntityListPage";
import { JobAttachmentsPanel } from "@/components/superintendent/JobAttachmentsPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { JOB_CATEGORY_ITEMS, JOB_PRIORITY_ITEMS, JOB_STATUS_ITEMS } from "@/lib/superintendent/constants";
export const dynamic = "force-dynamic";

type Item = { id: string; title: string; category: string; priority: string; status: string; dryDockProjectId: string; jobCode: string | null; workshop: string | null; description: string | null; };



export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<Item | null>(null);
  const [category, setCategory] = useState("miscellaneous"); const [priority, setPriority] = useState("medium"); const [status, setStatus] = useState("planned");
  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/jobs",
    "edit",
    id,
    "/superintendent/jobs",
  );

  useEffect(() => {
    void fetch(`/api/superintendent/jobs/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const row = d.job;
        if (row) {
          setItem(row);
          setCategory(row.category); setPriority(row.priority); setStatus(row.status);
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
      <PageHeader title="Edit record" description={item.title} />

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
              void submit({ title: form.get("title") as string, category, priority, status, jobCode: (form.get("jobCode") as string) || null, workshop: (form.get("workshop") as string) || null, description: (form.get("description") as string) || null });
            }}
          >

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" defaultValue={item.title} required />
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <LabeledSelect items={JOB_CATEGORY_ITEMS} value={category} onValueChange={(v) => setCategory(v || item.category)} className="w-full" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Priority</Label>
                <LabeledSelect items={JOB_PRIORITY_ITEMS} value={priority} onValueChange={(v) => setPriority(v || item.priority)} className="w-full" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <LabeledSelect items={JOB_STATUS_ITEMS} value={status} onValueChange={(v) => setStatus(v || item.status)} className="w-full" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobCode">Job code</Label>
              <Input id="jobCode" name="jobCode" defaultValue={item.jobCode ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workshop">Workshop</Label>
              <Input id="workshop" name="workshop" defaultValue={item.workshop ?? ""} placeholder="e.g. Hull, Machinery, Electrical" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} defaultValue={item.description ?? ""} />
            </div>
            <EntityFormActions saving={saving} />
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Photos & attachments</CardTitle>
        </CardHeader>
        <CardContent>
          <JobAttachmentsPanel jobId={id} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
