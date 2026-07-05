import { AccountProfilePanel } from "@/components/account/AccountProfilePanel";
import { PageHeader, PageShell } from "@/components/layout/PageShell";

export const dynamic = "force-dynamic";

export default function AccountProfilePage() {
  return (
    <PageShell>
      <PageHeader
        title="Profile"
        description="View your account details, role, and assigned vessel information."
      />
      <AccountProfilePanel />
    </PageShell>
  );
}
