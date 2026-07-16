import { PurchaseFeaturePage } from "@/components/purchase/PurchaseFeaturePage";

export default function Page() {
  return (
    <PurchaseFeaturePage
      title="RFQ Clarifications"
      description="Vendor questions and clarifications during RFQ."
      sourcePath="vendor/pms-purchase-source/app-purchase/clarifications"
      features={[
    "Clarification threads per RFQ",
    "Attachments",
    "Escalation tracking"
  ]}
      related={[
    { href: "/purchase/view-requisitions", label: "Requisitions" },
    { href: "/purchase/knowledge-library", label: "Knowledge library" }
  ]}
    />
  );
}
