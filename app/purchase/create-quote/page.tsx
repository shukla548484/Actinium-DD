import { PurchaseFeaturePage } from "@/components/purchase/PurchaseFeaturePage";

export default function Page() {
  return (
    <PurchaseFeaturePage
      title="Create Quote"
      description="Purchaser-side quote entry (access levels 32 / 33 / 50)."
      sourcePath="vendor/pms-purchase-source/app-purchase/create-quote"
      features={[
    "Manual quote capture",
    "Line matching to requisition items",
    "Submit for commercial review"
  ]}
      related={[
    { href: "/purchase/view-requisitions", label: "Requisitions" }
  ]}
    />
  );
}
