import { PurchaseFeaturePage } from "@/components/purchase/PurchaseFeaturePage";

export default function Page() {
  return (
    <PurchaseFeaturePage
      title="Bulk Purchasing"
      description="Multi-vessel and bulk buy workflows."
      sourcePath="vendor/pms-purchase-source/app-purchase/bulk-purchasing"
      features={[
    "Bulk requisition grouping",
    "Shared RFQ across vessels",
    "Consolidated PO issue"
  ]}
      related={[
    { href: "/purchase/contracts", label: "Contracts" }
  ]}
    />
  );
}
