import { OfficeModulePage } from "@/components/office/OfficeModulePage";
import { CrewingDashboardPanel } from "@/components/office/CrewingDashboardPanel";

export const dynamic = "force-dynamic";

export default function CrewingDashboardPage() {
  return (
    <OfficeModulePage
      title="Crewing"
      description="Crew matrix, certification expiry, and manning levels."
    >
      <CrewingDashboardPanel />
    </OfficeModulePage>
  );
}
