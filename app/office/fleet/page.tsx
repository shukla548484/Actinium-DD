import { OfficeModulePage } from "@/components/office/OfficeModulePage";
import { FleetDashboardPanel } from "@/components/office/FleetDashboardPanel";

export const dynamic = "force-dynamic";

export default function FleetDashboardPage() {
  return (
    <OfficeModulePage
      title="Fleet performance"
      description="Fleet KPIs, vessel utilization, and dry dock schedule overview."
    >
      <FleetDashboardPanel />
    </OfficeModulePage>
  );
}
