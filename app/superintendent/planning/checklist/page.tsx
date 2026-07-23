"use client";

import { PreDockChecklistPage } from "@/components/superintendent/PreDockChecklistPage";
import { PageHeader, PageShell } from "@/components/layout/PageShell";

export const dynamic = "force-dynamic";

export default function ListPage() {
  return (
    <PageShell>
      <PageHeader
        title="Pre-dock checklist"
        description="Readiness tasks before yard entry."
      />
      <PreDockChecklistPage />
    </PageShell>
  );
}
