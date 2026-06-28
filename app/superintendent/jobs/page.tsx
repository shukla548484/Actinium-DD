"use client";

import Link from "next/link";
import { EntityListPage } from "@/components/superintendent/EntityListPage";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";


export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string; category: string; priority: string; status: string; dryDockProjectId: string; jobCode: string | null; description: string | null;
};

export default function ListPage() {
  return (
    <PageShell>
      <PageHeader
        title="Job list"
        description="Scope jobs by category and status."
        actions={
          <>
            <Button
              variant="outline"
              render={<Link href="/superintendent/jobs/import" />}
              nativeButton={false}
            >
              Import Excel
            </Button>
            <Button render={<Link href="/superintendent/jobs/new" />} nativeButton={false}>
              Add
            </Button>
          </>
        }
      />
      <EntityListPage<Row>
        title="Jobs"
        description="Scope jobs by category and status."
        apiPath="/api/superintendent/jobs"
        newHref="/superintendent/jobs/new"
        editHref={(id) => `/superintendent/jobs/${id}/edit`}
        searchParam=""
        columns={[
          { header: "Title", cell: (row) => row.title },
          { header: "Category", cell: (row) => row.category },
          { header: "Priority", cell: (row) => row.priority },
          { header: "Status", cell: (row) => row.status.replace(/_/g, ' ') },
          { header: "Project", cell: (row) => row.dryDockProjectId },
        ]}
      />
    </PageShell>
  );
}
