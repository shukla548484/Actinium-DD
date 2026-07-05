import { ExternalPortalPage } from "@/components/external/ExternalPortalPage";
import { ExternalOversightPanel } from "@/components/external/ExternalPortalPanels";

export const dynamic = "force-dynamic";

export default function FlagPortalPage() {
  return (
    <ExternalPortalPage
      title="Flag state oversight"
      description="Statutory compliance, survey windows, and project visibility."
    >
      <ExternalOversightPanel />
    </ExternalPortalPage>
  );
}
