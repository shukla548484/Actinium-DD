/**
 * Comprehensive API Security Wrapper
 * Ensures all API routes are protected and no unauthorized access is possible
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from './session';
import prisma from './prisma';
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import { isCompanyAdminUser, companyAdminCanAccessApiPath } from "@/lib/company-admin";

export interface SecureRequestContext {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUserFromRequest>>>;
  companyId: string;
  userId: string;
  /** Company Admin: IDs of master + all descendant companies (data scope). */
  companyAdminScopedCompanyIds: string[] | null;
}

/**
 * Security options for API routes
 */
export interface SecurityOptions {
  /** Require authentication (default: true) */
  requireAuth?: boolean;
  /** Minimum access level required (1-50) */
  minAccessLevel?: number;
  /** Required module access */
  requiredModule?: string;
  /** Allow only specific HTTP methods */
  allowedMethods?: string[];
  /** Rate limiting enabled (default: true) */
  rateLimit?: boolean;
  /** Validate company access (default: true) */
  validateCompany?: boolean;
}

/**
 * Secure API route wrapper
 * Ensures authentication, authorization, and security checks
 */
export function secureApiRoute<T = any>(
  handler: (request: NextRequest, context: SecureRequestContext, params?: any) => Promise<NextResponse<T>>,
  options: SecurityOptions = {}
) {
  return async (request: NextRequest, context?: { params?: Promise<any> | any }): Promise<NextResponse> => {
    // Handle Next.js 15 params (can be Promise)
    let params: any = undefined;
    if (context?.params) {
      params = context.params instanceof Promise ? await context.params : context.params;
    }
    try {
      // 1. Check HTTP method
      if (options.allowedMethods && !options.allowedMethods.includes(request.method)) {
        return NextResponse.json(
          { error: 'Method not allowed' },
          { status: 405 }
        );
      }

      // 2. Require authentication (default: true)
      if (options.requireAuth !== false) {
        const user = await getCurrentUserFromRequest(request);
        
        if (!user) {
          return NextResponse.json(
            { error: 'Unauthorized', message: 'Authentication required' },
            { status: 401 }
          );
        }

        // 3. Check if user is active
        if (!user.isActive) {
          console.warn('[SECURITY] Inactive user attempted access:', {
            userId: user.id,
            path: request.nextUrl.pathname,
          });
          
          return NextResponse.json(
            { error: 'Unauthorized', message: 'Account is inactive' },
            { status: 403 }
          );
        }

        const isCompanyAdmin = isCompanyAdminUser(user);
        const hasAdminBypass = isAdminEquivalentAccessLevel(user.designationAccessLevel) && !isCompanyAdmin;
        const companyAdminAllowedPages = (user as any).companyAdmin?.allowedAdminPages || [];

        // Company Admin: enforce API allow-list mapped from assigned Admin pages
        if (isCompanyAdmin) {
          const allowedAdminPages = companyAdminAllowedPages;
          if (!companyAdminCanAccessApiPath(request.nextUrl.pathname, allowedAdminPages)) {
            return NextResponse.json(
              { error: 'Forbidden', message: 'Company Admin does not have access to this API' },
              { status: 403 }
            );
          }
        }

        // 4. Check access level (if specified)
        if (options.minAccessLevel !== undefined) {
          const userAccessLevel = user.designationAccessLevel ?? 0;
          // Super admin bypasses access level checks. Company Admin may access APIs that map to assigned admin pages.
          const companyAdminMinLevelOk =
            isCompanyAdmin &&
            companyAdminCanAccessApiPath(request.nextUrl.pathname, companyAdminAllowedPages);
          if (!hasAdminBypass && userAccessLevel < options.minAccessLevel && !companyAdminMinLevelOk) {
            console.warn('[SECURITY] Insufficient access level:', {
              userId: user.id,
              required: options.minAccessLevel,
              actual: userAccessLevel,
              path: request.nextUrl.pathname,
            });

            return NextResponse.json(
              { error: 'Forbidden', message: 'Insufficient permissions' },
              { status: 403 }
            );
          }
        }

        // 5. Check module access (if specified)
        if (options.requiredModule) {
          // Super admin bypasses module checks. Company Admin never bypasses.
          if (!hasAdminBypass) {
            const assignedModules = (user as any).assignedModules || [];
            const hasModuleAccess = Array.isArray(assignedModules) && assignedModules.some(
              (m: any) => m?.module?.name === options.requiredModule
            );
            
            if (!hasModuleAccess) {
              console.warn('[SECURITY] Missing module access:', {
                userId: user.id,
                requiredModule: options.requiredModule,
                path: request.nextUrl.pathname,
              });
              
              return NextResponse.json(
                { error: 'Forbidden', message: `Access to ${options.requiredModule} module required` },
                { status: 403 }
              );
            }
          }
        }

        // 6. Determine company context
        const userCompanyId = (user as any).companyId || (user as any).company?.id || '';
        const companyAdminScopedCompanyIds = isCompanyAdmin
          ? ((user as any).companyAdmin?.scopedCompanyIds || [])
          : null;
        const companyId = hasAdminBypass
          ? ''
          : (isCompanyAdmin ? ((user as any).companyAdmin?.masterCompanyId || userCompanyId) : userCompanyId);

        // 7. Create secure context
        const secureContext: SecureRequestContext = {
          user,
          companyId,
          userId: user.id,
          companyAdminScopedCompanyIds,
        };

        // 8. Execute handler
        const response = await handler(request, secureContext, params);
        return addSecurityHeaders(response);
      } else {
        // Public route - still add security headers
        const secureContext = {} as SecureRequestContext;
        const response = await handler(request, secureContext, params);
        return addSecurityHeaders(response);
      }
    } catch (error: any) {
      console.error('='.repeat(80));
      console.error('[SECURITY] API route error:', {
        path: request.nextUrl.pathname,
        method: request.method,
        error: error.message,
        errorType: error?.constructor?.name,
        errorCode: error?.code,
        stack: error.stack,
      });
      console.error('='.repeat(80));
      
      // Return more detailed error in development
      const errorMessage = process.env.NODE_ENV === 'development' 
        ? error.message 
        : 'An error occurred processing your request';
      
      return NextResponse.json(
        { 
          error: 'Internal server error', 
          message: errorMessage,
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  const contentType = response.headers.get("Content-Type") || "";
  const isBinaryFileResponse =
    contentType.includes("application/pdf") ||
    contentType.includes("application/octet-stream") ||
    contentType.startsWith("image/") ||
    contentType.includes("spreadsheet") ||
    contentType.includes("wordprocessing") ||
    contentType.includes("msword");

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  if (!isBinaryFileResponse) {
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-XSS-Protection", "1; mode=block");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
    );
  }

  // Remove server information
  response.headers.delete("X-Powered-By");

  // HSTS in production
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  return response;
}

/**
 * Validate company access for database queries
 * Ensures users can only access their company's data
 */
export async function validateCompanyAccess(
  context: SecureRequestContext,
  resourceCompanyId: string | null | undefined,
  resourceId?: string
): Promise<boolean> {
  // Super admin can access all companies (Company Admin is scoped and never bypasses)
  if (
    isAdminEquivalentAccessLevel(context.user.designationAccessLevel) &&
    !isCompanyAdminUser(context.user)
  ) {
    return true;
  }

  // If resource has no company ID, deny access
  if (!resourceCompanyId) {
    console.warn('[SECURITY] Resource has no company ID:', {
      userId: context.userId,
      resourceId,
    });
    return false;
  }

  // Company Admin can access only master-company subtree
  if (isCompanyAdminUser(context.user)) {
    const scope = context.companyAdminScopedCompanyIds || [];
    if (scope.includes(resourceCompanyId)) return true;
  }

  // Standard users: resource must belong to user's company
  if (resourceCompanyId !== context.companyId) {
    console.warn('[SECURITY] Company access violation:', {
      userId: context.userId,
      userCompanyId: context.companyId,
      resourceCompanyId,
      resourceId,
    });
    return false;
  }

  return true;
}

/**
 * Validate vessel access for database queries
 * Ensures users can only access vessels they have access to
 */
export async function validateVesselAccess(
  context: SecureRequestContext,
  vesselId: string
): Promise<boolean> {
  // Super admin can access all vessels (Company Admin is scoped and never bypasses)
  if (
    isAdminEquivalentAccessLevel(context.user.designationAccessLevel) &&
    !isCompanyAdminUser(context.user)
  ) {
    return true;
  }

  // Check if user has access to this vessel
  const assignedVessels = (context.user as any).assignedVessels || [];
  const hasVesselAccess = Array.isArray(assignedVessels) && assignedVessels.some(
    (v: any) => v?.vessel?.id === vesselId
  );

  if (!hasVesselAccess) {
    console.warn('[SECURITY] Vessel access violation:', {
      userId: context.userId,
      vesselId,
    });
    return false;
  }

  return true;
}

/**
 * Sanitize and validate input
 */
export function sanitizeInput(input: any): any {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'string') {
    // Remove null bytes and trim
    return input.replace(/\0/g, '').trim();
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }

  if (typeof input === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      // Sanitize key
      const sanitizedKey = typeof key === 'string' ? key.replace(/\0/g, '').trim() : key;
      sanitized[sanitizedKey] = sanitizeInput(value);
    }
    return sanitized;
  }

  return input;
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate and sanitize UUID
 */
export function validateUUID(uuid: string, fieldName: string = 'ID'): string | null {
  if (!uuid || typeof uuid !== 'string') {
    return null;
  }

  const sanitized = sanitizeInput(uuid);
  
  if (!isValidUUID(sanitized)) {
    console.warn('[SECURITY] Invalid UUID format:', {
      field: fieldName,
      value: uuid,
    });
    return null;
  }

  return sanitized;
}

/**
 * Create secure database query with company filter
 */
export function createSecureQuery(context: SecureRequestContext, baseQuery: any = {}) {
  // Super admin can access all companies
  if (
    isAdminEquivalentAccessLevel(context.user.designationAccessLevel) &&
    !isCompanyAdminUser(context.user)
  ) {
    return baseQuery;
  }

  if (isCompanyAdminUser(context.user) && context.companyAdminScopedCompanyIds?.length) {
    return {
      ...baseQuery,
      companyId: { in: context.companyAdminScopedCompanyIds },
    };
  }

  // Regular users can only access their company's data
  return {
    ...baseQuery,
    companyId: context.companyId,
  };
}

/**
 * Log security events
 */
export function logSecurityEvent(
  event: string,
  details: Record<string, any>,
  severity: 'low' | 'medium' | 'high' = 'medium'
) {
  console.warn(`[SECURITY-${severity.toUpperCase()}] ${event}:`, {
    timestamp: new Date().toISOString(),
    ...details,
  });
}




