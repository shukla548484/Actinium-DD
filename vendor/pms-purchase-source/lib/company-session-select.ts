/** Company fields for login session / localStorage user payload */
export const companyLoginSelect = {
  id: true,
  name: true,
  code: true,
  type: true,
  parentId: true,
  logoUrl: true,
  databaseStatus: true,
  databaseName: true,
} as const;

/** Company fields for profile / bootstrap (no DB routing metadata) */
export const companyProfileSelect = {
  id: true,
  name: true,
  code: true,
  type: true,
  parentId: true,
  logoUrl: true,
} as const;
