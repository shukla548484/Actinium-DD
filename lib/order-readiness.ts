/**
 * Order / logistics readiness on {@link OrderTracking} (purchase orders).
 * Single enum for all commodity types (stores, spares, lubes, paint, etc.).
 */

export const ORDER_READINESS_VALUES = [
  "NOT_READY",
  "IN_PREPARATION",
  "READY_FOR_DISPATCH",
  "DISPATCHED",
  "IN_TRANSIT",
  "DELIVERED_TO_AGENT",
  "DELIVERED_ONBOARD",
  "DELAYED",
] as const;

export type OrderReadinessValue = (typeof ORDER_READINESS_VALUES)[number];

export const ORDER_READINESS_LABELS: Record<OrderReadinessValue, string> = {
  NOT_READY: "Not Ready",
  IN_PREPARATION: "In Preparation",
  READY_FOR_DISPATCH: "Ready for Dispatch",
  DISPATCHED: "Dispatched",
  IN_TRANSIT: "In Transit",
  DELIVERED_TO_AGENT: "Delivered to Agent",
  DELIVERED_ONBOARD: "Delivered Onboard",
  DELAYED: "Delayed",
};

export const ORDER_READINESS_OPTIONS = ORDER_READINESS_VALUES.map((value) => ({
  value,
  label: ORDER_READINESS_LABELS[value],
}));

export function isValidOrderReadiness(s: string): s is OrderReadinessValue {
  return (ORDER_READINESS_VALUES as readonly string[]).includes(s);
}

export function formatOrderReadinessLabel(status: string | null | undefined): string {
  if (!status) return "—";
  if (isValidOrderReadiness(status)) return ORDER_READINESS_LABELS[status];
  return status.replace(/_/g, " ");
}

/** Summary counts: treat both delivered states as “delivered” for KPI cards. */
export function isOrderReadinessDelivered(status: string | null | undefined): boolean {
  return status === "DELIVERED_TO_AGENT" || status === "DELIVERED_ONBOARD";
}

/** Tailwind classes for vendor / office badges (matches previous styling). */
export const ORDER_READINESS_BADGE_CLASS: Record<OrderReadinessValue, string> = {
  NOT_READY: "bg-muted text-foreground",
  IN_PREPARATION: "bg-warning text-warning",
  READY_FOR_DISPATCH: "bg-info text-info",
  DISPATCHED: "bg-info text-info",
  IN_TRANSIT: "bg-info text-info",
  DELIVERED_TO_AGENT: "bg-success text-success",
  DELIVERED_ONBOARD: "bg-success text-success",
  DELAYED: "bg-destructive text-destructive",
};
