"use client";

import Link from "next/link";
import { EntityListPage } from "@/components/superintendent/EntityListPage";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtPct } from "@/lib/superintendent/formatters";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  reportDate: string; completedWork: string | null; plannedWork: string | null; manpowerCount: number | null; progressPct: number | null; safetyNotes: string | null; delayNotes: string | null;
};

export default function ListPage() {
  return (
    <PageShell>
      <PageHeader
        title="Daily reports"
        description="Yard daily progress and manpower."
        actions={
          <Button render={<Link href="/superintendent/monitoring/daily-reports/new" />} nativeButton={false}>
            Add
          </Button>
        }
      />
      <EntityListPage<Row>
        title="Daily reports"
        description="Yard daily progress and manpower."
        apiPath="/api/superintendent/daily-reports"
        newHref="/superintendent/monitoring/daily-reports/new"
        editHref={(id) => `/superintendent/monitoring/daily-reports/${id}/edit`}
        searchParam=""
        columns={[
          { header: "Date", cell: (row) => fmtDate(row.reportDate) },
          { header: "Progress", cell: (row) => fmtPct(row.progressPct) },
          { header: "Manpower", cell: (row) => row.manpowerCount ?? '—' },
        ]}
      />
    </PageShell>
  );
}
