"use client";

import Link from "next/link";
import { EntityListPage } from "@/components/superintendent/EntityListPage";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { DAILY_REPORT_SECTION_KEYS } from "@/lib/superintendent/dailyReportSections";
import { fmtDate, fmtPct } from "@/lib/superintendent/formatters";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  reportDate: string;
  weatherCondition: string | null;
  progressPct: number | null;
  sectionsFilled?: number;
  attachmentCount?: number;
};

export default function ListPage() {
  return (
    <PageShell>
      <PageHeader
        title="Daily reports"
        description="One report per project day — weather, six work sections, and photos."
        actions={
          <Button render={<Link href="/superintendent/monitoring/daily-reports/new" />} nativeButton={false}>
            Add
          </Button>
        }
      />
      <EntityListPage<Row>
        title="Daily reports"
        description="One report per project day — weather, six work sections, and photos."
        apiPath="/api/superintendent/daily-reports"
        newHref="/superintendent/monitoring/daily-reports/new"
        editHref={(id) => `/superintendent/monitoring/daily-reports/${id}/edit`}
        searchParam="search"
        columns={[
          { header: "Date", cell: (row) => fmtDate(row.reportDate) },
          { header: "Weather", cell: (row) => row.weatherCondition?.trim() || "—" },
          {
            header: "Sections",
            cell: (row) =>
              `${row.sectionsFilled ?? 0}/${DAILY_REPORT_SECTION_KEYS.length}`,
          },
          {
            header: "Images",
            cell: (row) => String(row.attachmentCount ?? 0),
          },
          { header: "Progress", cell: (row) => fmtPct(row.progressPct) },
        ]}
      />
    </PageShell>
  );
}
