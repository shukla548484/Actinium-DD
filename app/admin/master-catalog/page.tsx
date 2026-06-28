import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { MasterCatalogPanel } from "@/components/admin/MasterCatalogPanel";

export const dynamic = "force-dynamic";

export default function AdminMasterCatalogPage() {
  return (
    <PageShell size="wide">
      <PageHeader
        title="Master spec catalog"
        description="Maintain standard docking, general service, and other spec lines. New tender projects inherit this catalog automatically."
      />
      <MasterCatalogPanel />
    </PageShell>
  );
}
