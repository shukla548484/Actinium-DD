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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";


export const dynamic = "force-dynamic";

type Item = { id: string; category: string; description: string | null; budgetAmount: number; quotedAmount: number | null; actualAmount: number | null; approvalStatus: string; };



export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<Item | null>(null);
  
  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/budget",
    "edit",
    id,
    "/superintendent/budget",
  );

  useEffect(() => {
    void fetch(`/api/superintendent/budget/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const row = d.budgetLine;
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
      <PageHeader title="Edit record" description={item.category} />

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
              void submit({ category: form.get("category") as string, description: (form.get("description") as string) || null, budgetAmount: Number(form.get("budgetAmount") || 0), quotedAmount: form.get("quotedAmount") ? Number(form.get("quotedAmount")) : null, actualAmount: form.get("actualAmount") ? Number(form.get("actualAmount")) : null });
            }}
          >

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Input id="category" name="category" defaultValue={item.category} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} defaultValue={item.description ?? ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="budgetAmount">Budget amount</Label>
                <Input id="budgetAmount" name="budgetAmount" type="number" defaultValue={item.budgetAmount} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quotedAmount">Quoted</Label>
                <Input id="quotedAmount" name="quotedAmount" type="number" defaultValue={item.quotedAmount ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actualAmount">Actual</Label>
                <Input id="actualAmount" name="actualAmount" type="number" defaultValue={item.actualAmount ?? ""} />
              </div>
            </div>
            <EntityFormActions saving={saving} />
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
