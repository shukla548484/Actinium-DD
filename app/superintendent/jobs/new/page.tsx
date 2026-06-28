"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import {
  EntityFormActions,
  useEntityFormSubmit,
} from "@/components/superintendent/EntityListPage";
import { DryDockProjectSelect } from "@/components/superintendent/DryDockProjectSelect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { JOB_CATEGORY_ITEMS, JOB_PRIORITY_ITEMS, JOB_STATUS_ITEMS } from "@/lib/superintendent/constants";
export const dynamic = "force-dynamic";

export default function NewPage() {
  const router = useRouter();
  const [projectId, setProjectId] = useState(""); const [category, setCategory] = useState("miscellaneous"); const [priority, setPriority] = useState("medium"); const [status, setStatus] = useState("planned");
  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/jobs",
    "create",
    undefined,
    "/superintendent/jobs",
  );

  return (
    <PageShell>
      <PageHeader title="New record" description="Scope jobs by category and status." />

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
              void submit({ dryDockProjectId: projectId, title: form.get("title") as string, category, priority, status, jobCode: (form.get("jobCode") as string) || null, workshop: (form.get("workshop") as string) || null, description: (form.get("description") as string) || null });
            }}
          >

            <DryDockProjectSelect value={projectId} onChange={setProjectId} required />
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <LabeledSelect
                items={JOB_CATEGORY_ITEMS}
                value={category}
                onValueChange={(v) => setCategory(v || "miscellaneous")}
                className="w-full"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Priority</Label>
                <LabeledSelect
                  items={JOB_PRIORITY_ITEMS}
                  value={priority}
                  onValueChange={(v) => setPriority(v || "medium")}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <LabeledSelect
                  items={JOB_STATUS_ITEMS}
                  value={status}
                  onValueChange={(v) => setStatus(v || "planned")}
                  className="w-full"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobCode">Job code</Label>
              <Input id="jobCode" name="jobCode" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workshop">Workshop</Label>
              <Input id="workshop" name="workshop" placeholder="e.g. Hull, Machinery, Electrical" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>
            <EntityFormActions saving={saving} />
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
