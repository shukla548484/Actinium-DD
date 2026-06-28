import { prisma } from "@/lib/prisma";

const notDeleted = { deletedAt: null };

/** Dry dock project ID: {VESSEL_CODE}-DD-{0001} e.g. ABC-NEW-DD-0001 */
export function formatDryDockProjectCode(vesselCode: string, seq: number): string {
  return `${vesselCode}-DD-${String(seq).padStart(4, "0")}`;
}

export async function nextDryDockProjectCode(vesselId: string): Promise<string> {
  const vessel = await prisma.vessel.findFirst({
    where: { id: vesselId, ...notDeleted },
    select: { code: true },
  });
  if (!vessel) throw new Error("Vessel not found");

  const count = await prisma.dryDockProject.count({ where: { vesselId } });
  let seq = count + 1;
  let code = formatDryDockProjectCode(vessel.code, seq);

  while (
    await prisma.dryDockProject.findFirst({
      where: { referenceCode: code, ...notDeleted },
    })
  ) {
    seq++;
    code = formatDryDockProjectCode(vessel.code, seq);
  }

  return code;
}

export async function previewDryDockProjectCode(vesselId: string): Promise<string | null> {
  try {
    return await nextDryDockProjectCode(vesselId);
  } catch {
    return null;
  }
}
