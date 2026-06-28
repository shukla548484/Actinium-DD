"use client";

import Link from "next/link";
import { EntityListPage } from "@/components/superintendent/EntityListPage";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/superintendent/formatters";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string; category: string | null; isCompleted: boolean; dueDate: string | null; assignedTo: string | null; notes: string | null;
};

export default function ListPage() {
  return (
    <PageShell>
      <PageHeader
        title="Pre-dock checklist"
        description="Readiness tasks before yard entry."
        actions={
          <Button render={<Link href="/superintendent/planning/checklist/new" />} nativeButton={false}>
            Add
          </Button>
        }
      />
      <EntityListPage<Row>
        title="Checklist items"
        description="Readiness tasks before yard entry."
        apiPath="/api/superintendent/checklist"
        newHref="/superintendent/planning/checklist/new"
        editHref={(id) => `/superintendent/planning/checklist/${id}/edit`}
        searchParam=""
        columns={[
          { header: "Title", cell: (row) => row.title },
          { header: "Category", cell: (row) => row.category ?? '—' },
          { header: "Completed", cell: (row) => row.isCompleted ? 'Yes' : 'No' },
          { header: "Due", cell: (row) => fmtDate(row.dueDate) },
        ]}
      />
    </PageShell>
  );
}
