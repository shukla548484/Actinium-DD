"use client";

import Link from "next/link";
import { EntityListPage } from "@/components/superintendent/EntityListPage";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";


export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string; description: string | null; likelihood: string; impact: string; mitigation: string | null; owner: string | null; status: string;
};

export default function ListPage() {
  return (
    <PageShell>
      <PageHeader
        title="Risk register"
        description="Identified risks and mitigations."
        actions={
          <Button render={<Link href="/superintendent/planning/risks/new" />} nativeButton={false}>
            Add
          </Button>
        }
      />
      <EntityListPage<Row>
        title="Risks"
        description="Identified risks and mitigations."
        apiPath="/api/superintendent/risks"
        newHref="/superintendent/planning/risks/new"
        editHref={(id) => `/superintendent/planning/risks/${id}/edit`}
        searchParam=""
        columns={[
          { header: "Title", cell: (row) => row.title },
          { header: "Likelihood", cell: (row) => row.likelihood },
          { header: "Impact", cell: (row) => row.impact },
          { header: "Status", cell: (row) => row.status },
        ]}
      />
    </PageShell>
  );
}
