import { PageHeader, PageShell } from "@/components/layout/PageShell";

export default function ExternalPortalPage() {
  return (
    <PageShell>
      <PageHeader
        title="External portal"
        description="Vendors, makers, class surveyors, and other external parties manage quote responses and RFQ invitations here."
      />
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        <p>
          Use the links in the top navigation to view assigned RFQs and submitted quotes. Token-based
          quote links from email invitations remain available at <code>/quote/[token]</code> without
          a full account.
        </p>
      </div>
    </PageShell>
  );
}
