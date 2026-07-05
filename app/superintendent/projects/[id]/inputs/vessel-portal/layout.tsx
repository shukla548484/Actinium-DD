"use client";

import { useParams } from "next/navigation";
import { VesselWorkspaceNav } from "@/components/superintendent/VesselWorkspaceNav";

export default function VesselPortalLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <VesselWorkspaceNav dryDockProjectId={id} portal />
      {children}
    </div>
  );
}
