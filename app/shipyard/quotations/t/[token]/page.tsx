import { QuotationWorkspace } from "@/components/shipyard/QuotationWorkspace";
import { PageShell } from "@/components/layout/PageShell";

export const dynamic = "force-dynamic";

export default async function ShipyardQuotationTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="min-h-dvh bg-muted/30 py-6">
      <PageShell size="wide">
        <h1 className="mb-1 text-xl font-semibold tracking-tight">Shipyard quotation</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Secure invite link — review vessel jobs and submit your quote.
        </p>
        <QuotationWorkspace mode="token" token={token} />
      </PageShell>
    </main>
  );
}
