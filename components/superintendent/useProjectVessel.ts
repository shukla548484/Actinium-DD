"use client";

import { useEffect, useState } from "react";

export type ProjectVessel = {
  id: string;
  name: string;
  code: string;
  imoNumber: string | null;
};

export function useProjectVessel(dryDockProjectId: string) {
  const [vessel, setVessel] = useState<ProjectVessel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void fetch(`/api/superintendent/projects/${dryDockProjectId}`)
      .then((r) => r.json())
      .then((d) => {
        const p = d.project as { vessel?: ProjectVessel } | undefined;
        if (p?.vessel) {
          setVessel(p.vessel);
        } else {
          setVessel(null);
          setError("Project vessel not found");
        }
      })
      .catch(() => {
        setVessel(null);
        setError("Failed to load project");
      })
      .finally(() => setLoading(false));
  }, [dryDockProjectId]);

  return { vessel, vesselId: vessel?.id ?? null, loading, error };
}
