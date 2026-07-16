import { PurchaseRequisitionsPanel } from "@/components/purchase/PurchaseRequisitionsPanel";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function ViewRequisitionsPage({ searchParams }: PageProps) {
  const { status } = await searchParams;
  return <PurchaseRequisitionsPanel initialStatus={status} />;
}
