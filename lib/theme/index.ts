import type { CompareTabId } from "@/lib/desktop/snapshot";
import type { ProjectStatus } from "@/lib/tender/types";

/** Module → accent color (compare tabs & cards). */
export const moduleTheme: Record<
  CompareTabId,
  {
    label: string;
    accent: "rose" | "orange" | "yellow" | "black";
    cardClass: string;
    tabActiveClass: string;
    btnClass: string;
  }
> = {
  "hull-paint": {
    label: "Hull paint",
    accent: "rose",
    cardClass: "border-rose-200 bg-rose-50/60 dark:bg-rose-950/20",
    tabActiveClass: "bg-rose-600 text-white",
    btnClass: "bg-rose-600 text-white hover:bg-rose-700",
  },
  "dry-dock": {
    label: "Dry dock",
    accent: "orange",
    cardClass: "border-orange-200 bg-orange-50/60 dark:bg-orange-950/20",
    tabActiveClass: "bg-orange-600 text-white",
    btnClass: "bg-orange-600 text-white hover:bg-orange-700",
  },
  "yard-services": {
    label: "Yard services",
    accent: "yellow",
    cardClass: "border-yellow-200 bg-yellow-50/60 dark:bg-yellow-950/20",
    tabActiveClass: "bg-yellow-600 text-white",
    btnClass: "bg-yellow-600 text-white hover:bg-yellow-700",
  },
  general: {
    label: "All services",
    accent: "black",
    cardClass: "border-foreground/10 bg-muted/40",
    tabActiveClass: "bg-foreground text-background",
    btnClass: "bg-foreground text-background hover:bg-foreground/90",
  },
};

export const statusTheme: Record<
  ProjectStatus,
  { bg: string; text: string; statCard: string }
> = {
  draft: {
    bg: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
    statCard: "border-border bg-muted/30",
  },
  tendering: {
    bg: "bg-orange-100 text-orange-800 border border-orange-200",
    text: "text-orange-800",
    statCard: "border-orange-200 bg-orange-50/60 dark:bg-orange-950/20",
  },
  comparing: {
    bg: "bg-rose-100 text-rose-800 border border-rose-200",
    text: "text-rose-800",
    statCard: "border-rose-200 bg-rose-50/60 dark:bg-rose-950/20",
  },
  closed: {
    bg: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
    statCard: "border-foreground/10 bg-muted/40",
  },
};

export const brand = {
  name: "Actinium-DD",
  portalName: "Actinium-DD",
  logoClass: "bg-primary text-primary-foreground",
  sidebarClass: "dd-sidebar",
} as const;
