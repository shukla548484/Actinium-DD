"use client";

import Link from "next/link";
import { EntityListPage } from "@/components/superintendent/EntityListPage";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/superintendent/formatters";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string; plannedDate: string | null; actualDate: string | null; status: string; notes: string | null;
};

export default function ListPage() {
  return (
    <PageShell>
      <PageHeader
        title="Milestones"
        description="Key dates and gate reviews."
        actions={
          <Button render={<Link href="/superintendent/planning/milestones/new" />} nativeButton={false}>
            Add
          </Button>
        }
      />
      <EntityListPage<Row>
        title="Milestones"
        description="Key dates and gate reviews."
        apiPath="/api/superintendent/milestones"
        newHref="/superintendent/planning/milestones/new"
        editHref={(id) => `/superintendent/planning/milestones/${id}/edit`}
        searchParam=""
        columns={[
          { header: "Title", cell: (row) => row.title },
          { header: "Planned", cell: (row) => fmtDate(row.plannedDate) },
          { header: "Status", cell: (row) => row.status },
        ]}
      />
    </PageShell>
  );
}
