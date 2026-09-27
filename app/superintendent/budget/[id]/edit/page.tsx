"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import {
  EntityFormActions,
  useEntityFormSubmit,
} from "@/components/superintendent/EntityListPage";
import {
  BudgetLineCurrencyFields,
  parseBudgetLineCurrencyForm,
} from "@/components/superintendent/BudgetLineCurrencyFields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

export const dynamic = "force-dynamic";

type Item = {
  id: string;
  dryDockProjectId: string;
  category: string;
  description: string | null;
  currency: string;
  exchangeRateLocalPerUsd: number | null;
  budgetAmount: number;
  quotedAmount: number | null;
  actualAmount: number | null;
  approvalStatus: string;
};

export default function EditPage() {
  const { id } = useParams<{ id: string }>();
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
              const amounts = parseBudgetLineCurrencyForm(form);
              void submit({
                category: form.get("category") as string,
                description: (form.get("description") as string) || null,
                ...amounts,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Input id="category" name="category" defaultValue={item.category} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={2}
                defaultValue={item.description ?? ""}
              />
            </div>
            <BudgetLineCurrencyFields
              dryDockProjectId={item.dryDockProjectId}
              initial={{
                currency: item.currency || "USD",
                exchangeRateLocalPerUsd: item.exchangeRateLocalPerUsd,
                budgetAmount: item.budgetAmount,
                quotedAmount: item.quotedAmount,
                actualAmount: item.actualAmount,
              }}
            />
            <EntityFormActions saving={saving} />
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
