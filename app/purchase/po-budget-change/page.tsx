import { PurchaseFeaturePage } from "@/components/purchase/PurchaseFeaturePage";

export default function Page() {
  return (
    <PurchaseFeaturePage
      title="PO Budget Change"
      description="Reclassify PO budget after invoice (restricted access)."
      sourcePath="vendor/pms-purchase-source/app-purchase/po-budget-change"
      features={[
    "Request budget reclassification",
    "Approver workflow (levels 44–48)",
    "Audit trail"
  ]}
      related={[
    { href: "/purchase/budget-control", label: "Budget control" }
  ]}
    />
  );
}
