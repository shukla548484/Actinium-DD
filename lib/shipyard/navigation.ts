import type { ShipyardModuleSection } from "@/lib/navigation/shipyardNavItems";

export function isShipyardModulePath(pathname: string): boolean {
  return pathname.startsWith("/shipyard") && !pathname.startsWith("/shipyard/tender/quote");
}

export function resolveShipyardSection(pathname: string): ShipyardModuleSection {
  if (pathname.startsWith("/shipyard/projects")) return "projects";
  if (pathname.startsWith("/shipyard/workshops")) return "workshops";
  if (pathname.startsWith("/shipyard/planning")) return "planning";
  if (pathname.startsWith("/shipyard/execution")) return "execution";
  if (pathname.startsWith("/shipyard/collaboration")) return "collaboration";
  if (pathname.startsWith("/shipyard/commercial")) return "commercial";
  if (pathname.startsWith("/shipyard/tender")) return "commercial";
  if (pathname.startsWith("/shipyard/reports")) return "reports";
  if (pathname === "/shipyard/yards") return "commercial";
  return "dashboard";
}
