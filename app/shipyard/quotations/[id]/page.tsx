import { QuotationWorkspace } from "@/components/shipyard/QuotationWorkspace";
import { PageHeader, PageShell } from "@/components/layout/PageShell";

export const dynamic = "force-dynamic";

export default async function ShipyardQuotationWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PageShell size="wide">
      <PageHeader
        title="Quotation workspace"
        description="Vessel details, timeline, job pricing, terms, and tariff snapshot."
      />
      <QuotationWorkspace mode="session" requestId={id} />
    </PageShell>
  );
}
