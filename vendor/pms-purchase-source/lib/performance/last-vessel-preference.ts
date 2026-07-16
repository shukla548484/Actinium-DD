/**
 * Shared last-selected vessel for idle route warm + bootstrap pack.
 */

import { getBootstrapLastVesselId, setBootstrapLastVesselId } from "@/lib/session-bootstrap-cache";

export const LAST_VESSEL_STORAGE_KEY = "act-last-vessel-id";

export function persistLastVesselId(vesselId: string): void {
  if (!vesselId) return;
  setBootstrapLastVesselId(vesselId);
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_VESSEL_STORAGE_KEY, vesselId);
  } catch {
    /* quota */
  }
}

export function readLastVesselId(): string | null {
  const fromBootstrap = getBootstrapLastVesselId();
  if (fromBootstrap) return fromBootstrap;
  if (typeof window === "undefined") return null;
  try {
    return (
      localStorage.getItem(LAST_VESSEL_STORAGE_KEY) ||
      localStorage.getItem("requisitionPageSelectedVessel") ||
      localStorage.getItem("lastSelectedVesselId")
    );
  } catch {
    return null;
  }
}
