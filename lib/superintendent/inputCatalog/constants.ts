import type { InputPageKey } from "./types";

/** Page keys included in combined readiness roll-up. */
export const INPUT_READINESS_PAGE_KEYS: InputPageKey[] = [
  "vessel",
  "superintendent",
  "workshop",
  "procurement",
  "closeout",
];

export const INPUT_PAGE_LABELS: Record<InputPageKey, string> = {
  vessel: "Vessel",
  superintendent: "Superintendent",
  workshop: "Workshop / shipyard",
  review: "Review queue",
  survey: "Survey",
  budget: "Budget",
  procurement: "Procurement",
  daily_progress: "Daily progress",
  closeout: "Closeout",
};

export function inputPageHref(dryDockProjectId: string, pageKey: InputPageKey): string {
  const map: Partial<Record<InputPageKey, string>> = {
    vessel: "vessel",
    superintendent: "superintendent",
    workshop: "workshop",
    procurement: "procurement",
    closeout: "closeout",
    review: "review",
  };
  const segment = map[pageKey];
  if (!segment) return `/superintendent/projects/${dryDockProjectId}`;
  return `/superintendent/projects/${dryDockProjectId}/inputs/${segment}`;
}

export function vesselPortalHref(dryDockProjectId: string): string {
  return `/superintendent/projects/${dryDockProjectId}/inputs/vessel-portal`;
}
