"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import {
  JOB_CATEGORY_ITEMS,
  JOB_PRIORITY_ITEMS,
  VESSEL_JOB_SOURCE_ITEMS,
} from "@/lib/superintendent/constants";
import type { DdVesselJobDto } from "@/lib/superintendent/types";

type Props = {
  dryDockProjectId: string;
  vesselId?: string | null;
  readOnly?: boolean;
  /** API base path for vessel job bank (default: superintendent). */
  jobsApiBase?: string;
};

export function VesselJobSubmitForm({
  dryDockProjectId,
  vesselId,
  readOnly,
  jobsApiBase = "/api/superintendent/vessel-jobs",
}: Props) {
  const [category, setCategory] = useState("miscellaneous");
  const [priority, setPriority] = useState("medium");
  const [source, setSource] = useState("vessel");
  const [createdByName, setCreatedByName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<DdVesselJobDto[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const params = new URLSearchParams({
        dryDockProjectId,
        limit: "10",
        bankOnly: "true",
      });
      const res = await fetch(`${jobsApiBase}?${params}`);
      const data = (await res.json()) as { vesselJobs?: DdVesselJobDto[] };
      setRecent(data.vesselJobs ?? []);
    } finally {
      setLoadingRecent(false);
    }
  }, [dryDockProjectId, jobsApiBase]);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>, submit: boolean) {
    e.preventDefault();
    if (readOnly || !vesselId) return;

    setSaving(true);
    setError(null);
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch(jobsApiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vesselId,
          targetDryDockProjectId: dryDockProjectId,
          title: form.get("title"),
          category,
          priority,
          source,
          jobCode: (form.get("jobCode") as string) || null,
          workshop: (form.get("workshop") as string) || null,
          description: (form.get("description") as string) || null,
          createdByName: createdByName.trim() || null,
          createdByRole: "vessel",
          submit,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to save job");
        return;
      }
      formRef.current?.reset();
      await loadRecent();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (!vesselId) {
    return (
      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground">
          Loading vessel context…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Propose scope jobs (vessel job bank)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Jobs you submit here go to the vessel job bank. The superintendent reviews and
            selectively integrates them into the dry dock scope — they are not added automatically.
          </p>
          {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
          <form
            ref={formRef}
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit(e, true);
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vj-title">Title *</Label>
                <Input id="vj-title" name="title" required disabled={readOnly} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vj-jobCode">Job code</Label>
                <Input id="vj-jobCode" name="jobCode" disabled={readOnly} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Category *</Label>
                <LabeledSelect
                  items={JOB_CATEGORY_ITEMS}
                  value={category}
                  onValueChange={(v) => setCategory(v || "miscellaneous")}
                  className="w-full"
                />
              </div>
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
                <Label>Source</Label>
                <LabeledSelect
                  items={VESSEL_JOB_SOURCE_ITEMS}
                  value={source}
                  onValueChange={(v) => setSource(v || "vessel")}
                  className="w-full"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vj-workshop">Workshop / trade</Label>
              <Input id="vj-workshop" name="workshop" disabled={readOnly} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vj-description">Description</Label>
              <Textarea id="vj-description" name="description" rows={3} disabled={readOnly} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vj-name">Your name</Label>
              <Input
                id="vj-name"
                value={createdByName}
                onChange={(e) => setCreatedByName(e.target.value)}
                disabled={readOnly}
              />
            </div>
            {!readOnly ? (
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? "Submitting…" : "Submit to job bank"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => {
                    if (formRef.current) {
                      void handleSubmit(
                        { preventDefault: () => {}, currentTarget: formRef.current } as React.FormEvent<HTMLFormElement>,
                        false,
                      );
                    }
                  }}
                >
                  Save draft
                </Button>
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your vessel job bank submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRecent ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs submitted yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recent.map((job) => (
                <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2">
                  <span className="font-medium">{job.title}</span>
                  <span className="capitalize text-muted-foreground">{job.status.replace(/_/g, " ")}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
