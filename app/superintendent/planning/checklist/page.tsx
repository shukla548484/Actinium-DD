"use client";

import { PreDockChecklistPage } from "@/components/superintendent/PreDockChecklistPage";
import { PageHeader, PageShell } from "@/components/layout/PageShell";

export const dynamic = "force-dynamic";

export default function ListPage() {
  return (
    <PageShell>
      <PageHeader title="Class status upload" />
      <PreDockChecklistPage />
    </PageShell>
  );
}
