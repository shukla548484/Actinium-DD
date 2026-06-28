"use client";

import Link from "next/link";
import { EntityListPage } from "@/components/superintendent/EntityListPage";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/superintendent/formatters";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  approvalType: string; title: string; description: string | null; amount: number | null; status: string;
};

export default function ListPage() {
  return (
    <PageShell>
      <PageHeader
        title="Approval requests"
        description="Pending budget, scope, and VO approvals."
        actions={
          <Button render={<Link href="/superintendent/approvals/new" />} nativeButton={false}>
            Add
          </Button>
        }
      />
      <EntityListPage<Row>
        title="Approvals"
        description="Pending budget, scope, and VO approvals."
        apiPath="/api/superintendent/approvals"
        newHref="/superintendent/approvals/new"
        editHref={(id) => `/superintendent/approvals/${id}/edit`}
        searchParam=""
        columns={[
          { header: "Type", cell: (row) => row.approvalType.replace(/_/g, ' ') },
          { header: "Title", cell: (row) => row.title },
          { header: "Amount", cell: (row) => fmtMoney(row.amount) },
          { header: "Status", cell: (row) => row.status },
        ]}
      />
    </PageShell>
  );
}
