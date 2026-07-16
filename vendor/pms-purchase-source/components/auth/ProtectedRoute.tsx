"use client";

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { useActiniumLoader } from '@/components/ActiniumLoader';
import { isAdminEquivalentAccessLevel, normalizeDesignationAccessLevel } from "@/lib/admin-access-level";
import { companyAdminCanAccessAdminPage, isCompanyAdminUser } from "@/lib/company-admin";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredAccessLevel?: number;
  /** When set, only these designation levels may access (admins still bypass). */
  allowedAccessLevels?: number[];
  requiredModule?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredAccessLevel,
  allowedAccessLevels,
  requiredModule 
}: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated, sessionReconciled } = useAuth();
  const pathname = usePathname();
  const { isLoading: pageLoading, ActiniumLoader: PageLoader, stopLoading } = useActiniumLoader(false);
  const redirectStartedRef = useRef(false);

  const navigateOnce = (href: string, replace = false) => {
    if (redirectStartedRef.current) return;
    redirectStartedRef.current = true;
    if (typeof window !== "undefined") {
      if (replace) {
        window.location.replace(href);
      } else {
        window.location.assign(href);
      }
    }
  };

  useEffect(() => {
    // If not loading and not authenticated, redirect to login with return path
    if (sessionReconciled && !isLoading && !isAuthenticated) {
      const returnPath = pathname && pathname !== "/" ? `/login?redirect=${encodeURIComponent(pathname)}` : "/login";
      navigateOnce(returnPath, true);
      return;
    }

    // Access level 50 (admin) bypasses ALL restrictions - has access to everything
    const isSuperAdmin = isAdminEquivalentAccessLevel(user?.designationAccessLevel);

    if (user && allowedAccessLevels?.length && !isSuperAdmin) {
      const level = normalizeDesignationAccessLevel(user.designationAccessLevel);
      const allowed = level != null && allowedAccessLevels.includes(level);
      if (!allowed) {
        const companyAdminPageOk =
          isCompanyAdminUser(user) &&
          companyAdminCanAccessAdminPage(pathname || '', user.companyAdmin.allowedAdminPages || []);
        if (!companyAdminPageOk) {
          navigateOnce('/unauthorized', true);
          return;
        }
      }
    }

    // If authenticated, check access level requirements
    // Access level 50 bypasses all access level requirements
    if (user && requiredAccessLevel && !isSuperAdmin && user.designationAccessLevel < requiredAccessLevel) {
      const companyAdminPageOk =
        isCompanyAdminUser(user) &&
        companyAdminCanAccessAdminPage(pathname || '', user.companyAdmin.allowedAdminPages || []);
      if (!companyAdminPageOk) {
        navigateOnce('/unauthorized', true);
        return;
      }
    }

    // If authenticated, check module access requirements
    // Users with access level 50 (admin) have access to all modules - bypass all module checks
    if (user && requiredModule && !isSuperAdmin) {
      if (user.moduleAccess) {
        let moduleAccess;
        
        // Parse moduleAccess if it's a string
        if (typeof user.moduleAccess === 'string') {
          try {
            moduleAccess = JSON.parse(user.moduleAccess);
          } catch {
            navigateOnce('/unauthorized', true);
            return;
          }
        } else {
          moduleAccess = user.moduleAccess;
        }

        if (!moduleAccess[requiredModule]) {
          navigateOnce('/unauthorized', true);
          return;
        }
      } else {
        // No moduleAccess data means no access (unless admin)
        navigateOnce('/unauthorized', true);
        return;
      }
    }

    // Stop loading immediately when authenticated and authorized
    if (!isLoading && isAuthenticated) {
      stopLoading();
    }
  }, [user, isLoading, isAuthenticated, sessionReconciled, requiredAccessLevel, allowedAccessLevels, requiredModule, stopLoading, pathname]);

  // Show loading while checking authentication
  if (isLoading || pageLoading || (!isAuthenticated && !sessionReconciled)) {
    return <PageLoader overlay text="Verifying authentication..." />;
  }

  // Show nothing while redirecting
  if (!isAuthenticated) {
    return null;
  }

  // Show children if authenticated and authorized
  return <>{children}</>;
}
