import Link from "next/link";
import { VesselListPanel } from "@/components/admin/VesselListPanel";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function AdminVesselsPage() {
  return (
    <PageShell size="wide">
      <PageHeader
        title="Vessel management"
        description="Register vessels under a company, manage status, and view crew assignments."
        actions={
          <Button render={<Link href="/admin/vessels/new" />} nativeButton={false}>
            Register vessel
          </Button>
        }
      />
      <VesselListPanel />
    </PageShell>
  );
}
