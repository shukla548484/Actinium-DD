"use client";

import Link from "next/link";
import { EntityListPage } from "@/components/superintendent/EntityListPage";
import { useActiveDryDockProject } from "@/components/superintendent/ActiveDryDockProjectProvider";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  dryDockProjectId: string;
  projectName?: string | null;
  jobCode: string | null;
  description: string | null;
};

function withProjectQuery(href: string, projectId: string | null) {
  if (!projectId) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}dryDockProjectId=${encodeURIComponent(projectId)}`;
}

export default function ListPage() {
  const { activeProjectId } = useActiveDryDockProject();

  return (
    <PageShell>
      <PageHeader
        title="Job list"
        description="Scope jobs by category and status."
        actions={
          <>
            <Button
              variant="outline"
              render={<Link href={withProjectQuery("/superintendent/jobs/import", activeProjectId)} />}
              nativeButton={false}
            >
              Import Excel
            </Button>
            <Button
              render={<Link href={withProjectQuery("/superintendent/jobs/new", activeProjectId)} />}
              nativeButton={false}
            >
              Add
            </Button>
          </>
        }
      />
      <EntityListPage<Row>
        title="Jobs"
        description="Scope jobs by category and status."
        apiPath="/api/superintendent/jobs"
        newHref={withProjectQuery("/superintendent/jobs/new", activeProjectId)}
        editHref={(id) => `/superintendent/jobs/${id}/edit`}
        searchParam=""
        columns={[
          { header: "Title", cell: (row) => row.title },
          { header: "Category", cell: (row) => row.category },
          { header: "Priority", cell: (row) => row.priority },
          { header: "Status", cell: (row) => row.status.replace(/_/g, " ") },
          { header: "Project", cell: (row) => row.projectName?.trim() || "—" },
        ]}
      />
    </PageShell>
  );
}
