/**
 * Access levels that behave like the legacy system administrator (50):
 * full module list, cross-company context where applicable, and JWT isAdmin.
 */
const ADMIN_EQUIVALENT_LEVELS = new Set([50, 99, 100]);

/**
 * Normalize access level from DB/JWT (Prisma is usually a number; JWT or JSON may stringify).
 */
export function normalizeDesignationAccessLevel(
  level: number | string | null | undefined
): number | null {
  if (level == null || level === "") return null;
  if (typeof level === "number") {
    return Number.isFinite(level) ? Math.trunc(level) : null;
  }
  const n = Number(String(level).trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function isAdminEquivalentAccessLevel(
  level: number | string | null | undefined
): boolean {
  const n = normalizeDesignationAccessLevel(level);
  return n != null && ADMIN_EQUIVALENT_LEVELS.has(n);
}

/**
 * Prefer the highest trusted access level between DB and JWT.
 * JWT is signed at login (often master DB for level 50); company DB rows can lag or be null.
 */
export function resolveEffectiveDesignationAccessLevel(
  dbLevel: number | string | null | undefined,
  jwtLevel?: number | string | null | undefined
): number | null {
  const db = normalizeDesignationAccessLevel(dbLevel);
  const jwt = normalizeDesignationAccessLevel(jwtLevel);
  if (jwt != null && isAdminEquivalentAccessLevel(jwt)) return jwt;
  if (db != null && jwt != null) return Math.max(db, jwt);
  return db ?? jwt ?? null;
}
