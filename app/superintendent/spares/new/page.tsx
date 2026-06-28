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
import { DatePickerField } from "@/components/ui/DatePickerField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { SPARES_STATUS_ITEMS } from "@/lib/superintendent/constants";
export const dynamic = "force-dynamic";

export default function NewPage() {
  const router = useRouter();
  const [projectId, setProjectId] = useState(""); const [status, setStatus] = useState("required");
  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/spares",
    "create",
    undefined,
    "/superintendent/spares",
  );

  return (
    <PageShell>
      <PageHeader title="New record" description="Required parts and delivery status." />

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
              void submit({ dryDockProjectId: projectId, partName: form.get("partName") as string, partNumber: (form.get("partNumber") as string) || null, quantity: Number(form.get("quantity") || 1), supplyType: (form.get("supplyType") as string) || "yard", status, requiredDate: (form.get("requiredDate") as string) || null, notes: (form.get("notes") as string) || null });
            }}
          >

            <DryDockProjectSelect value={projectId} onChange={setProjectId} required />
            <div className="space-y-2">
              <Label htmlFor="partName">Part name *</Label>
              <Input id="partName" name="partName" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="partNumber">Part number</Label>
                <Input id="partNumber" name="partNumber" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" name="quantity" type="number" defaultValue={1} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="supplyType">Supply type</Label>
                <Input id="supplyType" name="supplyType" defaultValue="yard" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <LabeledSelect items={SPARES_STATUS_ITEMS} value={status} onValueChange={(v) => setStatus(v || "required")} className="w-full" />
              </div>
            </div>
            <DatePickerField id="requiredDate" name="requiredDate" label="Required date" />
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
            <EntityFormActions saving={saving} />
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
