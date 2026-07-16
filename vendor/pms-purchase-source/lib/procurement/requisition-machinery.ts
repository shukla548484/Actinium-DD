import prisma from "@/lib/prisma";

/**
 * Spare-part requisitions (SPR) select **Machinery** (equipment model/type) at requisition
 * level — not a specific MachineryInstance on board.
 *
 * That Machinery id is copied to every line on save into `RequisitionItem.machineryInstanceId`
 * (legacy column name). Do not treat that field as a MachineryInstance foreign key for SPR.
 */
export function getRequisitionItemMachineryId(item: {
  machineryInstanceId?: string | null;
} | null | undefined): string | null {
  const id = item?.machineryInstanceId?.trim();
  return id || null;
}

export async function resolveMachineryMetadata(machineryId: string | null | undefined) {
  if (!machineryId?.trim()) {
    return { machineryId: null as string | null, machineryModelCode: null as string | null };
  }

  const machinery = await prisma.machinery.findUnique({
    where: { id: machineryId.trim() },
    select: { id: true, code: true },
  });

  if (!machinery) {
    return { machineryId: machineryId.trim(), machineryModelCode: null as string | null };
  }

  return {
    machineryId: machinery.id,
    machineryModelCode: machinery.code,
  };
}
