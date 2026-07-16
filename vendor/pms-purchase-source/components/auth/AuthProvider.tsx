"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useSyncExternalStore, useCallback } from 'react';
import { User, getCurrentUser, clearCurrentUser, setCurrentUser } from '@/lib/auth';
import {
  clearSessionBootstrap,
  hydrateVesselsFromBootstrap,
} from '@/lib/session-bootstrap-cache';
import { clearWarmCache } from '@/lib/performance/route-warm-cache';
import { clearUserProfileCaches } from '@/lib/cookie-cache';
import { shouldSkipOfficeLoginRedirect } from '@/lib/public-app-paths';
import { useEmailPolling } from '@/hooks/useEmailPolling';
import { prefetchSessionBootstrap } from '@/hooks/useSessionBootstrap';
import {
  hydrateCrewUserFromOfflineCache,
  saveCrewNavOfflineSnapshot,
} from '@/lib/offline/crew-nav-offline-cache';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  /** False until the first /api/auth/me reconciliation finishes (success, 401, or error). */
  sessionReconciled: boolean;
  login: (userData: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_EVENT = 'act-auth-storage-change';
const USER_STORAGE_KEY = 'user';
const CREW_NAV_STORAGE_KEY = 'actinium-crew-nav-v1';

/** Stable server snapshot for useSyncExternalStore (must be referentially stable). */
const SERVER_AUTH_SNAPSHOT: User | null = null;

let cachedAuthFingerprint: string | undefined;
let cachedAuthSnapshot: User | null = null;

function getAuthStorageFingerprint(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    const userRaw = localStorage.getItem(USER_STORAGE_KEY) ?? '';
    const crewNavRaw = localStorage.getItem(CREW_NAV_STORAGE_KEY) ?? '';
    return `${userRaw}\0${crewNavRaw}`;
  } catch {
    return '';
  }
}

function computeStoredUser(): User | null {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return null;
    return hydrateCrewUserFromOfflineCache(
      currentUser as unknown as Record<string, unknown>
    ) as User;
  } catch {
    return getCurrentUser();
  }
}

function readStoredUser(): User | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const fingerprint = getAuthStorageFingerprint();
  if (fingerprint === cachedAuthFingerprint) {
    return cachedAuthSnapshot;
  }
  cachedAuthFingerprint = fingerprint;
  cachedAuthSnapshot = computeStoredUser();
  return cachedAuthSnapshot;
}

function subscribeAuth(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler = () => callback();
  window.addEventListener(AUTH_STORAGE_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(AUTH_STORAGE_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

function getServerAuthSnapshot(): User | null {
  return SERVER_AUTH_SNAPSHOT;
}

function crewAllowedPathsEqual(
  a: string[] | undefined,
  b: string[] | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((path, i) => path === b[i]);
}

function mergeSessionCompany<T extends { company?: User['company'] | null }>(
  incoming: T,
  existing: User | null
): T {
  const nextCompany = incoming.company;
  const prevCompany = existing?.company;
  if (!nextCompany) return incoming;
  if (nextCompany.name?.trim()) return incoming;
  if (!prevCompany?.name?.trim()) return incoming;
  return {
    ...incoming,
    company: {
      ...prevCompany,
      ...nextCompany,
      name: prevCompany.name,
      logoUrl: nextCompany.logoUrl ?? prevCompany.logoUrl ?? null,
    },
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const user = useSyncExternalStore(
    subscribeAuth,
    readStoredUser,
    getServerAuthSnapshot
  );
  const [isLoading, setIsLoading] = useState(true);
  const [sessionReconciled, setSessionReconciled] = useState(false);
  const modulesSyncedRef = useRef(false);

  const notifyAuthChange = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(AUTH_STORAGE_EVENT));
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const currentPath = window.location.pathname;
    if (currentPath?.startsWith('/vendor/')) {
      clearCurrentUser();
      notifyAuthChange();
      setIsLoading(false);
      setSessionReconciled(true);
      return;
    }

    let cancelled = false;

    const applyApiUser = (apiUser: User) => {
      const merged = hydrateCrewUserFromOfflineCache(
        apiUser as unknown as Record<string, unknown>
      ) as User;
      const u = merged as User & {
        isCrewCredential?: boolean;
        vesselId?: string;
        crewAllowedPagePaths?: string[];
        employeeAllowedPagePaths?: string[];
      };
      const existing = readStoredUser() as
        | (User & {
            crewAllowedPagePaths?: string[];
            employeeAllowedPagePaths?: string[];
            assignedModules?: unknown[];
          })
        | null;
      // Only backfill paths when auth/me omits them and we are offline — online
      // sessions refresh from /api/profile/modules (office DB snapshot).
      if (
        u.isCrewCredential &&
        !u.crewAllowedPagePaths?.length &&
        typeof navigator !== "undefined" &&
        !navigator.onLine
      ) {
        if (existing?.crewAllowedPagePaths?.length) {
          (u as { crewAllowedPagePaths?: string[] }).crewAllowedPagePaths =
            existing.crewAllowedPagePaths;
        }
      }
      // Avoid auth/me wiping company DB modules before profile sync completes.
      if (
        !u.isCrewCredential &&
        existing?.assignedModules?.length &&
        !(u as User & { assignedModules?: unknown[] }).assignedModules?.length
      ) {
        (u as User & { assignedModules?: unknown[] }).assignedModules =
          existing.assignedModules;
      }
      if (
        !u.isCrewCredential &&
        !(u.employeeAllowedPagePaths?.length) &&
        existing?.employeeAllowedPagePaths?.length
      ) {
        u.employeeAllowedPagePaths = existing.employeeAllowedPagePaths;
      }
      const mergedUser = mergeSessionCompany(u as User, existing);
      if (mergedUser !== u) {
        Object.assign(u, mergedUser);
      }
      if (u.isCrewCredential && u.vesselId) {
        saveCrewNavOfflineSnapshot({
          vesselId: u.vesselId,
          rankAccessLevel: u.designationAccessLevel ?? 0,
          crewAllowedPagePaths: u.crewAllowedPagePaths ?? [],
        });
      }
      setCurrentUser(u as User);
      notifyAuthChange();
    };

    try {
      const storedRaw = localStorage.getItem(USER_STORAGE_KEY);
      const currentUser = getCurrentUser();
      if (currentUser) {
        const hydrated = hydrateCrewUserFromOfflineCache(
          currentUser as unknown as Record<string, unknown>
        ) as User;
        if ((hydrated as { isCrewCredential?: boolean }).isCrewCredential) {
          const hydratedRaw = JSON.stringify(hydrated);
          if (hydratedRaw !== storedRaw) {
            setCurrentUser(hydrated);
            notifyAuthChange();
          }
        }
      }
    } catch (error) {
      console.error('Error reading stored auth:', error);
    }

    // Unblock the UI immediately — do not wait on /api/auth/me (DB can be slow).
    setIsLoading(false);

    void (async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal,
        });
        if (cancelled) return;

        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.user) {
            applyApiUser(data.user as User);
          } else {
            clearCurrentUser();
            notifyAuthChange();
          }
        } else if (res.status === 401) {
          clearCurrentUser();
          notifyAuthChange();
          try {
            await fetch('/api/auth/logout', {
              method: 'POST',
              credentials: 'include',
            });
          } catch {
            // ignore — cookie may already be cleared
          }
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Session reconciliation failed:', error);
        }
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) {
          setSessionReconciled(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [notifyAuthChange]);

  useEffect(() => {
    if (!user) {
      modulesSyncedRef.current = false;
    }
  }, [user]);

  /** Hydrate vessels from session pack and refresh bootstrap when returning with an existing session. */
  useEffect(() => {
    if (typeof window === 'undefined' || isLoading || !user) return;
    hydrateVesselsFromBootstrap();
    const timer = setTimeout(() => {
      void prefetchSessionBootstrap();
    }, 800);
    return () => clearTimeout(timer);
  }, [user?.id, isLoading]);

  /** While online, refresh assigned modules (and crew paths) on load and when tab regains focus. */
  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;

    let cancelled = false;

    const syncModules = () => {
      if (!navigator.onLine) return;

      const u = user as User & {
        isCrewCredential?: boolean;
        vesselId?: string;
        crewCredentialId?: string;
      };

      fetch('/api/profile/modules', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (cancelled || !data) return;
          const hasPaths = Array.isArray(data.crewAllowedPagePaths);
          const hasOfficePaths = Array.isArray(data.employeeAllowedPagePaths);
          const hasModules = Array.isArray(data.modules);
          if (!hasPaths && !hasOfficePaths && !hasModules) return;

          const prev = readStoredUser();
          if (!prev) return;

          const apiPaths = hasPaths
            ? (data.crewAllowedPagePaths as string[])
            : undefined;
          const apiOfficePaths = hasOfficePaths
            ? (data.employeeAllowedPagePaths as string[])
            : undefined;
          const nextPaths = hasPaths ? (apiPaths ?? []) : prev.crewAllowedPagePaths;
          const nextOfficePaths = hasOfficePaths
            ? (apiOfficePaths ?? [])
            : (prev as User & { employeeAllowedPagePaths?: string[] }).employeeAllowedPagePaths;
          const nextModules = hasModules
            ? (data.modules as Array<{ name: string; description?: string | null }>).map(
                (m) => ({ module: m })
              )
            : prev.assignedModules;

          const incomingModuleCount = hasModules
            ? (data.modules as unknown[]).length
            : null;
          const effectiveModules =
            incomingModuleCount === 0 && (prev.assignedModules?.length ?? 0) > 0
              ? prev.assignedModules
              : nextModules;

          const pathsUnchanged =
            !hasPaths || crewAllowedPathsEqual(prev.crewAllowedPagePaths, nextPaths);
          const officePathsUnchanged =
            !hasOfficePaths ||
            crewAllowedPathsEqual(
              (prev as User & { employeeAllowedPagePaths?: string[] }).employeeAllowedPagePaths,
              nextOfficePaths
            );
          const modulesUnchanged =
            !hasModules ||
            JSON.stringify(prev.assignedModules ?? []) ===
              JSON.stringify(effectiveModules ?? []);
          if (pathsUnchanged && officePathsUnchanged && modulesUnchanged) {
            return;
          }

          const next = {
            ...prev,
            ...(hasPaths ? { crewAllowedPagePaths: nextPaths } : {}),
            ...(hasOfficePaths ? { employeeAllowedPagePaths: nextOfficePaths } : {}),
            ...(hasModules && incomingModuleCount !== 0
              ? { assignedModules: effectiveModules }
              : {}),
          } as User;
          if (u.isCrewCredential && u.vesselId) {
            saveCrewNavOfflineSnapshot({
              vesselId: u.vesselId,
              rankAccessLevel: prev.designationAccessLevel ?? 0,
              crewAllowedPagePaths: next.crewAllowedPagePaths ?? [],
            });
          }
          setCurrentUser(next);
          notifyAuthChange();
        })
        .catch(() => {
          modulesSyncedRef.current = false;
        });
    };

    syncModules();
    const onFocus = () => syncModules();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, [user, notifyAuthChange]);

  const login = (userData: User) => {
    clearUserProfileCaches();
    hydrateVesselsFromBootstrap();
    const merged = hydrateCrewUserFromOfflineCache(
      userData as unknown as Record<string, unknown>
    ) as User;
    const u = merged as User & {
      isCrewCredential?: boolean;
      vesselId?: string;
      crewAllowedPagePaths?: string[];
    };
    if (u.isCrewCredential && u.vesselId) {
      saveCrewNavOfflineSnapshot({
        vesselId: u.vesselId,
        rankAccessLevel: u.designationAccessLevel ?? 0,
        crewAllowedPagePaths: u.crewAllowedPagePaths ?? [],
      });
    }
    setCurrentUser(merged);
    notifyAuthChange();
  };

  const logout = async () => {
    try {
      // Call logout API
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearCurrentUser();
      clearSessionBootstrap();
      clearWarmCache();
      clearUserProfileCaches();
      notifyAuthChange();

      const path = typeof window !== "undefined" ? window.location.pathname : "";
      if (!shouldSkipOfficeLoginRedirect(path)) {
        window.location.href = "/login";
      }
    }
  };

  const value = {
    user,
    isLoading,
    sessionReconciled,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      <EmailPollingWrapper>
        {children}
      </EmailPollingWrapper>
    </AuthContext.Provider>
  );
}

// Wrapper component to use the email polling hook
function EmailPollingWrapper({ children }: { children: React.ReactNode }) {
  useEmailPolling();
  return <>{children}</>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}