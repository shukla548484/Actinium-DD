import { PurchaseFeaturePage } from "@/components/purchase/PurchaseFeaturePage";

export default function Page() {
  return (
    <PurchaseFeaturePage
      title="Master Approval"
      description="Onboard master requisition approval."
      sourcePath="vendor/pms-purchase-source/app-purchase/master-approval"
      features={[
    "Master-level approval queue",
    "Shore notification sync"
  ]}
      related={[
    { href: "/purchase/view-requisitions", label: "Requisitions" }
  ]}
    />
  );
}
