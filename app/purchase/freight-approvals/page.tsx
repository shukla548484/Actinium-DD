import { PurchaseFeaturePage } from "@/components/purchase/PurchaseFeaturePage";

export default function Page() {
  return (
    <PurchaseFeaturePage
      title="Freight Approvals"
      description="Approve freight declarations and freight POs."
      sourcePath="vendor/pms-purchase-source/app-purchase/freight-approvals"
      features={[
    "Freight charge review",
    "Mode and account coding"
  ]}
      related={[
    { href: "/purchase/purchase-orders", label: "POs" }
  ]}
    />
  );
}
