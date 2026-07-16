/**
 * Centralized hooks for fetching static data with caching
 * Static data includes: vessels, employees, companies, designations, etc.
 * These are cached for longer periods since they change infrequently
 */

import { useQuery } from "@tanstack/react-query";
import { 
  getCachedVesselsData, 
  cacheVesselsData,
  getCachedEmployeesData,
  cacheEmployeesData,
  getCachedCompaniesData,
  cacheCompaniesData,
} from "@/lib/cookie-cache";
import { fetchWithNetworkRetry, isAbortError, isTransientFetchError } from "@/lib/fetch-with-retry";

// Cache durations (in milliseconds)
const CACHE_DURATIONS = {
  VESSELS: 15 * 60 * 1000, // 15 minutes
  EMPLOYEES: 15 * 60 * 1000, // 15 minutes
  COMPANIES: 30 * 60 * 1000, // 30 minutes
  DESIGNATIONS: 60 * 60 * 1000, // 1 hour (very static)
  MODULES: 30 * 60 * 1000, // 30 minutes
} as const;

/** Refresh cache every 10 minutes while page is open */
const CACHE_REFETCH_INTERVAL_MS = 10 * 60 * 1000;

const VESSELS_FETCH_TIMEOUT_MS = 20_000;
const VESSELS_FETCH_RETRIES = 2;

/**
 * Fetch vessels with caching
 */
export function useVessels(options?: {
  limit?: number;
  isActive?: boolean;
  companyId?: string;
  enabled?: boolean;
}) {
  // Default limit reduced from 1000 to 100 for better performance
  const { limit = 100, isActive, companyId, enabled = true } = options || {};
  const shouldUseCookieShortcut = !companyId && isActive === undefined;

  return useQuery({
    queryKey: ["vessels", limit, isActive, companyId],
    retry: (failureCount, error) =>
      failureCount < 3 && isTransientFetchError(error),
    retryDelay: (attempt) => 1000 * (attempt + 1),
    placeholderData: () => {
      if (!shouldUseCookieShortcut) return undefined;
      const cached = getCachedVesselsData();
      return cached && cached.length > 0 ? cached : undefined;
    },
    queryFn: async ({ signal: querySignal }) => {
      const url = `/api/vessels?limit=${limit}${isActive ? "&isActive=true" : ""}${companyId ? `&companyId=${companyId}` : ""}`;
      let lastError: unknown = null;

      for (let attempt = 0; attempt <= VESSELS_FETCH_RETRIES; attempt++) {
        if (querySignal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        const controller = new AbortController();
        const onQueryAbort = () => controller.abort();
        querySignal?.addEventListener("abort", onQueryAbort);
        const timeoutId = setTimeout(() => controller.abort(), VESSELS_FETCH_TIMEOUT_MS);

        try {
          const response = await fetchWithNetworkRetry(url, {
            credentials: "include",
            signal: controller.signal,
            retries: 0,
          });
          clearTimeout(timeoutId);
          querySignal?.removeEventListener("abort", onQueryAbort);

          if (!response.ok) {
            throw new Error("Failed to fetch vessels");
          }

          const data = await response.json();
          const vessels = data.vessels || [];
          cacheVesselsData(vessels);
          return vessels;
        } catch (error: unknown) {
          clearTimeout(timeoutId);
          querySignal?.removeEventListener("abort", onQueryAbort);
          lastError = error;

          if (querySignal?.aborted) {
            const cached = shouldUseCookieShortcut ? getCachedVesselsData() : null;
            if (cached && cached.length > 0) return cached;
            throw error;
          }

          const timedOut = isAbortError(error);
          if (timedOut && attempt < VESSELS_FETCH_RETRIES) {
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
          if (timedOut) {
            console.warn("Vessels fetch timed out after retries");
          }
          throw error;
        }
      }

      throw lastError ?? new Error("Failed to fetch vessels");
    },
    staleTime: CACHE_DURATIONS.VESSELS,
    gcTime: CACHE_DURATIONS.VESSELS * 2, // Keep in cache for 2x stale time
    refetchInterval: CACHE_REFETCH_INTERVAL_MS, // Refresh cache every 10 min while page is open
    enabled,
  });
}

/**
 * Fetch vessels scoped for crewing users (assigned vessels + master/sub company hierarchy).
 */
export function useCrewingVessels(options?: {
  companyId?: string;
  enabled?: boolean;
}) {
  const { companyId, enabled = true } = options || {};

  return useQuery({
    queryKey: ["crewing-vessels", companyId ?? "all"],
    retry: (failureCount, error) =>
      failureCount < 3 && isTransientFetchError(error),
    retryDelay: (attempt) => 1000 * (attempt + 1),
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (companyId) params.set("companyId", companyId);
      const qs = params.toString();
      const response = await fetchWithNetworkRetry(
        `/api/crewing/vessels${qs ? `?${qs}` : ""}`,
        { credentials: "include", signal, retries: 1 }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch crewing vessels");
      }
      const data = await response.json();
      return data.vessels || [];
    },
    staleTime: CACHE_DURATIONS.VESSELS,
    gcTime: CACHE_DURATIONS.VESSELS * 2,
    enabled,
  });
}

/**
 * Fetch employees with caching
 */
export function useEmployees(options?: {
  limit?: number;
  isActive?: boolean;
  enabled?: boolean;
}) {
  const { limit = 1000, isActive, enabled = true } = options || {};

  return useQuery({
    queryKey: ["employees", limit, isActive],
    queryFn: async () => {
      // Check cache first
      const cached = getCachedEmployeesData();
      if (cached && cached.length > 0) {
        // Return cached data immediately, but still fetch in background
        fetch("/api/employees?limit=" + limit + (isActive ? "&isActive=true" : ""), {
          credentials: "include",
        })
          .then((res) => res.ok && res.json())
          .then((data) => {
            if (data?.employees) {
              cacheEmployeesData(data.employees);
            }
          })
          .catch(() => {}); // Silent fail for background refresh

        return cached;
      }

      // No cache, fetch from server with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch(
          `/api/employees?limit=${limit}${isActive ? "&isActive=true" : ""}`,
          { 
            credentials: "include",
            signal: controller.signal
          }
        );
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error("Failed to fetch employees");
        }

        const data = await response.json();
        const employees = data.employees || [];

        // Cache the data
        cacheEmployeesData(employees);

        return employees;
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.warn("Employees fetch timed out, returning empty array");
          return []; // Return empty array instead of throwing to prevent page hang
        }
        throw error;
      }
    },
    staleTime: CACHE_DURATIONS.EMPLOYEES,
    gcTime: CACHE_DURATIONS.EMPLOYEES * 2,
    refetchInterval: CACHE_REFETCH_INTERVAL_MS,
    enabled,
  });
}

/**
 * Fetch companies with caching
 */
export function useCompanies(options?: { enabled?: boolean }) {
  const { enabled = true } = options || {};

  return useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      // Check cache first
      const cached = getCachedCompaniesData();
      if (cached && cached.length > 0) {
        // Return cached data immediately, but still fetch in background
        fetch("/api/companies?limit=1000", { credentials: "include" })
          .then((res) => res.ok && res.json())
          .then((data) => {
            if (data?.companies) {
              cacheCompaniesData(data.companies);
            }
          })
          .catch(() => {}); // Silent fail for background refresh

        return cached;
      }

      // No cache, fetch from server
      const response = await fetch("/api/companies?limit=1000", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch companies");
      }

      const data = await response.json();
      const companies = data.companies || [];

      // Cache the data
      cacheCompaniesData(companies);

      return companies;
    },
    staleTime: CACHE_DURATIONS.COMPANIES,
    gcTime: CACHE_DURATIONS.COMPANIES * 2,
    refetchInterval: CACHE_REFETCH_INTERVAL_MS,
    enabled,
  });
}

/**
 * Fetch current user profile with caching
 */
export function useCurrentUser(options?: { enabled?: boolean }) {
  const { enabled = true } = options || {};

  return useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      // Check cache first
      const { getCachedUserData, cacheUserData } = await import(
        "@/lib/cookie-cache"
      );
      const cached = getCachedUserData();
      if (cached) {
        // Return cached data immediately, but still fetch in background
        fetch("/api/profile/basic", { credentials: "include" })
          .then((res) => res.ok && res.json())
          .then((data) => {
            if (data?.user) {
              cacheUserData(data.user);
            }
          })
          .catch(() => {}); // Silent fail for background refresh

        return cached;
      }

      // No cache, fetch from server
      const response = await fetch("/api/profile/basic", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch user profile");
      }

      const data = await response.json();
      const user = data.user;

      // Cache the data
      cacheUserData(user);

      return user;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes for user data
    gcTime: 10 * 60 * 1000,
    refetchInterval: CACHE_REFETCH_INTERVAL_MS,
    enabled,
  });
}

