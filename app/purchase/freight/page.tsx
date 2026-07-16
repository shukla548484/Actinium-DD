import { PurchaseFeaturePage } from "@/components/purchase/PurchaseFeaturePage";

export default function Page() {
  return (
    <PurchaseFeaturePage
      title="Freight"
      description="Freight declarations and freight purchase orders."
      sourcePath="vendor/pms-purchase-source/app-purchase/freight"
      features={[
    "Freight declaration workspace",
    "Freight charge keys",
    "Freight PO issue"
  ]}
      related={[
    { href: "/purchase/freight-approvals", label: "Freight approvals" },
    { href: "/purchase/purchase-orders", label: "Purchase orders" }
  ]}
    />
  );
}
