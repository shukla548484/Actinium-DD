import { YardQuoteForm } from "@/components/portal/YardQuoteForm";
import { PageShell } from "@/components/layout/PageShell";

export default async function QuotePortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="min-h-dvh bg-muted/30">
      <PageShell size="wide">
        <YardQuoteForm token={token} />
      </PageShell>
    </main>
  );
}
