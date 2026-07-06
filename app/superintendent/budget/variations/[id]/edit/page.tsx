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
import { APPROVAL_STATUS_ITEMS } from "@/lib/superintendent/constants";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
export const dynamic = "force-dynamic";

type Item = { id: string; voNumber: string | null; title: string; description: string | null; amount: number; approvalStatus: string; };



export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<Item | null>(null);
  const [approvalStatus, setApprovalStatus] = useState("pending");
  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/variations",
    "edit",
    id,
    "/superintendent/budget/variations",
  );

  useEffect(() => {
    void fetch(`/api/superintendent/variations/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const row = d.variation;
        if (row) {
          setItem(row);
          setApprovalStatus(row.approvalStatus);
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
              void submit({ voNumber: (form.get("voNumber") as string) || null, title: form.get("title") as string, description: (form.get("description") as string) || null, amount: Number(form.get("amount") || 0), approvalStatus });
            }}
          >

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="voNumber">VO number</Label>
                <Input id="voNumber" name="voNumber" defaultValue={item.voNumber ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" name="amount" type="number" defaultValue={item.amount} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" defaultValue={item.title} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} defaultValue={item.description ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>Approval status</Label>
              <LabeledSelect items={APPROVAL_STATUS_ITEMS} value={approvalStatus} onValueChange={(v) => setApprovalStatus(v || item.approvalStatus)} className="w-full" />
            </div>
            <EntityFormActions saving={saving} />
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
