import { PurchaseFeaturePage } from "@/components/purchase/PurchaseFeaturePage";

export default function Page() {
  return (
    <PurchaseFeaturePage
      title="Knowledge Library"
      description="Reusable procurement knowledge packs."
      sourcePath="vendor/pms-purchase-source/app-purchase/knowledge-library"
      features={[
    "Knowledge packs and assets",
    "Entity links to requisitions",
    "Approval challenges"
  ]}
      related={[
    { href: "/purchase/clarifications", label: "Clarifications" }
  ]}
    />
  );
}
