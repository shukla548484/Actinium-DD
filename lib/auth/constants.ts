/** Default password for newly registered employees (must be changed after first login). */
export const DEFAULT_EMPLOYEE_PASSWORD = "password";

export const MIN_PASSWORD_LENGTH = 6;

/** Inactivity timeout — session expires after this many seconds without user activity. */
export const SESSION_IDLE_TIMEOUT_SEC = 20 * 60;

/**
 * Seeded system administrator (Role ID 1001 / SYS_ADMIN).
 * Created by `npm run db:seed` — change password after first login in production.
 */
export const SEED_ADMIN_LOGIN_ID = "ACT.1001";
export const SEED_ADMIN_PASSWORD = "Admin@1001";
export const SEED_ADMIN_ROLE_NO = 1001;
