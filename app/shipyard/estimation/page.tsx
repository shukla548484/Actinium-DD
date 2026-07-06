import { CostEstimationPanel } from "@/components/shipyard/CostEstimationPanel";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { listShipyardRfqQueue } from "@/lib/db/shipyardRfq";
import { shipyardModuleById } from "@/lib/shipyard/workflow";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ invite?: string }>;
};

export default async function CostEstimationPage({ searchParams }: PageProps) {
  const module = shipyardModuleById("cost_estimation")!;
  const { invite } = await searchParams;
  const inviteOptions = await listShipyardRfqQueue();

  return (
    <PageShell size="wide">
      <PageHeader title={module.label} description={module.description} />
      <CostEstimationPanel inviteOptions={inviteOptions} initialInviteId={invite} />
    </PageShell>
  );
}
