"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import {
  EntityFormActions,
  useEntityFormSubmit,
} from "@/components/superintendent/EntityListPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { RISK_LEVEL_ITEMS } from "@/lib/superintendent/constants";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
export const dynamic = "force-dynamic";

type Item = { id: string; title: string; description: string | null; likelihood: string; impact: string; mitigation: string | null; owner: string | null; status: string; };



export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<Item | null>(null);
  const [likelihood, setLikelihood] = useState("medium"); const [impact, setImpact] = useState("medium");
  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/risks",
    "edit",
    id,
    "/superintendent/planning/risks",
  );

  useEffect(() => {
    void fetch(`/api/superintendent/risks/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const row = d.risk;
        if (row) {
          setItem(row);
          setLikelihood(row.likelihood); setImpact(row.impact);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

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
              void submit({ title: form.get("title") as string, description: (form.get("description") as string) || null, likelihood, impact, mitigation: (form.get("mitigation") as string) || null, owner: (form.get("owner") as string) || null, status: (form.get("status") as string) || item.status });
            }}
          >

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" defaultValue={item.title} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} defaultValue={item.description ?? ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Likelihood</Label>
                <LabeledSelect items={RISK_LEVEL_ITEMS} value={likelihood} onValueChange={(v) => setLikelihood(v || item.likelihood)} className="w-full" />
              </div>
              <div className="space-y-2">
                <Label>Impact</Label>
                <LabeledSelect items={RISK_LEVEL_ITEMS} value={impact} onValueChange={(v) => setImpact(v || item.impact)} className="w-full" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mitigation">Mitigation</Label>
              <Textarea id="mitigation" name="mitigation" rows={2} defaultValue={item.mitigation ?? ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="owner">Owner</Label>
                <Input id="owner" name="owner" defaultValue={item.owner ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Input id="status" name="status" defaultValue={item.status} />
              </div>
            </div>
            <EntityFormActions saving={saving} />
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
