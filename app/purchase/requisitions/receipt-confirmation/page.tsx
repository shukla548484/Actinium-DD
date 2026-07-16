import { PurchaseFeaturePage } from "@/components/purchase/PurchaseFeaturePage";

export default function Page() {
  return (
    <PurchaseFeaturePage
      title="Onboard Receipt Confirmation"
      description="Crew confirms receipt of ordered goods against PO / DN (access levels 20–24)."
      sourcePath="vendor/pms-purchase-source/app-purchase/requisitions/receipt-confirmation"
      features={[
    "Line-level receipt quantities",
    "Partial receipt support",
    "Sync with DN status"
  ]}
      related={[
    { href: "/purchase/dn-status", label: "DN status" },
    { href: "/purchase/purchase-orders", label: "Purchase orders" }
  ]}
    />
  );
}
