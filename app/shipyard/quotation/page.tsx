import { QuotationRequestsInbox } from "@/components/shipyard/QuotationRequestsInbox";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import {
  listQuotationRequestsForYard,
  resolveYardCompanyIdForSession,
} from "@/lib/db/shipyardQuotation";
import { getSessionUserId } from "@/lib/auth/session";
import { shipyardModuleById } from "@/lib/shipyard/workflow";

export const dynamic = "force-dynamic";

export default async function QuoteBuilderPage() {
  const module = shipyardModuleById("quote_builder")!;
  const userId = await getSessionUserId();
  const yardCompanyId = await resolveYardCompanyIdForSession(userId);
  const rows = yardCompanyId ? await listQuotationRequestsForYard(yardCompanyId) : [];

  return (
    <PageShell size="wide">
      <PageHeader
        title={module.label}
        description="Open a quotation request to price jobs, set T&Cs, and apply yard tariffs."
      />
      <QuotationRequestsInbox rows={rows} />
    </PageShell>
  );
}
