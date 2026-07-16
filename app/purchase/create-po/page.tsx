import { PurchaseFeaturePage } from "@/components/purchase/PurchaseFeaturePage";

export default function Page() {
  return (
    <PurchaseFeaturePage
      title="Create Purchase Order"
      description="Issue PO from a confirmed vendor quote."
      sourcePath="vendor/pms-purchase-source/app-purchase/create-po"
      features={[
    "Quote → PO conversion",
    "Freight lines",
    "Approval policy check"
  ]}
      related={[
    { href: "/purchase/purchase-orders", label: "PO hub" }
  ]}
    />
  );
}
