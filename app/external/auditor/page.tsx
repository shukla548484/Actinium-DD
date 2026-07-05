import { ExternalPortalPage } from "@/components/external/ExternalPortalPage";
import { ExternalOversightPanel } from "@/components/external/ExternalPortalPanels";

export const dynamic = "force-dynamic";

export default function AuditorPortalPage() {
  return (
    <ExternalPortalPage
      title="External audit"
      description="Read-only project access and compliance review."
    >
      <ExternalOversightPanel />
    </ExternalPortalPage>
  );
}
