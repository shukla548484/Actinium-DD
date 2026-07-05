import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { VesselSelectPanel } from "@/components/admin/VesselSelectPanel";

export const dynamic = "force-dynamic";

export default function CrewCredentialsPage() {
  return (
    <PageShell>
      <PageHeader
        title="Crew credentials"
        description="Select a vessel, create onboard login credentials, then assign which pages each crew member can access."
      />
      <VesselSelectPanel />
    </PageShell>
  );
}
