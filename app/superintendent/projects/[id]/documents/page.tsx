"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChecklistAttachmentsPanel } from "@/components/superintendent/ChecklistAttachmentsPanel";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { fmtDate } from "@/lib/superintendent/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

export const dynamic = "force-dynamic";

type DocItem = {
  id: string;
  title: string;
  category: string | null;
  isCompleted: boolean;
  dueDate: string | null;
  notes: string | null;
  attachmentCount: number;
};

export default function ProjectDocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [rfqSteps, setRfqSteps] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/superintendent/projects/${id}/documents`)
      .then((r) => r.json())
      .then((d: { documents?: DocItem[]; rfqSteps?: DocItem[] }) => {
        setDocuments(d.documents ?? []);
        setRfqSteps(d.rfqSteps ?? []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  function ItemList({ items, emptyLabel }: { items: DocItem[]; emptyLabel: string }) {
    if (items.length === 0) {
      return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
    }
    return (
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-md border text-sm">
            <div className="flex items-start gap-3 px-3 py-2">
              <Checkbox checked={item.isCompleted} disabled className="mt-0.5" />
              <div className="flex-1">
                <Link
                  href={`/superintendent/planning/checklist/${item.id}/edit?dryDockProjectId=${encodeURIComponent(id)}`}
                  className="font-medium text-primary hover:underline"
                >
                  {item.title}
                </Link>
                {item.dueDate ? (
                  <p className="text-xs text-muted-foreground">Due {fmtDate(item.dueDate)}</p>
                ) : null}
                <button
                  type="button"
                  className="mt-1 text-xs text-primary hover:underline"
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  {expandedId === item.id ? "Hide files" : `Files (${item.attachmentCount})`}
                </button>
              </div>
            </div>
            {expandedId === item.id ? (
              <div className="border-t bg-muted/20 px-3 py-3">
                <ChecklistAttachmentsPanel checklistItemId={item.id} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Documents"
        description="Required documents with file uploads for this project."
      />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Required documents</CardTitle>
            </CardHeader>
            <CardContent>
              <ItemList items={documents} emptyLabel="No document requirements." />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">RFQ structure</CardTitle>
            </CardHeader>
            <CardContent>
              <ItemList items={rfqSteps} emptyLabel="No RFQ steps defined." />
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
