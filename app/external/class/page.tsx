import { ExternalPortalPage } from "@/components/external/ExternalPortalPage";
import { ExternalOversightPanel } from "@/components/external/ExternalPortalPanels";

export const dynamic = "force-dynamic";

export default function ClassPortalPage() {
  return (
    <ExternalPortalPage
      title="Class surveys"
      description="Read-only project scope, survey status, and approval submissions."
    >
      <ExternalOversightPanel />
    </ExternalPortalPage>
  );
}
