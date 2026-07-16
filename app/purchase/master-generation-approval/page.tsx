import { PurchaseFeaturePage } from "@/components/purchase/PurchaseFeaturePage";

export default function Page() {
  return (
    <PurchaseFeaturePage
      title="Master Generation Approval"
      description="Approve generated master catalog lines."
      sourcePath="vendor/pms-purchase-source/app-purchase/master-generation-approval"
      features={[
    "Generation approval gate"
  ]}
      related={[
    { href: "/purchase/view-requisitions", label: "Requisitions" }
  ]}
    />
  );
}
