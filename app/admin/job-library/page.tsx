import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { JobLibraryPanel } from "@/components/admin/JobLibraryPanel";
import { MtilProgressPanel } from "@/components/admin/MtilProgressPanel";

export const dynamic = "force-dynamic";

export default function AdminJobLibraryPage() {
  return (
    <PageShell size="wide">
      <PageHeader
        title="Dry dock job library (MTIL)"
        description="Marine Technical Intelligence Library — master hierarchy generated from structured data and dynamic templates."
      />
      <MtilProgressPanel />
      <JobLibraryPanel />
    </PageShell>
  );
}
