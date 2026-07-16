/**
 * Hook for cached data fetching with cookie-based caching
 * Provides faster page loading by using cached data when available.
 * Cookies/cache are refreshed every 10 minutes while the page is open.
 */

const CACHE_REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

import { useState, useEffect, useCallback } from 'react';
import {
  getCachedUserData,
  cacheUserData,
  getCachedVesselsData,
  cacheVesselsData,
  getCachedModulesData,
  cacheModulesData,
  getCachedData,
  cacheData,
  getCachedVesselDetails,
  cacheVesselDetails,
} from '@/lib/cookie-cache';

interface UseCachedDataOptions {
  cacheKey?: string;
  maxAge?: number; // in seconds
  refreshOnMount?: boolean; // Force refresh even if cache exists
}

/**
 * Hook for fetching and caching user profile data
 */
export function useCachedUser(options: UseCachedDataOptions = {}) {
  const { refreshOnMount = false } = options;
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async (forceRefresh = false) => {
    // Check cache first unless forcing refresh
    if (!forceRefresh && !refreshOnMount) {
      const cached = getCachedUserData();
      if (cached) {
        setUser(cached);
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/profile/basic', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        cacheUserData(data.user);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch user' }));
        setError(errorData.error || 'Failed to fetch user');
        setUser(null);
      }
    } catch (err: any) {
      console.error('Error fetching user:', err);
      setError(err.message || 'Failed to fetch user');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [refreshOnMount]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Refresh cache every 10 minutes while page is open
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchUser(true);
    }, CACHE_REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchUser]);

  return {
    user,
    isLoading,
    error,
    refresh: () => fetchUser(true),
  };
}

/**
 * Hook for fetching and caching vessels data
 */
export function useCachedVessels(options: UseCachedDataOptions = {}) {
  const { refreshOnMount = false } = options;
  const [vessels, setVessels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVessels = useCallback(async (forceRefresh = false) => {
    // Check cache first unless forcing refresh
    if (!forceRefresh && !refreshOnMount) {
      const cached = getCachedVesselsData();
      if (cached && cached.length > 0) {
        setVessels(cached);
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/vessels?limit=1000', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const vesselsArray = data.vessels || data.data || [];
        setVessels(vesselsArray);
        cacheVesselsData(vesselsArray);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch vessels' }));
        setError(errorData.error || 'Failed to fetch vessels');
        setVessels([]);
      }
    } catch (err: any) {
      console.error('Error fetching vessels:', err);
      setError(err.message || 'Failed to fetch vessels');
      setVessels([]);
    } finally {
      setIsLoading(false);
    }
  }, [refreshOnMount]);

  useEffect(() => {
    fetchVessels();
  }, [fetchVessels]);

  // Refresh cache every 10 minutes while page is open
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchVessels(true);
    }, CACHE_REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchVessels]);

  return {
    vessels,
    isLoading,
    error,
    refresh: () => fetchVessels(true),
  };
}

/**
 * Hook for fetching and caching modules data
 */
export function useCachedModules(options: UseCachedDataOptions = {}) {
  const { refreshOnMount = false } = options;
  const [modules, setModules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModules = useCallback(async (forceRefresh = false) => {
    // Check cache first unless forcing refresh
    if (!forceRefresh && !refreshOnMount) {
      const cached = getCachedModulesData();
      if (cached && cached.length > 0) {
        setModules(cached);
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/profile/modules', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const modulesArray = data.modules || [];
        setModules(modulesArray);
        cacheModulesData(modulesArray);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch modules' }));
        setError(errorData.error || 'Failed to fetch modules');
        setModules([]);
      }
    } catch (err: any) {
      console.error('Error fetching modules:', err);
      setError(err.message || 'Failed to fetch modules');
      setModules([]);
    } finally {
      setIsLoading(false);
    }
  }, [refreshOnMount]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  // Refresh cache every 10 minutes while page is open
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchModules(true);
    }, CACHE_REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchModules]);

  return {
    modules,
    isLoading,
    error,
    refresh: () => fetchModules(true),
  };
}

/**
 * Generic hook for fetching and caching any data
 */
export function useCachedFetch<T>(
  url: string,
  options: UseCachedDataOptions & {
    cacheKey: string;
    maxAge?: number;
  } = { cacheKey: '' }
) {
  const { cacheKey, maxAge = 5 * 60, refreshOnMount = false } = options;
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!cacheKey) {
      console.error('useCachedFetch: cacheKey is required');
      return;
    }

    // Check cache first unless forcing refresh
    if (!forceRefresh && !refreshOnMount) {
      const cached = getCachedData<T>(cacheKey, maxAge);
      if (cached) {
        setData(cached);
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        credentials: 'include',
      });

      if (response.ok) {
        const responseData = await response.json();
        setData(responseData);
        cacheData(cacheKey, responseData, maxAge);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch data' }));
        setError(errorData.error || 'Failed to fetch data');
        setData(null);
      }
    } catch (err: any) {
      console.error(`Error fetching data from ${url}:`, err);
      setError(err.message || 'Failed to fetch data');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [url, cacheKey, maxAge, refreshOnMount]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refresh: () => fetchData(true),
  };
}

/**
 * Hook for vessel details: load from cache immediately, then fetch from API.
 * Refreshes cache every 10 minutes while page is open.
 * Use on any page that needs vessel details (e.g. companyId, vessel name) for the selected vessel.
 */
export function useCachedVesselDetails(vesselId: string | null) {
  const [vessel, setVessel] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(!!vesselId);
  const [error, setError] = useState<string | null>(null);

  const fetchVesselDetails = useCallback(async (forceRefresh = false) => {
    if (!vesselId) {
      setVessel(null);
      setIsLoading(false);
      return;
    }

    if (!forceRefresh) {
      const cached = getCachedVesselDetails(vesselId);
      if (cached) {
        setVessel(cached);
        setIsLoading(false);
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/vessels/${vesselId}/details`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const vesselData = data.vessel ?? data;
        setVessel(vesselData);
        cacheVesselDetails(vesselId, vesselData);
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.error || 'Failed to fetch vessel details');
        setVessel(null);
      }
    } catch (err: any) {
      console.error('Error fetching vessel details:', err);
      setError(err?.message || 'Failed to fetch vessel details');
      setVessel(null);
    } finally {
      setIsLoading(false);
    }
  }, [vesselId]);

  useEffect(() => {
    fetchVesselDetails();
  }, [fetchVesselDetails]);

  // Refresh cache every 10 minutes while page is open
  useEffect(() => {
    if (!vesselId) return;
    const intervalId = setInterval(() => {
      fetchVesselDetails(true);
    }, CACHE_REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [vesselId, fetchVesselDetails]);

  return {
    vessel,
    isLoading,
    error,
    refresh: () => fetchVesselDetails(true),
  };
}












