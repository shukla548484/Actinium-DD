import { PurchaseFeaturePage } from "@/components/purchase/PurchaseFeaturePage";

export default function Page() {
  return (
    <PurchaseFeaturePage
      title="Seafarer Application"
      description="Seafarer-linked purchase applications."
      sourcePath="vendor/pms-purchase-source/app-purchase/seafarer-application"
      features={[
    "Crew application intake for purchase"
  ]}
      related={[
    { href: "/purchase/view-requisitions", label: "Requisitions" }
  ]}
    />
  );
}
