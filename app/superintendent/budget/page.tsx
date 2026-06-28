"use client";

import Link from "next/link";
import { EntityListPage } from "@/components/superintendent/EntityListPage";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/superintendent/formatters";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  category: string; description: string | null; budgetAmount: number; quotedAmount: number | null; actualAmount: number | null; approvalStatus: string;
};

export default function ListPage() {
  return (
    <PageShell>
      <PageHeader
        title="Budget lines"
        description="Budget vs quoted vs actual by category."
        actions={
          <Button render={<Link href="/superintendent/budget/new" />} nativeButton={false}>
            Add
          </Button>
        }
      />
      <EntityListPage<Row>
        title="Budget lines"
        description="Budget vs quoted vs actual by category."
        apiPath="/api/superintendent/budget"
        newHref="/superintendent/budget/new"
        editHref={(id) => `/superintendent/budget/${id}/edit`}
        searchParam=""
        columns={[
          { header: "Category", cell: (row) => row.category },
          { header: "Budget", cell: (row) => fmtMoney(row.budgetAmount) },
          { header: "Quoted", cell: (row) => fmtMoney(row.quotedAmount) },
          { header: "Actual", cell: (row) => fmtMoney(row.actualAmount) },
        ]}
      />
    </PageShell>
  );
}
