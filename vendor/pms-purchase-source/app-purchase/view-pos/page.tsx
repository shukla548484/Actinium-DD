import { redirect } from "next/navigation";
import {
  purchaseOrdersHubRedirectUrl,
  LEGACY_PO_HUB_TAB,
} from "@/lib/purchase/purchase-orders-hub-redirect";

export default async function ViewPosRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  redirect(purchaseOrdersHubRedirectUrl(LEGACY_PO_HUB_TAB["/purchase/view-pos"]!, sp));
}
