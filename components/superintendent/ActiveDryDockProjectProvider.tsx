"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type ActiveDryDockProject = {
  id: string;
  name: string;
  referenceCode: string | null;
  vessel: { id: string; name: string; code: string };
};

type ActiveDryDockProjectContextValue = {
  activeProjectId: string | null;
  activeProject: ActiveDryDockProject | null;
  loading: boolean;
  setActiveProjectId: (id: string | null) => Promise<void>;
  refresh: () => Promise<void>;
};

const ActiveDryDockProjectContext = createContext<ActiveDryDockProjectContextValue | null>(null);

const PROJECT_PATH_RE = /^\/superintendent\/projects\/([^/]+)(.*)$/;

async function fetchScopeActiveProject(): Promise<{
  activeProjectId: string | null;
  activeProject: ActiveDryDockProject | null;
}> {
  const res = await fetch("/api/superintendent/scope");
  if (!res.ok) return { activeProjectId: null, activeProject: null };
  const data = (await res.json()) as {
    activeProjectId?: string | null;
    activeProject?: ActiveDryDockProject | null;
  };
  return {
    activeProjectId: data.activeProjectId ?? null,
    activeProject: data.activeProject ?? null,
  };
}

export function ActiveDryDockProjectProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<ActiveDryDockProject | null>(null);
  const [loading, setLoading] = useState(true);
  /** Skip one deep-link sync after an explicit switcher change. */
  const skipDeepLinkOnce = useRef(false);

  const refresh = useCallback(async () => {
    const next = await fetchScopeActiveProject();
    setActiveProjectIdState(next.activeProjectId);
    setActiveProject(next.activeProject);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const syncNavigation = useCallback(
    (id: string | null) => {
      const match = pathname.match(PROJECT_PATH_RE);
      if (match && match[1] !== "new") {
        const rest = match[2] ?? "";
        if (id) {
          if (match[1] !== id) {
            skipDeepLinkOnce.current = true;
            router.push(`/superintendent/projects/${id}${rest}`);
          }
        } else {
          skipDeepLinkOnce.current = true;
          router.push("/superintendent/projects");
        }
        return;
      }

      if (!pathname.startsWith("/superintendent")) return;

      const params = new URLSearchParams(searchParams.toString());
      const current = params.get("dryDockProjectId");
      if (id) {
        if (current === id) return;
        params.set("dryDockProjectId", id);
      } else if (!current) {
        return;
      } else {
        params.delete("dryDockProjectId");
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const setActiveProjectId = useCallback(
    async (id: string | null) => {
      const res = await fetch("/api/superintendent/scope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeProjectId: id, activeProjectOnly: true }),
      });
      if (!res.ok) return;
      await refresh();
      syncNavigation(id);
    },
    [refresh, syncNavigation],
  );

  // Deep link into a project workspace → make it the active project for the session.
  useEffect(() => {
    const match = pathname.match(PROJECT_PATH_RE);
    if (!match) return;
    const id = match[1];
    if (!id || id === "new") return;
    if (skipDeepLinkOnce.current) {
      skipDeepLinkOnce.current = false;
      return;
    }
    if (id === activeProjectId) return;

    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/superintendent/scope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeProjectId: id, activeProjectOnly: true }),
      });
      if (!res.ok || cancelled) return;
      await refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, activeProjectId, refresh]);

  const value = useMemo(
    () => ({
      activeProjectId,
      activeProject,
      loading,
      setActiveProjectId,
      refresh,
    }),
    [activeProjectId, activeProject, loading, setActiveProjectId, refresh],
  );

  return (
    <ActiveDryDockProjectContext.Provider value={value}>
      {children}
    </ActiveDryDockProjectContext.Provider>
  );
}

export function useActiveDryDockProject(): ActiveDryDockProjectContextValue {
  const ctx = useContext(ActiveDryDockProjectContext);
  if (!ctx) {
    return {
      activeProjectId: null,
      activeProject: null,
      loading: false,
      setActiveProjectId: async () => {},
      refresh: async () => {},
    };
  }
  return ctx;
}
