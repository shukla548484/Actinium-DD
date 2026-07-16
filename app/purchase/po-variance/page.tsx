import { PurchaseFeaturePage } from "@/components/purchase/PurchaseFeaturePage";

export default function Page() {
  return (
    <PurchaseFeaturePage
      title="PO Variance"
      description="Purchase order variance analysis."
      sourcePath="vendor/pms-purchase-source/app-purchase/po-variance"
      features={[
    "Ordered vs received vs invoiced",
    "Variance reasons"
  ]}
      related={[
    { href: "/purchase/purchase-orders", label: "POs" }
  ]}
    />
  );
}
