/** Shipyard execution portal — separate from superintendent (/projects) module. */

export type ShipyardModuleSection =
  | "dashboard"
  | "projects"
  | "workshops"
  | "planning"
  | "execution"
  | "collaboration"
  | "commercial"
  | "reports";

export interface ShipyardNavLink {
  href: string;
  label: string;
  description?: string;
}

export interface ShipyardNavSection {
  id: ShipyardModuleSection;
  label: string;
  href: string;
  items: ShipyardNavLink[];
}

/** Top-level shipyard dropdown (main app nav). */
export const shipyardNavChildren = [
  { href: "/shipyard", label: "Dashboard" },
  { href: "/shipyard/projects", label: "Active projects" },
  { href: "/shipyard/workshops", label: "Workshops" },
  { href: "/shipyard/planning", label: "Planning" },
  { href: "/shipyard/execution/jobs", label: "Job board" },
  { href: "/shipyard/tender", label: "Tender & quotes" },
  { href: "/shipyard/reports", label: "Reports" },
] as const;

/** Secondary sidebar inside /shipyard/* — workshop execution structure. */
export const shipyardModuleSections: ShipyardNavSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/shipyard",
    items: [],
  },
  {
    id: "projects",
    label: "Projects",
    href: "/shipyard/projects",
    items: [
      { href: "/shipyard/projects", label: "Active projects" },
      { href: "/shipyard/projects/milestones", label: "Milestones" },
    ],
  },
  {
    id: "workshops",
    label: "Workshops",
    href: "/shipyard/workshops",
    items: [
      { href: "/shipyard/workshops", label: "Workshop overview" },
      { href: "/shipyard/workshops/docking-team", label: "Docking team" },
      { href: "/shipyard/workshops/hull", label: "Hull" },
      { href: "/shipyard/workshops/steel", label: "Steel" },
      { href: "/shipyard/workshops/painting", label: "Painting" },
      { href: "/shipyard/workshops/machinery", label: "Machinery" },
      { href: "/shipyard/workshops/valve", label: "Valve" },
      { href: "/shipyard/workshops/electrical", label: "Electrical" },
      { href: "/shipyard/workshops/safety-qa", label: "Safety / QA-QC" },
    ],
  },
  {
    id: "planning",
    label: "Planning",
    href: "/shipyard/planning",
    items: [
      { href: "/shipyard/planning", label: "Master schedule" },
      { href: "/shipyard/planning/dependencies", label: "Dependencies" },
      { href: "/shipyard/planning/resources", label: "Resources" },
    ],
  },
  {
    id: "execution",
    label: "Execution",
    href: "/shipyard/execution/jobs",
    items: [
      { href: "/shipyard/execution/jobs", label: "Job board" },
      { href: "/shipyard/execution/progress", label: "Daily progress" },
      { href: "/shipyard/execution/delays", label: "Delay register" },
      { href: "/shipyard/execution/permits", label: "Permit register" },
      { href: "/shipyard/execution/inspections", label: "Inspection register" },
    ],
  },
  {
    id: "collaboration",
    label: "Collaboration",
    href: "/shipyard/collaboration/clarifications",
    items: [
      { href: "/shipyard/collaboration/clarifications", label: "Clarifications" },
      { href: "/shipyard/collaboration/attachments", label: "Attachments" },
    ],
  },
  {
    id: "commercial",
    label: "Commercial",
    href: "/shipyard/commercial/variations",
    items: [
      { href: "/shipyard/tender", label: "Tender & RFQ" },
      { href: "/shipyard/tender/invites", label: "Yard invites" },
      { href: "/shipyard/yards", label: "Shipyard directory" },
      { href: "/shipyard/commercial/variations", label: "Variation orders" },
      { href: "/shipyard/commercial/work-done", label: "Work done" },
      { href: "/shipyard/commercial/completion", label: "Final completion" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    href: "/shipyard/reports",
    items: [{ href: "/shipyard/reports", label: "Project reports" }],
  },
];

export function shipyardSectionForPath(pathname: string): ShipyardNavSection {
  for (const section of shipyardModuleSections) {
    if (section.id === "dashboard" && pathname === "/shipyard") return section;
    if (section.id !== "dashboard" && pathname.startsWith(section.href.split("/").slice(0, 3).join("/"))) {
      return section;
    }
  }
  if (pathname.startsWith("/shipyard/tender") || pathname.startsWith("/shipyard/yards")) {
    return shipyardModuleSections.find((s) => s.id === "commercial")!;
  }
  return shipyardModuleSections[0]!;
}
