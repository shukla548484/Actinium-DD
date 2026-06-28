"use client";

import Link from "next/link";
import { EntityListPage } from "@/components/superintendent/EntityListPage";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/superintendent/formatters";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  surveyType: string; title: string; description: string | null; dueDate: string | null; status: string; classReference: string | null;
};

export default function ListPage() {
  return (
    <PageShell>
      <PageHeader
        title="Class surveys"
        description="Survey items and class references."
        actions={
          <Button render={<Link href="/superintendent/survey/new" />} nativeButton={false}>
            Add
          </Button>
        }
      />
      <EntityListPage<Row>
        title="Survey items"
        description="Survey items and class references."
        apiPath="/api/superintendent/survey"
        newHref="/superintendent/survey/new"
        editHref={(id) => `/superintendent/survey/${id}/edit`}
        searchParam=""
        columns={[
          { header: "Type", cell: (row) => row.surveyType.replace(/_/g, ' ') },
          { header: "Title", cell: (row) => row.title },
          { header: "Status", cell: (row) => row.status },
          { header: "Due", cell: (row) => fmtDate(row.dueDate) },
        ]}
      />
    </PageShell>
  );
}
