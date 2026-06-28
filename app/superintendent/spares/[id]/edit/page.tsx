"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import {
  EntityFormActions,
  useEntityFormSubmit,
} from "@/components/superintendent/EntityListPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerField, toDateInput } from "@/components/ui/DatePickerField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { SPARES_STATUS_ITEMS } from "@/lib/superintendent/constants";
export const dynamic = "force-dynamic";

type Item = { id: string; partName: string; partNumber: string | null; quantity: number; supplyType: string; status: string; requiredDate: string | null; notes: string | null; };

export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<Item | null>(null);
  const [status, setStatus] = useState("required");
  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/spares",
    "edit",
    id,
    "/superintendent/spares",
  );

  useEffect(() => {
    void fetch(`/api/superintendent/spares/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const row = d.sparesItem;
        if (row) {
          setItem(row);
          setStatus(row.status);
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
      <PageHeader title="Edit record" description={item.partName} />

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
              void submit({ partName: form.get("partName") as string, partNumber: (form.get("partNumber") as string) || null, quantity: Number(form.get("quantity") || 1), supplyType: (form.get("supplyType") as string) || item.supplyType, status, requiredDate: (form.get("requiredDate") as string) || null, notes: (form.get("notes") as string) || null });
            }}
          >

            <div className="space-y-2">
              <Label htmlFor="partName">Part name *</Label>
              <Input id="partName" name="partName" defaultValue={item.partName} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="partNumber">Part number</Label>
                <Input id="partNumber" name="partNumber" defaultValue={item.partNumber ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" name="quantity" type="number" defaultValue={item.quantity} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="supplyType">Supply type</Label>
                <Input id="supplyType" name="supplyType" defaultValue={item.supplyType} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <LabeledSelect items={SPARES_STATUS_ITEMS} value={status} onValueChange={(v) => setStatus(v || item.status)} className="w-full" />
              </div>
            </div>
            <DatePickerField
              id="requiredDate"
              name="requiredDate"
              label="Required date"
              defaultValue={toDateInput(item.requiredDate)}
            />
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} defaultValue={item.notes ?? ""} />
            </div>
            <EntityFormActions saving={saving} />
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
