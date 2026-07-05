import { ExternalPortalPage } from "@/components/external/ExternalPortalPage";
import { ExternalOversightPanel } from "@/components/external/ExternalPortalPanels";

export const dynamic = "force-dynamic";

export default function OwnerPortalPage() {
  return (
    <ExternalPortalPage
      title="Owner oversight"
      description="Project dashboard, budget summary, and decision approvals."
    >
      <ExternalOversightPanel />
    </ExternalPortalPage>
  );
}
