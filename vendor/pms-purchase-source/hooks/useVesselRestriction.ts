import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { isSeafarerDesignationAccessLevel } from "@/lib/seafarer-access-level";
import { fetchWithNetworkRetry, isAbortError } from "@/lib/fetch-with-retry";

export type RestrictedVessel = {
  id: string;
  name: string;
  code: string;
};

interface VesselRestriction {
  restricted: boolean;
  vessel: RestrictedVessel | null;
  vessels?: RestrictedVessel[];
  vesselCodePrefix?: string;
}

const UNRESTRICTED: VesselRestriction = {
  restricted: false,
  vessel: null,
  vessels: [],
};

/**
 * Hook to get vessel restriction for the current user (access levels 6–25 only).
 * Office/shore users (outside 6–25) are never restricted and keep full vessel dropdown access.
 */
export function useVesselRestriction(options?: { enabled?: boolean }) {
  const { user, isLoading: authLoading } = useAuth();
  const rankRestricted =
    options?.enabled ??
    isSeafarerDesignationAccessLevel(user?.designationAccessLevel);
  const enabled = rankRestricted && !authLoading && !!user;

  const [restriction, setRestriction] = useState<VesselRestriction | null>(
    rankRestricted ? null : UNRESTRICTED
  );
  const [loading, setLoading] = useState(rankRestricted);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rankRestricted) {
      setRestriction(UNRESTRICTED);
      setLoading(false);
      setError(null);
      return;
    }

    if (authLoading || !user) {
      setLoading(true);
      return;
    }

    let cancelled = false;

    const fetchRestriction = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetchWithNetworkRetry("/api/user/vessel-restriction", {
          credentials: "include",
          retries: 2,
          delayMs: 1000,
        });

        if (cancelled) return;

        if (!response.ok) {
          if (response.status === 401) {
            setRestriction({ restricted: false, vessel: null, vessels: [] });
            return;
          }
          setError("Failed to fetch vessel restriction");
          setRestriction({ restricted: false, vessel: null, vessels: [] });
          return;
        }

        const data = (await response.json()) as VesselRestriction;
        if (!cancelled) {
          setRestriction(data);
        }
      } catch (err) {
        if (cancelled || isAbortError(err)) return;
        setError(err instanceof Error ? err.message : "Unknown error");
        setRestriction({ restricted: false, vessel: null, vessels: [] });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchRestriction();
    return () => {
      cancelled = true;
    };
  }, [rankRestricted, authLoading, user]);

  const assignedVessels =
    restriction?.vessels && restriction.vessels.length > 0
      ? restriction.vessels
      : restriction?.vessel
        ? [restriction.vessel]
        : [];

  return {
    restriction,
    loading,
    error,
    isRestricted: restriction?.restricted ?? false,
    restrictedVessel: restriction?.vessel ?? assignedVessels[0] ?? null,
    assignedVessels,
  };
}
