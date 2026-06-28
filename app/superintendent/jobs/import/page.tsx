"use client";

import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { JobImportPanel } from "@/components/superintendent/JobImportPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function JobImportPage() {
  return (
    <PageShell>
      <PageHeader
        title="Import jobs from Excel"
        description="Upload a spreadsheet to bulk-create scope jobs on a dry dock project."
      />
      <Card>
        <CardHeader>
          <CardTitle>Spreadsheet import</CardTitle>
        </CardHeader>
        <CardContent>
          <JobImportPanel />
        </CardContent>
      </Card>
    </PageShell>
  );
}
