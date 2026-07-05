import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { JobCatalogPanel } from "@/components/admin/JobCatalogPanel";

export const dynamic = "force-dynamic";

export default function AdminJobCatalogPage() {
  return (
    <PageShell size="wide">
      <PageHeader
        title="Job catalog schema"
        description="PostgreSQL tables aligned to workbook tabs 01–09 + Lists. Sync populates dynamic templates, measurements, checklists, scope steps, attachments, spares, RFQ mapping, and workflows."
      />
      <JobCatalogPanel />
    </PageShell>
  );
}
