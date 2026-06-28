"use client";

import Link from "next/link";
import { EntityListPage } from "@/components/superintendent/EntityListPage";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";


export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string; reason: string | null; impactDays: number | null; responsibleParty: string | null; status: string;
};

export default function ListPage() {
  return (
    <PageShell>
      <PageHeader
        title="Delays"
        description="Open delay items and impact days."
        actions={
          <Button render={<Link href="/superintendent/monitoring/delays/new" />} nativeButton={false}>
            Add
          </Button>
        }
      />
      <EntityListPage<Row>
        title="Delays"
        description="Open delay items and impact days."
        apiPath="/api/superintendent/delays"
        newHref="/superintendent/monitoring/delays/new"
        editHref={(id) => `/superintendent/monitoring/delays/${id}/edit`}
        searchParam=""
        columns={[
          { header: "Title", cell: (row) => row.title },
          { header: "Impact days", cell: (row) => row.impactDays ?? '—' },
          { header: "Status", cell: (row) => row.status },
        ]}
      />
    </PageShell>
  );
}
