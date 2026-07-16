import { PurchaseFeaturePage } from "@/components/purchase/PurchaseFeaturePage";

export default function Page() {
  return (
    <PurchaseFeaturePage
      title="Quote Comparison"
      description="Side-by-side vendor quote comparison."
      sourcePath="vendor/pms-purchase-source/app-purchase/quote-comparison"
      features={[
    "KPI cards",
    "Line-level compare",
    "Select winner and create PO"
  ]}
      related={[
    { href: "/purchase/view-requisitions", label: "Requisitions" }
  ]}
    />
  );
}
