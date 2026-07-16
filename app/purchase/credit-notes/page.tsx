import { PurchaseFeaturePage } from "@/components/purchase/PurchaseFeaturePage";

export default function Page() {
  return (
    <PurchaseFeaturePage
      title="Credit Notes"
      description="Vendor credit notes against invoices / POs."
      sourcePath="vendor/pms-purchase-source/app-purchase/credit-notes"
      features={[
    "Credit note register",
    "Link to invoice / PO",
    "Approval workflow"
  ]}
      related={[
    { href: "/purchase/invoices", label: "Invoices" }
  ]}
    />
  );
}
