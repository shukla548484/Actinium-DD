"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { fmtDate } from "@/lib/superintendent/formatters";
import { resolveModuleMeta } from "@/lib/superintendent/engine/projectModules";
import type { ModuleChecklistKey } from "@/lib/superintendent/engine/moduleChecklist";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

type ChecklistItem = {
  id: string;
  title: string;
  category: string | null;
  isCompleted: boolean;
  dueDate: string | null;
  attachmentCount: number;
};

type Props = {
  moduleKey: ModuleChecklistKey;
  embedded?: boolean;
};

export function ProjectChecklistModulePage({ moduleKey, embedded }: Props) {
  const { id } = useParams<{ id: string }>();
  const meta = resolveModuleMeta(moduleKey);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [total, setTotal] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch(`/api/superintendent/projects/${id}/checklist-module?module=${moduleKey}`)
      .then((r) => r.json())
      .then((d: { items?: ChecklistItem[]; total?: number; completed?: number }) => {
        setItems(d.items ?? []);
        setTotal(d.total ?? 0);
        setCompleted(d.completed ?? 0);
      })
      .finally(() => setLoading(false));
  }, [id, moduleKey]);

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const content = (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Checklist completion {completed}/{total} ({pct}%)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No checklist items in this module yet. Add items with categories matching this module.
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <Checkbox checked={item.isCompleted} disabled className="mt-0.5" />
                  <div className="flex-1">
                    <Link
                      href={`/superintendent/planning/checklist/${item.id}/edit?dryDockProjectId=${encodeURIComponent(id)}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {item.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {item.category ?? "Uncategorised"}
                      {item.dueDate ? ` · Due ${fmtDate(item.dueDate)}` : ""}
                      {item.attachmentCount > 0
                        ? ` · ${item.attachmentCount} file(s)`
                        : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );

  if (embedded) {
    if (loading) return <p className="text-sm text-muted-foreground">Loading checklist…</p>;
    return content;
  }

  return (
    <PageShell>
      <PageHeader
        title={meta.label}
        description={meta.description}
        actions={
          <Button
            size="sm"
            render={
              <Link
                href={`/superintendent/planning/checklist/new?dryDockProjectId=${encodeURIComponent(id)}`}
              />
            }
            nativeButton={false}
          >
            Add item
          </Button>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        content
      )}
    </PageShell>
  );
}
