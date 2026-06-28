"use client";

import Link from "next/link";
import { EntityListPage } from "@/components/superintendent/EntityListPage";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/superintendent/formatters";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  voNumber: string | null; title: string; description: string | null; amount: number; approvalStatus: string;
};

export default function ListPage() {
  return (
    <PageShell>
      <PageHeader
        title="Variation orders"
        description="VO tracking and approval status."
        actions={
          <Button render={<Link href="/superintendent/budget/variations/new" />} nativeButton={false}>
            Add
          </Button>
        }
      />
      <EntityListPage<Row>
        title="Variations"
        description="VO tracking and approval status."
        apiPath="/api/superintendent/variations"
        newHref="/superintendent/budget/variations/new"
        editHref={(id) => `/superintendent/budget/variations/${id}/edit`}
        searchParam=""
        columns={[
          { header: "VO #", cell: (row) => row.voNumber ?? '—' },
          { header: "Title", cell: (row) => row.title },
          { header: "Amount", cell: (row) => fmtMoney(row.amount) },
          { header: "Status", cell: (row) => row.approvalStatus },
        ]}
      />
    </PageShell>
  );
}
