import { OfficeModulePage } from "@/components/office/OfficeModulePage";
import { HseqDashboardPanel } from "@/components/office/HseqDashboardPanel";

export const dynamic = "force-dynamic";

export default function HseqDashboardPage() {
  return (
    <OfficeModulePage
      title="HSEQ"
      description="ISM compliance, incident tracking, audits, and safety KPIs."
    >
      <HseqDashboardPanel />
    </OfficeModulePage>
  );
}
