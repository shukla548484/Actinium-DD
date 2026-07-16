/**
 * Seafaring ranks in this app use employee.designation_access_level from 6 (e.g. cadet) through 25 (Master).
 * Office, admin, and other shore roles use levels outside this band and must not appear in crew/roster lists.
 */
export const SEAFARER_DESIGNATION_ACCESS_LEVEL_MIN = 6;
export const SEAFARER_DESIGNATION_ACCESS_LEVEL_MAX = 25;

/** Prisma nested filter for `employee: { ... }` or top-level `Employee` queries. */
export const seafarerEmployeeDesignationWhere = {
  designationAccessLevel: {
    gte: SEAFARER_DESIGNATION_ACCESS_LEVEL_MIN,
    lte: SEAFARER_DESIGNATION_ACCESS_LEVEL_MAX,
  },
} as const;

export function isSeafarerDesignationAccessLevel(level: number | null | undefined): boolean {
  if (level == null || Number.isNaN(Number(level))) return false;
  const n = Number(level);
  return n >= SEAFARER_DESIGNATION_ACCESS_LEVEL_MIN && n <= SEAFARER_DESIGNATION_ACCESS_LEVEL_MAX;
}

/** True only for ranks 6–25: hide page vessel selectors and show vessel in top nav. */
export function shouldHidePageVesselSelector(
  level: number | null | undefined
): boolean {
  return isSeafarerDesignationAccessLevel(level);
}

/** Crew credential `rank_access_level` band (cadet through Master). */
export const CREW_CREDENTIAL_RANK_MIN = SEAFARER_DESIGNATION_ACCESS_LEVEL_MIN;
export const CREW_CREDENTIAL_RANK_MAX = SEAFARER_DESIGNATION_ACCESS_LEVEL_MAX;

export function isCrewCredentialRankAccessLevel(level: number | null | undefined): boolean {
  return isSeafarerDesignationAccessLevel(level);
}

export function crewCredentialRankBandLabel(): string {
  return `${CREW_CREDENTIAL_RANK_MIN}–${CREW_CREDENTIAL_RANK_MAX}`;
}
