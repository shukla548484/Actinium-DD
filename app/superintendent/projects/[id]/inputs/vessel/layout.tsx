"use client";

import { useParams } from "next/navigation";
import { VesselWorkspaceNav } from "@/components/superintendent/VesselWorkspaceNav";

export default function VesselInputsLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <VesselWorkspaceNav dryDockProjectId={id} />
      {children}
    </div>
  );
}
