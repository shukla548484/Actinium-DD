import { PurchaseFeaturePage } from "@/components/purchase/PurchaseFeaturePage";

export default function Page() {
  return (
    <PurchaseFeaturePage
      title="Store Items"
      description="Store item catalog for requisitions."
      sourcePath="vendor/pms-purchase-source/app-purchase/store-items"
      features={[
    "Store item search",
    "Link to requisition lines"
  ]}
      related={[
    { href: "/purchase/create-requisition", label: "Create requisition" }
  ]}
    />
  );
}
