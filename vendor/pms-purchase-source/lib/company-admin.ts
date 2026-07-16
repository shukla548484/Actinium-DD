import type { Company, PrismaClient } from '@prisma/client';

/** Client-visible company admin scope (also stored on session user). */
export type CompanyAdminScope = {
  masterCompanyId: string;
  masterCompany: Pick<Company, 'id' | 'name' | 'code' | 'type'>;
  allowedAdminPages: string[];
  scopedCompanyIds: string[];
};

/** Access levels that may be assigned as Company Admin (scoped admin pages). Not 50/99/100 — those users already have full access. */
export const COMPANY_ADMIN_ASSIGNEE_ACCESS_LEVELS = [47, 48, 49] as const;

export function isCompanyAdminAssigneeAccessLevel(level: number | null | undefined): boolean {
  return level != null && (COMPANY_ADMIN_ASSIGNEE_ACCESS_LEVELS as readonly number[]).includes(level);
}

export const COMPANY_ADMIN_ASSIGNABLE_ADMIN_PAGES: Array<{ href: string; name: string }> = [
  { href: '/admin/dashboard', name: 'Dashboard' },
  { href: '/admin/vessels', name: 'Vessel Management' },
  { href: '/admin/company', name: 'Company Management' },
  { href: '/admin/machinery', name: 'Machinery Management' },
  { href: '/admin/employee', name: 'Employee Management' },
  { href: '/admin/vendor-management', name: 'Vendor Management' },
  { href: '/admin/help-management', name: 'Help Management' },
  { href: '/admin/designation', name: 'Designation Data' },
  { href: '/admin/impa-upload', name: 'IMPA Bulk Upload' },
  { href: '/admin/coastline-data-upload', name: 'Coastline data upload' },
  { href: '/admin/setup-vessel', name: 'Setup Vessel' },
  { href: '/admin/fuel', name: 'Fuel Management' },
  { href: '/admin/lube-oil', name: 'Lube Oil Management' },
  { href: '/admin/lube-oil-catalog', name: 'Lube Oil Catalog' },
  { href: '/admin/paint-catalog', name: 'Paint Catalog' },
  { href: '/admin/setup-machinery', name: 'Setup Machinery' },
  { href: '/admin/fuel-consumers', name: 'Select Fuel Consumers' },
  { href: '/admin/lube-consumers', name: 'Select Lube Consumers' },
  { href: '/admin/machinery-instance-units', name: 'Define Machinery Instance Units' },
  { href: '/admin/setup-inventory', name: 'Setup Inventory' },
  { href: '/admin/setup-spare-parts', name: 'Setup Spare Parts' },
  { href: '/admin/setup-maintenance', name: 'Setup Maintenance' },
  { href: '/admin/setup-crew', name: 'Setup Crew' },
  { href: '/admin/vessel-drill-initialization', name: 'Vessel Drill Initialization' },
  { href: '/admin/running-hours', name: 'Update Running Hours' },
  { href: '/admin/define-systems', name: 'Define Systems' },
  { href: '/admin/define-jobs', name: 'Define Jobs' },
  { href: '/admin/company-routine-jobs', name: 'Company Routine Jobs' },
  { href: '/admin/maintenance-packages', name: 'Maintenance Packages' },
  { href: '/admin/maintenance-schedule/extract', name: 'Import Maintenance Schedule' },
  { href: '/admin/machinery-monitoring', name: 'Running Hours & Daily Average' },
  { href: '/admin/assign-jobs', name: 'Assign Jobs' },
  { href: '/admin/edit-jobs', name: 'Edit Jobs' },
  { href: '/admin/machinery/instances', name: 'Machinery Instances (Bulk Create)' },
  { href: '/admin/machinery-instances', name: 'Manage Instances of Machinery and Components' },
  { href: '/admin/initialize-running-hours', name: 'Initialize Running Hours/Done date' },
  { href: '/admin/initial-rob-declaration', name: 'Initial Rob Declaration' },
  { href: '/admin/crew-credentials', name: 'Create Ship Crew login Credentials' },
  { href: '/admin/get-vessel-app', name: 'Get Vessel App' },
  { href: '/admin/vessel-backup', name: 'Vessel Backup' },
  { href: '/admin/database-recovery', name: 'Database Recovery' },
  { href: '/admin/cmp-ref', name: 'CMP-REF' },
];

export function isCompanyAdminUser(user: unknown): user is { companyAdmin: CompanyAdminScope } {
  return (
    typeof user === 'object' &&
    user !== null &&
    'companyAdmin' in user &&
    typeof (user as { companyAdmin?: unknown }).companyAdmin === 'object' &&
    (user as { companyAdmin?: { masterCompanyId?: string } }).companyAdmin?.masterCompanyId != null
  );
}

export function normalizeAllowedAdminPages(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === 'string' && x.startsWith('/'));
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return normalizeAllowedAdminPages(parsed);
    } catch {
      return [];
    }
  }
  return [];
}

/** All companies in the subtree rooted at masterCompanyId (including the master). */
export async function collectDescendantCompanyIds(
  db: PrismaClient,
  masterCompanyId: string
): Promise<string[]> {
  const rows = await db.company.findMany({
    select: { id: true, parentId: true },
  });
  const byParent = new Map<string | null, string[]>();
  for (const r of rows) {
    const k = r.parentId ?? null;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(r.id);
  }
  const out = new Set<string>();
  const q = [masterCompanyId];
  while (q.length) {
    const id = q.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    const children = byParent.get(id) || [];
    for (const c of children) q.push(c);
  }
  return [...out];
}

export async function loadCompanyAdminScope(
  db: PrismaClient,
  employeeId: string
): Promise<CompanyAdminScope | null> {
  let row: any = null;
  try {
    row = await db.companyAdminAssignment.findUnique({
      where: { employeeId },
      include: {
        masterCompany: { select: { id: true, name: true, code: true, type: true } },
      },
    });
  } catch (error: any) {
    // Backward compatibility: allow auth/login to continue before migration is applied.
    const msg = String(error?.message || '');
    const isMissingTable =
      error?.code === 'P2021' ||
      msg.includes('company_admin_assignments') ||
      msg.includes('does not exist in the current database');
    if (isMissingTable) {
      console.warn('[CompanyAdmin] company_admin_assignments table missing; returning null scope');
      return null;
    }
    throw error;
  }
  if (!row) return null;
  const allowedAdminPages = normalizeAllowedAdminPages(row.allowedAdminPages);
  const scopedCompanyIds = await collectDescendantCompanyIds(db, row.masterCompanyId);
  return {
    masterCompanyId: row.masterCompanyId,
    masterCompany: row.masterCompany,
    allowedAdminPages,
    scopedCompanyIds,
  };
}

/**
 * API path prefixes permitted when a Company Admin has the given Admin UI page in their allow list.
 * Expand as new admin pages need API access.
 */
export const ADMIN_HREF_TO_API_PREFIXES: Record<string, string[]> = {
  '/admin/dashboard': ['/api/admin/dashboard-stats', '/api/dashboard'],
  '/admin/vessels': ['/api/vessels', '/api/vessel'],
  '/admin/company': ['/api/companies'],
  '/admin/machinery': ['/api/machinery', '/api/machineries', '/api/machinery-types'],
  '/admin/employee': ['/api/employees', '/api/admin/change-password', '/api/admin/designation'],
  '/admin/vendor-management': ['/api/vendors', '/api/vendor'],
  '/admin/help-management': ['/api/help'],
  '/admin/designation': ['/api/admin/designation'],
  '/admin/impa-upload': ['/api/impa'],
  '/admin/coastline-data-upload': ['/api/admin/coastline-segments'],
  '/admin/setup-vessel': ['/api/vessels', '/api/vessel', '/api/companies'],
  '/admin/fuel': ['/api/fuel', '/api/fuel-types'],
  '/admin/lube-oil': ['/api/lube', '/api/lube-oil'],
  '/admin/lube-oil-catalog': ['/api/lube-oil-suppliers', '/api/lube-oil-products', '/api/lube-oil-suppliers/template', '/api/lube-oil-products/template'],
  '/admin/paint-catalog': ['/api/paint-catalog/products', '/api/paint-catalog/makers', '/api/paint-catalog/colors', '/api/paint-catalog/products/template', '/api/paint-catalog/products/bulk-upload'],
  '/admin/setup-machinery': ['/api/machinery', '/api/machineries'],
  '/admin/fuel-consumers': ['/api/fuel-consumers', '/api/fuel'],
  '/admin/lube-consumers': ['/api/lube-consumers', '/api/lube'],
  '/admin/machinery-instance-units': ['/api/machinery-instance-units'],
  '/admin/setup-inventory': ['/api/inventory', '/api/store'],
  '/admin/setup-spare-parts': ['/api/spare', '/api/spare-parts'],
  '/admin/setup-maintenance': ['/api/maintenance'],
  '/admin/setup-crew': ['/api/crew'],
  '/admin/vessel-drill-initialization': ['/api/admin/vessel-drill-initialization', '/api/vessel'],
  '/admin/running-hours': ['/api/machinery-monitoring', '/api/equipment-running-hours'],
  '/admin/define-systems': ['/api/admin/systems', '/api/systems'],
  '/admin/define-jobs': ['/api/jobs', '/api/job'],
  '/admin/maintenance-packages': ['/api/maintenance-packages'],
  '/admin/maintenance-schedule/import': ['/api/maintenance-schedule'],
  '/admin/maintenance-schedule/map': ['/api/maintenance-schedule'],
  '/admin/machinery-monitoring': ['/api/machinery-monitoring'],
  '/admin/assign-jobs': ['/api/jobs', '/api/job-assignments'],
  '/admin/edit-jobs': ['/api/jobs', '/api/job'],
  '/admin/machinery-instances': ['/api/machinery-instances', '/api/machinery-instance', '/api/component-instances'],
  '/admin/initialize-running-hours': ['/api/machinery', '/api/initialize-running-hours'],
  '/admin/initial-rob-declaration': ['/api/initial-rob'],
  '/admin/crew-credentials': ['/api/crew-credentials', '/api/crewCredential'],
  '/admin/get-vessel-app': ['/api/vessel-apps'],
  '/admin/vessel-backup': ['/api/admin/vessel-backup'],
  '/admin/database-recovery': [
    '/api/admin/database/backup',
    '/api/admin/database/backups',
    '/api/admin/database/restore',
    '/api/admin/database/backups/download',
  ],
  '/admin/cmp-ref': ['/api/cmp'],
  '/admin/job-assignments': ['/api/job-assignments'],
  '/admin/machinery-management': ['/api/machinery'],
  '/admin/machinery/components': ['/api/machinery', '/api/component'],
  '/admin/machinery/instances': ['/api/machinery-instances'],
  '/admin/monitoring': ['/api/monitoring'],
  '/admin/permit-to-work-templates': ['/api/permit-to-work'],
};

const GLOBAL_COMPANY_ADMIN_API_PREFIXES = [
  '/api/profile',
  '/api/notifications',
  '/api/hseq/notifications',
  '/api/search',
  '/api/upload',
];

export function companyAdminCanAccessApiPath(pathname: string, allowedAdminPages: string[]): boolean {
  const path = pathname.split('?')[0] || pathname;
  if (GLOBAL_COMPANY_ADMIN_API_PREFIXES.some((p) => path.startsWith(p))) {
    return true;
  }
  for (const href of allowedAdminPages) {
    const prefixes = ADMIN_HREF_TO_API_PREFIXES[href];
    if (!prefixes) continue;
    if (prefixes.some((p) => path.startsWith(p))) return true;
  }
  return false;
}

export function companyAdminCanAccessAdminPage(pathname: string, allowedAdminPages: string[]): boolean {
  const path = (pathname.split('?')[0] || pathname).replace(/\/$/, '') || '/';
  if (!path.startsWith('/admin')) return true;
  return allowedAdminPages.some((h) => path === h || path.startsWith(h + '/'));
}
