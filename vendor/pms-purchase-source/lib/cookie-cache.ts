/**
 * Cookie-based caching utility for faster page loading
 * Uses HTTP-only cookies for secure server-side caching
 * and regular cookies for client-side caching
 */

interface CacheOptions {
  maxAge?: number; // in seconds, default 5 minutes
  path?: string;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

const DEFAULT_CACHE_AGE = 5 * 60; // 5 minutes in seconds

/**
 * Set a cookie with caching
 */
export function setCacheCookie(
  name: string,
  value: string,
  options: CacheOptions = {}
): void {
  if (typeof window === 'undefined') return; // Server-side only

  const {
    maxAge = DEFAULT_CACHE_AGE,
    path = '/',
    secure = process.env.NODE_ENV === 'production',
    sameSite = 'lax',
  } = options;

  const expires = new Date();
  expires.setTime(expires.getTime() + maxAge * 1000);

  let cookieString = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=${path}`;
  
  if (secure) {
    cookieString += '; secure';
  }
  
  cookieString += `; samesite=${sameSite}`;

  document.cookie = cookieString;
}

/**
 * Get a cookie value
 */
export function getCacheCookie(name: string): string | null {
  if (typeof window === 'undefined') return null; // Server-side only

  const nameEQ = name + '=';
  const cookies = document.cookie.split(';');
  
  for (let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i];
    while (cookie.charAt(0) === ' ') {
      cookie = cookie.substring(1, cookie.length);
    }
    if (cookie.indexOf(nameEQ) === 0) {
      return decodeURIComponent(cookie.substring(nameEQ.length, cookie.length));
    }
  }
  
  return null;
}

/**
 * Delete a cookie
 */
export function deleteCacheCookie(name: string, path: string = '/'): void {
  if (typeof window === 'undefined') return; // Server-side only
  
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path};`;
}

/**
 * Drop profile/bootstrap caches so a new sign-in cannot show the previous user's profile.
 */
export function clearUserProfileCaches(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('user_cache');
    deleteCacheCookie('user_cache_minimal');
    localStorage.removeItem('modules_cache');
  } catch (error) {
    console.error('Error clearing user profile caches:', error);
  }
}

/** Login identity from the active client session (`localStorage.user`). */
export function getSessionLoginIdentity(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const user = JSON.parse(raw) as {
      loginUserId?: string;
      employeeId?: string;
    };
    const id = user.loginUserId?.trim() || user.employeeId?.trim();
    return id ? id.toUpperCase() : null;
  } catch {
    return null;
  }
}

function profileCacheMatchesSession(cached: {
  loginUserId?: string;
  employeeId?: string;
  id?: string;
}): boolean {
  const sessionLogin = getSessionLoginIdentity();
  if (!sessionLogin) return true;
  const cachedLogin = (
    cached.loginUserId?.trim() ||
    cached.employeeId?.trim() ||
    ''
  ).toUpperCase();
  return !cachedLogin || cachedLogin === sessionLogin;
}

/**
 * Cache user data - uses localStorage for large data, cookie for small essential data
 * Cookies have 4KB limit, so we store minimal data in cookie and full data in localStorage
 */
export function cacheUserData(userData: any): void {
  try {
    // Store full data in localStorage (no size limit)
    const cacheData = {
      data: userData,
      timestamp: Date.now(),
    };
    localStorage.setItem('user_cache', JSON.stringify(cacheData));
    
    // Store only essential minimal data in cookie (for server-side access)
    const minimalData = {
      id: userData?.id,
      email: userData?.email,
      designationAccessLevel: userData?.designationAccessLevel,
      timestamp: Date.now(),
    };
    const cookieData = JSON.stringify(minimalData);
    
    // Only set cookie if it's under 4KB (with some margin)
    if (cookieData.length < 3500) {
      setCacheCookie('user_cache_minimal', cookieData, {
        maxAge: 10 * 60, // 10 minutes
      });
    }
  } catch (error) {
    console.error('Error caching user data:', error);
    // If localStorage fails (e.g., private browsing), try cookie with minimal data
    try {
      const minimalData = {
        id: userData?.id,
        email: userData?.email,
        designationAccessLevel: userData?.designationAccessLevel,
        timestamp: Date.now(),
      };
      setCacheCookie('user_cache_minimal', JSON.stringify(minimalData), {
        maxAge: 10 * 60,
      });
    } catch (cookieError) {
      console.error('Error caching minimal user data:', cookieError);
    }
  }
}

/**
 * Get cached user data - checks localStorage first, then cookie
 */
export function getCachedUserData(): any | null {
  try {
    // Try localStorage first (full data)
    const localStorageData = localStorage.getItem('user_cache');
    if (localStorageData) {
      try {
        const cacheData = JSON.parse(localStorageData);
        const now = Date.now();
        const maxAge = 10 * 60 * 1000; // 10 minutes

        if (now - cacheData.timestamp < maxAge && cacheData.data != null) {
          if (profileCacheMatchesSession(cacheData.data)) {
            return cacheData.data;
          }
          localStorage.removeItem('user_cache');
        } else if (now - cacheData.timestamp >= maxAge) {
          // Cache expired, remove it
          localStorage.removeItem('user_cache');
        }
      } catch (e) {
        // Invalid data, remove it
        localStorage.removeItem('user_cache');
      }
    }

    // Fallback to cookie (minimal data)
    const cached = getCacheCookie('user_cache_minimal');
    if (cached) {
      try {
        const cacheData = JSON.parse(cached);
        const now = Date.now();
        const maxAge = 10 * 60 * 1000; // 10 minutes

        if (now - cacheData.timestamp < maxAge) {
          // Full cache shape: { data, timestamp }. Minimal cookie shape: { id, email, ... , timestamp } (no .data)
          if (cacheData.data != null) {
            return cacheData.data;
          }
          if (cacheData.id != null || cacheData.email != null) {
            return {
              id: cacheData.id ?? '',
              employeeId: cacheData.id ?? '',
              email: cacheData.email ?? '',
              firstName: cacheData.firstName ?? '',
              lastName: cacheData.lastName ?? '',
              designationAccessLevel: cacheData.designationAccessLevel,
              createdAt: cacheData.createdAt ?? new Date(0).toISOString(),
              company: cacheData.company ?? { name: '', code: '' },
            };
          }
        }

        // Cache expired, remove it
        deleteCacheCookie('user_cache_minimal');
      } catch (e) {
        deleteCacheCookie('user_cache_minimal');
      }
    }

    return null;
  } catch (error) {
    console.error('Error reading cached user data:', error);
    return null;
  }
}

/**
 * Get current user ID for user-scoped client caches (client-side only).
 * auth-token is httpOnly — it is not visible on document.cookie.
 */
function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr) as {
        id?: string;
        employeeId?: string;
        loginUserId?: string;
      };
      const id = user.id?.trim() || user.employeeId?.trim() || user.loginUserId?.trim();
      if (id) return id;
    }
  } catch {
    /* ignore parse errors */
  }

  return getSessionLoginIdentity();
}

/**
 * Cache vessels data - uses localStorage for large data (user-specific)
 */
export function cacheVesselsData(vessels: any[]): void {
  // Guard against SSR - only run on client
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      // Session not hydrated yet — skip until login/bootstrap writes localStorage user
      return;
    }
    
    const cacheData = {
      data: vessels,
      timestamp: Date.now(),
    };
    // Store in localStorage with user-specific key
    localStorage.setItem(`vessels_cache_${userId}`, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error caching vessels data:', error);
  }
}

/**
 * Get cached vessels data from localStorage (user-specific)
 */
export function getCachedVesselsData(): any[] | null {
  // Guard against SSR - only run on client
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      // If we can't get user ID, don't return cached data (safety measure)
      return null;
    }
    
    const cached = localStorage.getItem(`vessels_cache_${userId}`);
    if (!cached) return null;

    const cacheData = JSON.parse(cached);
    const now = Date.now();
    const maxAge = 15 * 60 * 1000; // 15 minutes

    if (now - cacheData.timestamp < maxAge) {
      return cacheData.data;
    }

    localStorage.removeItem(`vessels_cache_${userId}`);
    return null;
  } catch (error) {
    console.error('Error reading cached vessels data:', error);
    return null;
  }
}

/**
 * Cache modules data - uses localStorage
 */
export function cacheModulesData(modules: any[]): void {
  try {
    const cacheData = {
      data: modules,
      timestamp: Date.now(),
    };
    // Store in localStorage (no size limit)
    localStorage.setItem('modules_cache', JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error caching modules data:', error);
  }
}

/**
 * Get cached modules data from localStorage
 */
export function getCachedModulesData(): any[] | null {
  try {
    const cached = localStorage.getItem('modules_cache');
    if (!cached) return null;

    const cacheData = JSON.parse(cached);
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    if (now - cacheData.timestamp < maxAge) {
      return cacheData.data;
    }

    localStorage.removeItem('modules_cache');
    return null;
  } catch (error) {
    console.error('Error reading cached modules data:', error);
    return null;
  }
}

/**
 * Cache employees data - uses localStorage
 */
export function cacheEmployeesData(employees: any[]): void {
  try {
    const cacheData = {
      data: employees,
      timestamp: Date.now(),
    };
    localStorage.setItem('employees_cache', JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error caching employees data:', error);
  }
}

/**
 * Get cached employees data from localStorage
 */
export function getCachedEmployeesData(): any[] | null {
  try {
    const cached = localStorage.getItem('employees_cache');
    if (!cached) return null;

    const cacheData = JSON.parse(cached);
    const now = Date.now();
    const maxAge = 15 * 60 * 1000; // 15 minutes

    if (now - cacheData.timestamp < maxAge) {
      return cacheData.data;
    }

    localStorage.removeItem('employees_cache');
    return null;
  } catch (error) {
    console.error('Error reading cached employees data:', error);
    return null;
  }
}

/**
 * Cache companies data - uses localStorage
 */
export function cacheCompaniesData(companies: any[]): void {
  try {
    const cacheData = {
      data: companies,
      timestamp: Date.now(),
    };
    localStorage.setItem('companies_cache', JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error caching companies data:', error);
  }
}

/**
 * Get cached companies data from localStorage
 */
export function getCachedCompaniesData(): any[] | null {
  try {
    const cached = localStorage.getItem('companies_cache');
    if (!cached) return null;

    const cacheData = JSON.parse(cached);
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    if (now - cacheData.timestamp < maxAge) {
      return cacheData.data;
    }

    localStorage.removeItem('companies_cache');
    return null;
  } catch (error) {
    console.error('Error reading cached companies data:', error);
    return null;
  }
}

/** Cache max age: 10 minutes (used for vessel details, profile vessels refresh) */
const CACHE_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Cache vessel details (single vessel) - uses localStorage (payload can be large)
 */
export function cacheVesselDetails(vesselId: string, vesselData: any): void {
  if (typeof window === 'undefined') return;
  try {
    const cacheData = {
      data: vesselData,
      timestamp: Date.now(),
    };
    localStorage.setItem(`vessel_details_${vesselId}`, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error caching vessel details:', error);
  }
}

/**
 * Get cached vessel details - returns null if expired or missing
 */
export function getCachedVesselDetails(vesselId: string): any | null {
  if (typeof window === 'undefined' || !vesselId) return null;
  try {
    const cached = localStorage.getItem(`vessel_details_${vesselId}`);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (Date.now() - (parsed.timestamp || 0) > CACHE_MAX_AGE_MS) return null;
    return parsed.data ?? null;
  } catch (error) {
    console.error('Error reading cached vessel details:', error);
    return null;
  }
}

/**
 * Cache profile vessels (assigned vessels from /api/profile/vessels)
 */
export function cacheProfileVesselsData(vessels: any[]): void {
  if (typeof window === 'undefined') return;
  try {
    const userId = getCurrentUserId();
    if (!userId) return;
    const cacheData = {
      data: vessels,
      timestamp: Date.now(),
    };
    localStorage.setItem(`profile_vessels_cache_${userId}`, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error caching profile vessels:', error);
  }
}

/**
 * Get cached profile vessels
 */
export function getCachedProfileVesselsData(): any[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const userId = getCurrentUserId();
    if (!userId) return null;
    const cached = localStorage.getItem(`profile_vessels_cache_${userId}`);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (Date.now() - (parsed.timestamp || 0) > CACHE_MAX_AGE_MS) return null;
    return Array.isArray(parsed.data) ? parsed.data : null;
  } catch (error) {
    console.error('Error reading cached profile vessels:', error);
    return null;
  }
}

/**
 * Cache company details (single company) - uses localStorage
 */
export function cacheCompanyDetails(companyId: string, companyData: any): void {
  if (typeof window === 'undefined') return;
  try {
    const cacheData = {
      data: companyData,
      timestamp: Date.now(),
    };
    localStorage.setItem(`company_details_${companyId}`, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error caching company details:', error);
  }
}

/**
 * Get cached company details
 */
export function getCachedCompanyDetails(companyId: string): any | null {
  if (typeof window === 'undefined' || !companyId) return null;
  try {
    const cached = localStorage.getItem(`company_details_${companyId}`);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (Date.now() - (parsed.timestamp || 0) > CACHE_MAX_AGE_MS) return null;
    return parsed.data ?? null;
  } catch (error) {
    console.error('Error reading cached company details:', error);
    return null;
  }
}

/**
 * Clear all cache cookies and localStorage
 */
export function clearAllCache(): void {
  deleteCacheCookie('user_cache');
  deleteCacheCookie('user_cache_minimal');
  deleteCacheCookie('vessels_cache');
  deleteCacheCookie('modules_cache');
  deleteCacheCookie('employees_cache');
  deleteCacheCookie('companies_cache');
  
  // Clear localStorage
  try {
    localStorage.removeItem('user_cache');
    localStorage.removeItem('modules_cache');
    localStorage.removeItem('employees_cache');
    localStorage.removeItem('companies_cache');
    const userId = getCurrentUserId();
    if (userId) {
      localStorage.removeItem(`vessels_cache_${userId}`);
      localStorage.removeItem(`profile_vessels_cache_${userId}`);
    }
    // Clear vessel details cache (by prefix)
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('vessel_details_') || key.startsWith('company_details_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (error) {
    console.error('Error clearing localStorage cache:', error);
  }
}

/**
 * Generic cache function for any data
 */
export function cacheData<T>(
  key: string,
  data: T,
  maxAgeSeconds: number = DEFAULT_CACHE_AGE
): void {
  try {
    const cacheData = {
      data,
      timestamp: Date.now(),
    };
    setCacheCookie(`cache_${key}`, JSON.stringify(cacheData), {
      maxAge: maxAgeSeconds,
    });
  } catch (error) {
    console.error(`Error caching data for key ${key}:`, error);
  }
}

/**
 * Get cached data by key
 */
export function getCachedData<T>(
  key: string,
  maxAgeSeconds: number = DEFAULT_CACHE_AGE
): T | null {
  try {
    const cached = getCacheCookie(`cache_${key}`);
    if (!cached) return null;

    const cacheData = JSON.parse(cached);
    const now = Date.now();
    const maxAge = maxAgeSeconds * 1000;

    if (now - cacheData.timestamp < maxAge) {
      return cacheData.data as T;
    }

    deleteCacheCookie(`cache_${key}`);
    return null;
  } catch (error) {
    console.error(`Error reading cached data for key ${key}:`, error);
    return null;
  }
}

