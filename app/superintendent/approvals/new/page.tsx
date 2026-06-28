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
import { APPROVAL_TYPE_ITEMS, APPROVAL_STATUS_ITEMS } from "@/lib/superintendent/constants";
export const dynamic = "force-dynamic";

export default function NewPage() {
  const router = useRouter();
  const [projectId, setProjectId] = useState(""); const [approvalType, setApprovalType] = useState("budget"); const [status, setStatus] = useState("pending");
  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/approvals",
    "create",
    undefined,
    "/superintendent/approvals",
  );

  return (
    <PageShell>
      <PageHeader title="New record" description="Pending budget, scope, and VO approvals." />

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
              void submit({ dryDockProjectId: projectId, approvalType, title: form.get("title") as string, description: (form.get("description") as string) || null, amount: form.get("amount") ? Number(form.get("amount")) : null, status });
            }}
          >

            <DryDockProjectSelect value={projectId} onChange={setProjectId} required />
            <div className="space-y-2">
              <Label>Approval type</Label>
              <LabeledSelect items={APPROVAL_TYPE_ITEMS} value={approvalType} onValueChange={(v) => setApprovalType(v || "budget")} className="w-full" />
            </div>
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
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" name="amount" type="number" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <LabeledSelect items={APPROVAL_STATUS_ITEMS} value={status} onValueChange={(v) => setStatus(v || "pending")} className="w-full" />
              </div>
            </div>
            <EntityFormActions saving={saving} />
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
