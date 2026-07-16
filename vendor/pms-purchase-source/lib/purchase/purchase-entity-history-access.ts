import "server-only";

import { NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { canViewPurchaseEntityHistory } from "@/lib/purchase/can-view-purchase-entity-history";

export { canViewPurchaseEntityHistory } from "@/lib/purchase/can-view-purchase-entity-history";

export async function assertPurchaseEntityHistoryAccess(request: Request) {
  const currentUser = await getCurrentUserFromRequest(request);
  if (!currentUser) {
    return {
      allowed: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!canViewPurchaseEntityHistory(currentUser.designationAccessLevel)) {
    return {
      allowed: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { allowed: true as const, currentUser };
}
