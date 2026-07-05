import { OfficeModulePage } from "@/components/office/OfficeModulePage";
import { AccountsInvoicePanel } from "@/components/office/AccountsInvoicePanel";

export const dynamic = "force-dynamic";

export default function OfficeAccountsPage() {
  return (
    <OfficeModulePage
      title="Accounts control"
      description="Invoice verification, budget tracking, and cost control."
    >
      <AccountsInvoicePanel />
    </OfficeModulePage>
  );
}
