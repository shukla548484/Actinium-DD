import { RfqInboxPanel } from "@/components/shipyard/RfqInboxPanel";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { listShipyardEstimators, listShipyardRfqQueue } from "@/lib/db/shipyardRfq";

export const dynamic = "force-dynamic";

export default async function ShipyardRfqInboxPage() {
  const [rows, estimators] = await Promise.all([
    listShipyardRfqQueue(),
    listShipyardEstimators(),
  ]);

  return (
    <PageShell size="wide">
      <PageHeader
        title="RFQ inbox"
        description="Receive RFQ → Review → Assign estimator → Cost estimate → Internal approval → Submit quotation. Populated when office issues yard invites from Projects."
      />
      <RfqInboxPanel rows={rows} estimators={estimators} />
    </PageShell>
  );
}
