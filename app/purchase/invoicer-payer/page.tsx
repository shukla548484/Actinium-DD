import { PurchaseFeaturePage } from "@/components/purchase/PurchaseFeaturePage";

export default function Page() {
  return (
    <PurchaseFeaturePage
      title="Invoicer / Payer"
      description="Invoice payer company mapping."
      sourcePath="vendor/pms-purchase-source/app-purchase/invoicer-payer"
      features={[
    "Payer company configuration",
    "Invoicer identity for AP"
  ]}
      related={[
    { href: "/purchase/vendor-management", label: "Vendors" },
    { href: "/purchase/invoices", label: "Invoices" }
  ]}
    />
  );
}
