"use client";

import { ProjectChecklistModulePage } from "@/components/superintendent/ProjectChecklistModulePage";

export const dynamic = "force-dynamic";

export default function ProjectInspectionsPage() {
  return <ProjectChecklistModulePage moduleKey="inspections" />;
}
