import { PurchaseFeaturePage } from "@/components/purchase/PurchaseFeaturePage";

export default function Page() {
  return (
    <PurchaseFeaturePage
      title="Purchase Reports"
      description="Purchase reports and exports."
      sourcePath="vendor/pms-purchase-source/app-purchase/reports"
      features={[
    "Spend by vessel / category",
    "PO aging",
    "Requisition cycle time",
    "Excel exports"
  ]}
      related={[
    { href: "/purchase/dashboard", label: "Dashboard" },
    { href: "/purchase/budget-control", label: "Budget" }
  ]}
    />
  );
}
