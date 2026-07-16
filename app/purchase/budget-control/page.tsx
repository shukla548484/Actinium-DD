import { PurchaseFeaturePage } from "@/components/purchase/PurchaseFeaturePage";

export default function Page() {
  return (
    <PurchaseFeaturePage
      title="Budget Control"
      description="Fleet purchase budget monitor, accruals, and variance."
      sourcePath="vendor/pms-purchase-source/app-purchase/budget-control"
      features={[
    "Budget matrix by category",
    "YTD vs actual",
    "Accrual entries",
    "Cash-flow forecast"
  ]}
      related={[
    { href: "/purchase/po-budget-change", label: "PO budget change" },
    { href: "/purchase/reports", label: "Reports" }
  ]}
    />
  );
}
