/** Maps shipyard workshop slugs to RBAC action permissions. */
export const WORKSHOP_SLUG_PERMISSION: Record<string, string> = {
  hull: "yard.workshop.hull",
  steel: "yard.workshop.steel",
  painting: "yard.workshop.painting",
  "tank-coating": "yard.workshop.painting",
  machinery: "yard.workshop.machinery",
  pipe: "yard.workshop.valve",
  valve: "yard.workshop.valve",
  electrical: "yard.workshop.electrical",
  "deck-machinery": "yard.workshop.machinery",
  "safety-qa": "yard.workshop.safety",
  "docking-team": "yard.execution.manage",
  logistics: "yard.execution.manage",
};

export function workshopPermissionForSlug(slug: string): string | null {
  return WORKSHOP_SLUG_PERMISSION[slug] ?? null;
}

export function canAccessWorkshopSlug(
  permissions: Set<string>,
  slug: string,
): boolean {
  if (permissions.has("yard.execution.manage") || permissions.has("platform.tenant.manage")) {
    return true;
  }
  const required = workshopPermissionForSlug(slug);
  if (!required) return permissions.has("yard.execution.read");
  return permissions.has(required) || permissions.has("yard.execution.read");
}

export function filterWorkshopSlugsForPermissions(
  permissions: Set<string>,
  slugs: string[],
): string[] {
  if (permissions.has("yard.execution.manage") || permissions.has("platform.tenant.manage")) {
    return slugs;
  }
  return slugs.filter((slug) => canAccessWorkshopSlug(permissions, slug));
}
