import type { PrismaClient } from "@prisma/client";
import { findRfqClarificationResponderIds } from "@/lib/procurement/clarification-responders";

/** Employee IDs to notify when a vendor requests RFQ clarification. */
export async function findRfqClarificationNotifyRecipientIds(
  db: Pick<PrismaClient, "employee">,
  vesselId: string,
  creatorAccessLevel: number
): Promise<string[]> {
  return findRfqClarificationResponderIds(db, vesselId, creatorAccessLevel);
}
