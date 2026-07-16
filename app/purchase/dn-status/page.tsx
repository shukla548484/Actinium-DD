import { PurchaseFeaturePage } from "@/components/purchase/PurchaseFeaturePage";

export default function Page() {
  return (
    <PurchaseFeaturePage
      title="DN Status"
      description="Delivery note tracking across purchase orders."
      sourcePath="vendor/pms-purchase-source/app-purchase/dn-status"
      features={[
    "DN upload status",
    "Partial / full delivery",
    "Link to onboard receipt"
  ]}
      related={[
    { href: "/purchase/requisitions/receipt-confirmation", label: "Onboard receipt" },
    { href: "/purchase/purchase-orders", label: "POs" }
  ]}
    />
  );
}
