"use client";

import Link from "next/link";
import { EntityListPage } from "@/components/superintendent/EntityListPage";
import { useActiveDryDockProject } from "@/components/superintendent/ActiveDryDockProjectProvider";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { fmtMoneyWithCurrency } from "@/lib/superintendent/formatters";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  category: string;
  description: string | null;
  currency: string;
  budgetAmount: number;
  quotedAmount: number | null;
  actualAmount: number | null;
  budgetAmountUsd: number | null;
  quotedAmountUsd: number | null;
  actualAmountUsd: number | null;
  approvalStatus: string;
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
        title="Budget lines"
        description="Budget vs quoted vs actual by category."
        actions={
          <Button
            render={<Link href={withProjectQuery("/superintendent/budget/new", activeProjectId)} />}
            nativeButton={false}
          >
            Add
          </Button>
        }
      />
      <EntityListPage<Row>
        title="Budget lines"
        description="Budget vs quoted vs actual by category."
        apiPath="/api/superintendent/budget"
        newHref={withProjectQuery("/superintendent/budget/new", activeProjectId)}
        editHref={(id) => `/superintendent/budget/${id}/edit`}
        searchParam=""
        columns={[
          { header: "Category", cell: (row) => row.category },
          {
            header: "Budget",
            cell: (row) =>
              fmtMoneyWithCurrency(row.budgetAmount, row.currency, row.budgetAmountUsd),
          },
          {
            header: "Quoted",
            cell: (row) =>
              fmtMoneyWithCurrency(row.quotedAmount, row.currency, row.quotedAmountUsd),
          },
          {
            header: "Actual",
            cell: (row) =>
              fmtMoneyWithCurrency(row.actualAmount, row.currency, row.actualAmountUsd),
          },
        ]}
      />
    </PageShell>
  );
}
