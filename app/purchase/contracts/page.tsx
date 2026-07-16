import { PurchaseFeaturePage } from "@/components/purchase/PurchaseFeaturePage";

export default function Page() {
  return (
    <PurchaseFeaturePage
      title="Contracts"
      description="Frame agreements and contract-based purchasing."
      sourcePath="vendor/pms-purchase-source/app-purchase/contracts"
      features={[
    "Contract CRUD",
    "Contract items",
    "Contract invoice / PO linkage"
  ]}
      related={[
    { href: "/purchase/bulk-purchasing", label: "Bulk purchasing" },
    { href: "/purchase/vendor-management", label: "Vendors" }
  ]}
    />
  );
}
