import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ShipyardModulePlaceholder } from "@/components/shipyard/ShipyardModulePlaceholder";
import { shipyardModuleById } from "@/lib/shipyard/workflow";

export default function QaQcPage() {
  const module = shipyardModuleById("qa_qc")!;
  return (
    <PageShell size="wide">
      <PageHeader title={module.label} description={module.description} />
      <ShipyardModulePlaceholder module={module} />
    </PageShell>
  );
}
