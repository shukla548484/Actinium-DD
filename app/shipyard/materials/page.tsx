import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ShipyardModulePlaceholder } from "@/components/shipyard/ShipyardModulePlaceholder";
import { shipyardModuleById } from "@/lib/shipyard/workflow";

export default function MaterialPlanningPage() {
  const module = shipyardModuleById("material_planning")!;
  return (
    <PageShell size="wide">
      <PageHeader title={module.label} description={module.description} />
      <ShipyardModulePlaceholder module={module} />
    </PageShell>
  );
}
