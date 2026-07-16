import { useState, useEffect, useCallback } from 'react';
import { getCurrentUser } from '@/lib/auth';
import { isSeafarerDesignationAccessLevel } from '@/lib/seafarer-access-level';

const VESSEL_STORAGE_KEY = 'selectedVesselId';
const MODULE_STORAGE_KEY = 'selectedModule';

/**
 * Custom hook for managing global vessel selection across all pages
 * Persists selection in localStorage and optionally syncs with API preferences
 */
export function useVesselSelection(
  options: {
    /** Sync with API preferences (for cross-device persistence) */
    syncWithAPI?: boolean;
    /** Default vessel ID if none is selected */
    defaultVesselId?: string;
    /** Callback when vessel changes */
    onVesselChange?: (vesselId: string) => void;
  } = {}
) {
  const { syncWithAPI = true, defaultVesselId = '', onVesselChange } = options;

  const [selectedVesselId, setSelectedVesselIdState] = useState<string>(defaultVesselId);
  const [isLoading, setIsLoading] = useState(true);

  // Load vessel selection from localStorage and API on mount
  useEffect(() => {
    const loadVesselSelection = async () => {
      try {
        // First, try to load from localStorage (faster, immediate)
        const storedVesselId = localStorage.getItem(VESSEL_STORAGE_KEY);
        if (storedVesselId) {
          setSelectedVesselIdState(storedVesselId);
          setIsLoading(false);
        }

        const user = getCurrentUser();
        const isSeafarer = isSeafarerDesignationAccessLevel(
          user?.designationAccessLevel
        );

        if (isSeafarer) {
          let lockedId = user?.vesselId ?? storedVesselId ?? '';
          try {
            const restrictionRes = await fetch('/api/user/vessel-restriction', {
              credentials: 'include',
            });
            if (restrictionRes.ok) {
              const data = await restrictionRes.json();
              lockedId =
                data?.vessel?.id ??
                data?.vessels?.[0]?.id ??
                lockedId;
            }
          } catch {
            // Use profile / localStorage fallback
          }
          if (lockedId) {
            setSelectedVesselIdState(lockedId);
            localStorage.setItem(VESSEL_STORAGE_KEY, lockedId);
          }
        } else if (syncWithAPI) {
          // Then sync with API if enabled (for cross-device persistence)
          try {
            const res = await fetch('/api/user/preferences', {
              credentials: 'include',
            });
            if (res.ok) {
              const data = await res.json();
              const apiVesselId = data.user?.lastSelectedVesselId;
              
              if (apiVesselId) {
                // Prefer API value if it exists (more authoritative)
                setSelectedVesselIdState(apiVesselId);
                localStorage.setItem(VESSEL_STORAGE_KEY, apiVesselId);
              } else if (storedVesselId) {
                // If localStorage has value but API doesn't, sync to API
                await syncVesselToAPI(storedVesselId);
              }
            }
          } catch (error) {
            console.warn('Failed to sync vessel selection with API:', error);
            // Continue with localStorage value if API fails
          }
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error loading vessel selection:', error);
        setIsLoading(false);
      }
    };

    loadVesselSelection();
  }, [syncWithAPI]);

  // Sync vessel selection to API (silently, don't await)
  const syncVesselToAPI = async (vesselId: string) => {
    try {
      await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ vesselId }),
      });
    } catch (error) {
      // Silent fail - localStorage is the source of truth for immediate persistence
      console.warn('Failed to sync vessel to API:', error);
    }
  };

  // Set vessel selection (persists to both localStorage and API)
  const setSelectedVesselId = useCallback(
    (nextVesselId: string) => {
      const user = getCurrentUser();
      let vesselId = nextVesselId;
      // Ranks 6–25 only: vessel is fixed to assignment; office users may pick any vessel.
      if (isSeafarerDesignationAccessLevel(user?.designationAccessLevel)) {
        const lockedId =
          getSelectedVesselId() ?? user?.vesselId ?? nextVesselId;
        vesselId = lockedId || nextVesselId;
      }
      setSelectedVesselIdState(vesselId);
      
      // Persist to localStorage immediately
      if (vesselId) {
        localStorage.setItem(VESSEL_STORAGE_KEY, vesselId);
      } else {
        localStorage.removeItem(VESSEL_STORAGE_KEY);
      }

      // Sync to API asynchronously (don't block UI)
      if (syncWithAPI && vesselId) {
        syncVesselToAPI(vesselId).catch(() => {
          // Silent fail - already stored in localStorage
        });
      }

      // Call optional callback
      if (onVesselChange) {
        onVesselChange(vesselId);
      }
    },
    [syncWithAPI, onVesselChange]
  );

  // Clear vessel selection
  const clearVesselSelection = useCallback(() => {
    setSelectedVesselId('');
  }, [setSelectedVesselId]);

  return {
    selectedVesselId,
    setSelectedVesselId,
    clearVesselSelection,
    isLoading,
  };
}

/**
 * Get current vessel selection from localStorage (for non-React contexts)
 */
export function getSelectedVesselId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(VESSEL_STORAGE_KEY);
}

/**
 * Set vessel selection from non-React contexts
 */
export function setSelectedVesselIdGlobal(vesselId: string): void {
  if (typeof window === 'undefined') return;
  if (vesselId) {
    localStorage.setItem(VESSEL_STORAGE_KEY, vesselId);
  } else {
    localStorage.removeItem(VESSEL_STORAGE_KEY);
  }
  
  // Dispatch custom event for React components to listen to
  window.dispatchEvent(new CustomEvent('vesselSelectionChanged', { detail: { vesselId } }));
}
