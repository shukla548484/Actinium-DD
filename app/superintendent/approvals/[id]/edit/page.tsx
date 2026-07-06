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
import { APPROVAL_TYPE_ITEMS, APPROVAL_STATUS_ITEMS } from "@/lib/superintendent/constants";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
export const dynamic = "force-dynamic";

type Item = { id: string; approvalType: string; title: string; description: string | null; amount: number | null; status: string; };



export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<Item | null>(null);
  const [approvalType, setApprovalType] = useState("budget"); const [status, setStatus] = useState("pending");
  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/approvals",
    "edit",
    id,
    "/superintendent/approvals",
  );

  useEffect(() => {
    void fetch(`/api/superintendent/approvals/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const row = d.approval;
        if (row) {
          setItem(row);
          setApprovalType(row.approvalType); setStatus(row.status);
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
              void submit({ approvalType, title: form.get("title") as string, description: (form.get("description") as string) || null, amount: form.get("amount") ? Number(form.get("amount")) : null, status });
            }}
          >

            <div className="space-y-2">
              <Label>Approval type</Label>
              <LabeledSelect items={APPROVAL_TYPE_ITEMS} value={approvalType} onValueChange={(v) => setApprovalType(v || item.approvalType)} className="w-full" />
            </div>
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
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" name="amount" type="number" defaultValue={item.amount ?? ""} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <LabeledSelect items={APPROVAL_STATUS_ITEMS} value={status} onValueChange={(v) => setStatus(v || item.status)} className="w-full" />
              </div>
            </div>
            <EntityFormActions saving={saving} />
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
