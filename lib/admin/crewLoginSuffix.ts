/** RBAC role code → vessel login suffix (e.g. CENG → CE). Client-safe — no DB imports. */
export const CREW_RANK_LOGIN_SUFFIX: Record<string, string> = {
  MASTER: "MA",
  CENG: "CE",
  COFF: "CO",
  "2ENG": "2E",
  ETO: "ET",
  "2OFF": "2O",
  "3OFF": "3O",
  "3ENG": "3E",
  "4ENG": "4E",
};

export function getCrewRankLoginSuffix(roleCode: string): string {
  const suffix = CREW_RANK_LOGIN_SUFFIX[roleCode];
  if (!suffix) {
    throw new Error(`No vessel login suffix configured for role ${roleCode}`);
  }
  return suffix;
}

/** Build vessel crew login id: `{vesselCode}-{rankSuffix}{seq}` e.g. AAA-BBB-CE01 */
export function formatVesselCrewLoginId(
  vesselCode: string,
  roleCode: string,
  sequence: number,
): string {
  const suffix = getCrewRankLoginSuffix(roleCode);
  const seq = String(Math.max(1, sequence)).padStart(2, "0");
  return `${vesselCode.trim().toUpperCase()}-${suffix}${seq}`;
}

const CREW_LOGIN_ID_PATTERN =
  /^[A-Z0-9][A-Z0-9-]*-[A-Z0-9]{1,3}\d{2}$/i;

export function looksLikeVesselCrewLoginId(loginId: string): boolean {
  return CREW_LOGIN_ID_PATTERN.test(loginId.trim());
}
