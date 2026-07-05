import { OfficeModulePage } from "@/components/office/OfficeModulePage";
import { ExecutiveBudgetPanel } from "@/components/office/ExecutiveBudgetPanel";

export const dynamic = "force-dynamic";

export default function ExecutiveDashboardPage() {
  return (
    <OfficeModulePage
      title="Executive approvals"
      description="Approval inbox for MD and Technical Director — budgets, awards, and variations."
    >
      <ExecutiveBudgetPanel />
    </OfficeModulePage>
  );
}
