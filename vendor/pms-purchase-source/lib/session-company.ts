import prisma from '@/lib/prisma';
import { prisma as masterPrisma } from '@/lib/prisma-master';
import { companyProfileSelect } from '@/lib/company-session-select';

export type SessionCompany = {
  id: string;
  name: string;
  code: string;
  type: string | null;
  parentId: string | null;
  logoUrl: string | null;
};

/** Resolve company row for session payloads (local DB first, then master). */
export async function resolveCompanyForSession(
  companyId: string | null | undefined
): Promise<SessionCompany | null> {
  if (!companyId) return null;

  const select = companyProfileSelect;

  try {
    const local = await prisma.company.findUnique({
      where: { id: companyId },
      select,
    });
    if (local?.name?.trim()) return local;
  } catch {
    /* local DB may not have companies on some deployments */
  }

  try {
    const master = await masterPrisma.company.findUnique({
      where: { id: companyId },
      select,
    });
    return master ?? null;
  } catch {
    return null;
  }
}

/** Crew login/session: vessel operator company, then employee registration company. */
export async function resolveCrewSessionCompany(
  vesselCompanyId: string | null | undefined,
  employeeCompanyId: string | null | undefined
): Promise<SessionCompany | null> {
  return (
    (await resolveCompanyForSession(vesselCompanyId)) ??
    (await resolveCompanyForSession(employeeCompanyId))
  );
}
