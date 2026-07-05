import type { LucideIcon } from "lucide-react";
import { FileText, LayoutDashboard, Mail } from "lucide-react";

export const externalNavChildren = [
  { href: "/external", label: "Overview", icon: LayoutDashboard },
  { href: "/external/quotes", label: "My quotes", icon: FileText },
  { href: "/external/rfqs", label: "RFQ invitations", icon: Mail },
] as const satisfies ReadonlyArray<{ href: string; label: string; icon: LucideIcon }>;
