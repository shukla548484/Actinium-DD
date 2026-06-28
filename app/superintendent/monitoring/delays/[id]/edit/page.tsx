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

type Item = { id: string; title: string; reason: string | null; impactDays: number | null; responsibleParty: string | null; status: string; };



export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<Item | null>(null);
  
  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/delays",
    "edit",
    id,
    "/superintendent/monitoring/delays",
  );

  useEffect(() => {
    void fetch(`/api/superintendent/delays/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const row = d.delay;
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
              void submit({ title: form.get("title") as string, reason: (form.get("reason") as string) || null, impactDays: form.get("impactDays") ? Number(form.get("impactDays")) : null, responsibleParty: (form.get("responsibleParty") as string) || null, status: (form.get("status") as string) || item.status });
            }}
          >

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" defaultValue={item.title} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea id="reason" name="reason" rows={2} defaultValue={item.reason ?? ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="impactDays">Impact days</Label>
                <Input id="impactDays" name="impactDays" type="number" defaultValue={item.impactDays ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Input id="status" name="status" defaultValue={item.status} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsibleParty">Responsible party</Label>
              <Input id="responsibleParty" name="responsibleParty" defaultValue={item.responsibleParty ?? ""} />
            </div>
            <EntityFormActions saving={saving} />
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
