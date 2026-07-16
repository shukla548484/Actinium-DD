import { PurchaseRequisitionsPanel } from "@/components/purchase/PurchaseRequisitionsPanel";

export const dynamic = "force-dynamic";

export default function DraftRequisitionsPage() {
  return (
    <PurchaseRequisitionsPanel
      initialStatus="NOT_READY"
      title="Draft Requisitions"
      description="Incomplete requisitions saved as draft before submission."
    />
  );
}
