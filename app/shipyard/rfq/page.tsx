import { QuotationRequestsInbox } from "@/components/shipyard/QuotationRequestsInbox";
import { RfqInboxPanel } from "@/components/shipyard/RfqInboxPanel";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { listShipyardEstimators, listShipyardRfqQueue } from "@/lib/db/shipyardRfq";
import {
  listQuotationRequestsForYard,
  resolveYardCompanyIdForSession,
} from "@/lib/db/shipyardQuotation";
import { getSessionUserId } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ShipyardRfqInboxPage() {
  const userId = await getSessionUserId();
  const yardCompanyId = await resolveYardCompanyIdForSession(userId);

  const [rows, estimators, quotationRows] = await Promise.all([
    listShipyardRfqQueue(),
    listShipyardEstimators(),
    yardCompanyId ? listQuotationRequestsForYard(yardCompanyId) : Promise.resolve([]),
  ]);

  return (
    <PageShell size="wide">
      <PageHeader
        title="RFQ & quotation inbox"
        description="Vessel-job quotation requests from ship access, plus classic tender RFQs from office projects."
      />
      <div className="space-y-8">
        <QuotationRequestsInbox rows={quotationRows} />
        <div>
          <h2 className="mb-3 text-base font-semibold">Classic tender RFQs</h2>
          <RfqInboxPanel rows={rows} estimators={estimators} />
        </div>
      </div>
    </PageShell>
  );
}
