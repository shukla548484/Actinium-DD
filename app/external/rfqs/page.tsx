import { PageHeader, PageShell } from "@/components/layout/PageShell";

export default function ExternalRfqsPage() {
  return (
    <PageShell>
      <PageHeader
        title="RFQ invitations"
        description="Requests for quotation sent to your organization."
      />
      <p className="text-sm text-muted-foreground">
        No open RFQ invitations. Invitations arrive by email with a secure quote link.
      </p>
    </PageShell>
  );
}
