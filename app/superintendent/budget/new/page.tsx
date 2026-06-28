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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";


export const dynamic = "force-dynamic";

export default function NewPage() {
  const router = useRouter();
  const [projectId, setProjectId] = useState("");
  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/budget",
    "create",
    undefined,
    "/superintendent/budget",
  );

  return (
    <PageShell>
      <PageHeader title="New record" description="Budget vs quoted vs actual by category." />

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
              void submit({ dryDockProjectId: projectId, category: form.get("category") as string, description: (form.get("description") as string) || null, budgetAmount: Number(form.get("budgetAmount") || 0), quotedAmount: form.get("quotedAmount") ? Number(form.get("quotedAmount")) : null, actualAmount: form.get("actualAmount") ? Number(form.get("actualAmount")) : null });
            }}
          >

            <DryDockProjectSelect value={projectId} onChange={setProjectId} required />
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Input id="category" name="category" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="budgetAmount">Budget amount</Label>
                <Input id="budgetAmount" name="budgetAmount" type="number" defaultValue={0} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quotedAmount">Quoted</Label>
                <Input id="quotedAmount" name="quotedAmount" type="number" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actualAmount">Actual</Label>
                <Input id="actualAmount" name="actualAmount" type="number" />
              </div>
            </div>
            <EntityFormActions saving={saving} />
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
