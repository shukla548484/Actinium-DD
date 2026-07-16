/**
 * Request-based session helpers for Route Handlers and middleware-style code.
 * Reads auth from `Request` headers — no `next/headers`.
 *
 * For Server Components that need `cookies()`, use `@/lib/session-cookies` instead.
 */
import 'server-only';

import jwt from 'jsonwebtoken';
import prisma from './prisma';
import { prisma as masterPrisma } from './prisma-master';
import { loadCompanyAdminScope } from './company-admin';
import { loadEmployeeAssignedModules } from "@/lib/employee-assigned-modules";
import { resolveEmployeeAllowedPagePaths } from "@/lib/employee-module-pages";
import { companyProfileSelect } from '@/lib/company-session-select';
import { resolveCompanyForSession, resolveCrewSessionCompany } from '@/lib/session-company';
import { resolveEffectiveDesignationAccessLevel } from '@/lib/admin-access-level';
import type { SessionPrincipal } from './session-types';

export type { SessionPrincipal } from './session-types';

interface JWTPayload {
  employeeId: string;
  userId: string;
  loginUserId?: string;
  email: string;
  designation?: string;
  designationAccessLevel?: number;
  companyId: string | null;
  isCrewCredential?: boolean;
  crewCredentialId?: string;
  vesselId?: string;
  isSeafarer?: boolean;
  seafarerId?: string;
  crewRequirementId?: string;
}

/**
 * Lightweight auth for read-only reference APIs (purchase sub-categories, budget resolve, etc.).
 * Verifies JWT + one minimal DB row — skips module lists, vessel joins, and company-admin scope.
 */
export async function getSessionPrincipalFromRequest(request: Request): Promise<SessionPrincipal | null> {
  try {
    const cookie = request.headers.get('cookie');
    if (!cookie) return null;

    const authPair = cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('auth-token='));
    const token = authPair?.slice('auth-token='.length)?.trim();
    if (!token) return null;

    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as JWTPayload;
    } catch {
      return null;
    }

    if (decoded.isCrewCredential && decoded.crewCredentialId) {
      const crew = await prisma.crewCredential.findUnique({
        where: { id: decoded.crewCredentialId, isActive: true },
        select: {
          id: true,
          employeeId: true,
          vesselId: true,
          rankAccessLevel: true,
          username: true,
          employee: { select: { employeeId: true } },
        },
      });
      if (!crew) return null;
      return {
        userId: (crew.employeeId || crew.id).toString(),
        designationAccessLevel: crew.rankAccessLevel ?? null,
        loginId: crew.employee?.employeeId || `CREW-${crew.username}`,
        crewCredentialId: crew.id,
        crewVesselId: crew.vesselId,
      };
    }

    if (!decoded.employeeId) return null;

    const employee = await prisma.employee.findUnique({
      where: { id: decoded.employeeId },
      select: { id: true, isActive: true, designationAccessLevel: true, employeeId: true },
    });
    if (!employee?.isActive) return null;

    return {
      userId: employee.id,
      designationAccessLevel: resolveEffectiveDesignationAccessLevel(
        employee.designationAccessLevel,
        decoded.designationAccessLevel
      ),
      loginId: employee.employeeId,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUserFromRequest(request: Request) {
  try {
    const cookie = request.headers.get('cookie');
    if (!cookie) {
      console.warn('[SESSION] No cookie header found');
      return null;
    }

    // Use slice after the name — split('=')[1] truncates JWTs that include '=' (e.g. base64 padding)
    const authPair = cookie
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('auth-token='));
    const token = authPair?.slice('auth-token='.length)?.trim();

    if (!token) {
      console.warn('[SESSION] No auth-token found in cookies');
      return null;
    }

    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as JWTPayload;
    } catch (jwtError: any) {
      // Handle JWT errors (expired, invalid, etc.)
      if (jwtError.name === 'TokenExpiredError') {
        console.warn('[SESSION] JWT token expired');
      } else if (jwtError.name === 'JsonWebTokenError') {
        console.warn('[SESSION] Invalid JWT token:', jwtError.message);
      } else {
        console.warn('[SESSION] JWT verification error:', jwtError.name, jwtError.message);
      }
      return null;
    }
    
    // Validate decoded token has required fields
    if (!decoded.employeeId) {
      console.warn('[SESSION] JWT token missing employeeId');
      return null;
    }

    // Handle crew credentials differently
    if (decoded.isCrewCredential && decoded.crewCredentialId) {
      console.log('[SESSION] Handling crew credential session');
      
      const crewCredential = await prisma.crewCredential.findUnique({
        where: { 
          id: decoded.crewCredentialId,
          isActive: true,
        },
        include: {
          vessel: {
            select: {
              id: true,
              name: true,
              code: true,
              imoNumber: true,
              companyId: true,
            },
          },
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              designation: true,
              designationAccessLevel: true,
              department: true,
              companyId: true,
              isActive: true,
            },
          },
        },
      });

      if (!crewCredential) {
        console.warn('[SESSION] Crew credential not found or inactive:', decoded.crewCredentialId);
        return null;
      }

      const { resolveCrewNavForLogin } = await import("@/lib/crew-nav-resolve");
      const crewNav = await resolveCrewNavForLogin(
        crewCredential.vesselId,
        crewCredential.rankAccessLevel
      );

      const loginUserId =
        (typeof decoded.loginUserId === 'string' && decoded.loginUserId.trim()) ||
        crewCredential.username.trim();
      const linkedHrId = crewCredential.employee?.employeeId?.trim() || '';
      const loginMatchesLinkedEmployee =
        linkedHrId !== '' && linkedHrId.toUpperCase() === loginUserId.toUpperCase();

      const company = await resolveCrewSessionCompany(
        crewCredential.vessel.companyId,
        crewCredential.employee?.companyId
      );

      // Build user object from crew credential
      const crewUser: Record<string, unknown> = {
        id: crewCredential.employeeId || crewCredential.id,
        employeeId: loginMatchesLinkedEmployee
          ? linkedHrId
          : loginUserId.toUpperCase(),
        loginUserId: loginUserId.toUpperCase(),
        firstName: loginMatchesLinkedEmployee
          ? crewCredential.employee?.firstName || crewCredential.rankName
          : crewCredential.rankName,
        lastName: loginMatchesLinkedEmployee
          ? crewCredential.employee?.lastName || ''
          : '',
        email:
          loginMatchesLinkedEmployee && crewCredential.employee?.email
            ? crewCredential.employee.email
            : `${crewCredential.username}@vessel.local`,
        phone: loginMatchesLinkedEmployee ? crewCredential.employee?.phone || null : null,
        designation: crewCredential.rankName,
        designationAccessLevel: crewCredential.rankAccessLevel,
        department: loginMatchesLinkedEmployee
          ? crewCredential.employee?.department || 'Crew'
          : 'Crew',
        isActive: true,
        company,
        assignedModules: crewNav.assignedModules,
        assignedVessels: [{
          vessel: {
            id: crewCredential.vessel.id,
            name: crewCredential.vessel.name,
            code: crewCredential.vessel.code,
          },
        }],
        isCrewCredential: true,
        crewCredentialId: crewCredential.id,
        vesselId: crewCredential.vesselId,
      };
      if (crewNav.crewAllowedPagePaths?.length) {
        crewUser.crewAllowedPagePaths = crewNav.crewAllowedPagePaths;
      }

      return crewUser as any;
    }

    // Recruitment seafarer (shared crew application form credentials — not HR employees)
    if (decoded.isSeafarer && decoded.seafarerId) {
      const seafarer = await prisma.seafarer.findUnique({
        where: { seafarerId: decoded.seafarerId },
        include: {
          crewRequirement: {
            include: {
              company: {
                select: companyProfileSelect,
              },
            },
          },
        },
      });

      if (!seafarer || !seafarer.isActive) {
        console.warn("[SESSION] Seafarer not found or inactive:", decoded.seafarerId);
        return null;
      }

      if (
        seafarer.credentialExpiresAt &&
        new Date(seafarer.credentialExpiresAt) < new Date()
      ) {
        console.warn("[SESSION] Seafarer credentials expired:", decoded.seafarerId);
        return null;
      }

      const req = seafarer.crewRequirement;
      return {
        id: seafarer.id,
        employeeId: seafarer.seafarerId,
        loginUserId: seafarer.seafarerId,
        firstName: req.firstName,
        lastName: req.lastName,
        email: req.email || `${seafarer.seafarerId}@seafarer.actinium-sm.org`,
        designation: "Seafarer",
        designationAccessLevel: 0,
        companyId: req.companyId,
        company: req.company,
        isSeafarer: true,
        seafarerId: seafarer.seafarerId,
        crewRequirementId: seafarer.crewRequirementId,
        assignedModules: [],
        assignedVessels: [],
        isActive: true,
      } as any;
    }
    
    // Regular employee lookup (company DB first; master DB for admin-only rows)
    let employee = await prisma.employee.findUnique({
      where: { 
        id: decoded.employeeId,
      },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        designation: true,
        designationAccessLevel: true,
        isActive: true,
        companyId: true,
        masterCompanyId: true,
        company: {
          select: companyProfileSelect,
        },
        assignedVessels: {
          select: {
            vessel: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    if (!employee) {
      employee = await masterPrisma.employee.findUnique({
        where: { id: decoded.employeeId },
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          designation: true,
          designationAccessLevel: true,
          isActive: true,
          companyId: true,
          masterCompanyId: true,
          company: {
            select: companyProfileSelect,
          },
          assignedVessels: {
            select: {
              vessel: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
      });
    }

    // Check if employee exists and is active
    if (!employee) {
      console.warn('[SESSION] Employee not found:', decoded.employeeId);
      return null;
    }
    
    if (!employee.isActive) {
      console.warn('[SESSION] Employee is not active:', decoded.employeeId);
      return null;
    }

    employee.designationAccessLevel = resolveEffectiveDesignationAccessLevel(
      employee.designationAccessLevel,
      decoded.designationAccessLevel
    );

    if (!employee.company?.name?.trim() && employee.companyId) {
      employee.company = await resolveCompanyForSession(employee.companyId);
    }

    employee.assignedModules = await loadEmployeeAssignedModules(employee);

    const employeeAllowedPagePaths = await resolveEmployeeAllowedPagePaths(
      employee.id,
      employee.assignedModules as Array<{ module: { id: string; name: string } }>,
      {
        designationAccessLevel: employee.designationAccessLevel,
        companyId: employee.companyId,
        masterCompanyId: (employee as { masterCompanyId?: string }).masterCompanyId,
        company: employee.company,
      }
    );
    if (employeeAllowedPagePaths?.length) {
      (employee as { employeeAllowedPagePaths?: string[] }).employeeAllowedPagePaths =
        employeeAllowedPagePaths;
    }

    const adminScope = await loadCompanyAdminScope(prisma, employee.id);
    if (adminScope) {
      (employee as any).companyAdmin = adminScope;
    }

    return employee;
  } catch (error) {
    console.error('Error getting current user from request:', error);
    return null;
  }
}

export function isAuthenticated(request: Request): boolean {
  try {
    const cookie = request.headers.get('cookie');
    if (!cookie) return false;

    const authPair = cookie
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('auth-token='));
    const token = authPair?.slice('auth-token='.length)?.trim();

    if (!token) return false;

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    return true;
  } catch {
    return false;
  }
}
