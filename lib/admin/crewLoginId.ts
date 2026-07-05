import { getVesselCrewRole } from "@/lib/admin/vesselCrewRoles";
import {
  formatVesselCrewLoginId,
  getCrewRankLoginSuffix,
} from "@/lib/admin/crewLoginSuffix";
import { prisma } from "@/lib/prisma";

export {
  CREW_RANK_LOGIN_SUFFIX,
  formatVesselCrewLoginId,
  getCrewRankLoginSuffix,
  looksLikeVesselCrewLoginId,
} from "@/lib/admin/crewLoginSuffix";

function parseCrewLoginSequence(loginId: string, prefix: string): number | null {
  if (!loginId.startsWith(prefix)) return null;
  const tail = loginId.slice(prefix.length);
  if (!/^\d{2}$/.test(tail)) return null;
  return Number.parseInt(tail, 10);
}

export async function nextVesselCrewLoginId(
  vesselId: string,
  vesselCode: string,
  roleCode: string,
): Promise<string> {
  const suffix = getCrewRankLoginSuffix(roleCode);
  const prefix = `${vesselCode.trim().toUpperCase()}-${suffix}`;

  const rows = await prisma.employee.findMany({
    where: {
      vesselLoginId: { startsWith: prefix },
      deletedAt: null,
      vesselAssignments: { some: { vesselId } },
    },
    select: { vesselLoginId: true },
  });

  let maxSeq = 0;
  for (const row of rows) {
    if (!row.vesselLoginId) continue;
    const seq = parseCrewLoginSequence(row.vesselLoginId.toUpperCase(), prefix);
    if (seq != null && seq > maxSeq) maxSeq = seq;
  }

  return formatVesselCrewLoginId(vesselCode, roleCode, maxSeq + 1);
}

export function isVesselCrewRoleCode(roleCode: string | null | undefined): boolean {
  if (!roleCode) return false;
  return Boolean(getVesselCrewRole(roleCode));
}
