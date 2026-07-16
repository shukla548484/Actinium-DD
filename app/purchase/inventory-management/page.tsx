import { PurchaseFeaturePage } from "@/components/purchase/PurchaseFeaturePage";

export default function Page() {
  return (
    <PurchaseFeaturePage
      title="Inventory Management"
      description="Store / inventory linkage for purchasing."
      sourcePath="vendor/pms-purchase-source/app-purchase/inventory-management"
      features={[
    "Stock-aware requisitioning",
    "Store item links"
  ]}
      related={[
    { href: "/purchase/store-items", label: "Store items" }
  ]}
    />
  );
}
