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
import { RISK_LEVEL_ITEMS } from "@/lib/superintendent/constants";
export const dynamic = "force-dynamic";

export default function NewPage() {
  const router = useRouter();
  const [projectId, setProjectId] = useState(""); const [likelihood, setLikelihood] = useState("medium"); const [impact, setImpact] = useState("medium");
  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/risks",
    "create",
    undefined,
    "/superintendent/planning/risks",
  );

  return (
    <PageShell>
      <PageHeader title="New record" description="Identified risks and mitigations." />

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
              void submit({ dryDockProjectId: projectId, title: form.get("title") as string, description: (form.get("description") as string) || null, likelihood, impact, mitigation: (form.get("mitigation") as string) || null, owner: (form.get("owner") as string) || null, status: (form.get("status") as string) || "open" });
            }}
          >

            <DryDockProjectSelect value={projectId} onChange={setProjectId} required />
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Likelihood</Label>
                <LabeledSelect items={RISK_LEVEL_ITEMS} value={likelihood} onValueChange={(v) => setLikelihood(v || "medium")} className="w-full" />
              </div>
              <div className="space-y-2">
                <Label>Impact</Label>
                <LabeledSelect items={RISK_LEVEL_ITEMS} value={impact} onValueChange={(v) => setImpact(v || "medium")} className="w-full" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mitigation">Mitigation</Label>
              <Textarea id="mitigation" name="mitigation" rows={2} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="owner">Owner</Label>
                <Input id="owner" name="owner" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Input id="status" name="status" defaultValue="open" />
              </div>
            </div>
            <EntityFormActions saving={saving} />
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
