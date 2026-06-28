import { useCallback, useEffect, useMemo, useState } from "react";
import { HybridComparisonMatrix } from "@/components/portal/HybridComparisonMatrix";
import { TopNavBar } from "@/components/layout/TopNavBar";
import { PageShell } from "@/components/layout/PageShell";
import { SyncStatusPanel } from "@/components/SyncStatusPanel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TopNavId } from "@/lib/navigation/topNavItems";
import type { Project } from "@/lib/tender/types";
import type { SyncStatus } from "@/lib/sync/status";
import { statusTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  checkFleetApiHealth,
  createFleetProject,
  deleteFleetProject,
  fleetApiBaseUrl,
  getSyncStatus,
  listFleetProjects,
} from "./api/fleetClient";
import "./styles.css";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiConnected, setApiConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [activeNav, setActiveNav] = useState<TopNavId>("jobs");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("Dry dock comparison");
  const [newVesselName, setNewVesselName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const activeProject = projects.find((p) => p.id === activeId) ?? null;

  const pendingTasksCount = useMemo(
    () => projects.filter((p) => p.status === "tendering" || p.status === "comparing").length,
    [projects],
  );

  const refreshProjects = useCallback(async () => {
    const list = await listFleetProjects();
    setProjects(list);
    return list;
  }, []);

  const refreshSync = useCallback(async () => {
    try {
      const ok = await checkFleetApiHealth();
      setApiConnected(ok);
      if (ok) setSyncStatus(await getSyncStatus());
    } catch {
      setApiConnected(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refreshSync();
        const list = await refreshProjects();
        if (list.length > 0) {
          setActiveId(list[0].id);
        }
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Failed to connect to local PostgreSQL API (npm run fleet:api)",
        );
      } finally {
        setLoading(false);
      }
    })();
    const interval = setInterval(() => void refreshSync(), 30_000);
    return () => clearInterval(interval);
  }, [refreshProjects, refreshSync]);

  function openNewProjectDialog() {
    setNewProjectName("Dry dock comparison");
    setNewVesselName("");
    setNewProjectOpen(true);
  }

  function handleNav(id: TopNavId) {
    setActiveNav(id);
    if (id === "jobs" && projects.length === 0) {
      openNewProjectDialog();
    }
  }

  async function submitNewProject() {
    const name = newProjectName.trim();
    if (!name) return;
    setCreatingProject(true);
    try {
      const project = await createFleetProject({
        name,
        vesselName: newVesselName.trim() || undefined,
      });
      await refreshProjects();
      setActiveId(project.id);
      setError(null);
      setActiveNav("jobs");
      setNewProjectOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setCreatingProject(false);
    }
  }

  async function confirmDeleteProject() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    try {
      await deleteFleetProject(id);
      const list = await refreshProjects();
      if (activeId === id) {
        setActiveId(list[0]?.id ?? null);
      }
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete project");
    }
  }

  function selectProject(project: Project) {
    setActiveId(project.id);
    setActiveNav("jobs");
  }

  if (loading) {
    return (
      <div className="dd-app-shell flex items-center justify-center text-sm text-muted-foreground">
        Connecting to local PostgreSQL…
      </div>
    );
  }

  const companyName =
    activeProject?.vesselName ?? syncStatus?.vesselId?.slice(0, 8) ?? "Actinium-DD";

  return (
    <div className="dd-app-shell">
      <TopNavBar
        mode="desktop"
        companyName={companyName}
        userName="Superintendent"
        userRole={`${syncStatus?.fleetOriginNode ?? "ship"} · Local fleet`}
        pendingTasksCount={pendingTasksCount}
        syncOnline={apiConnected}
        syncLabel={syncStatus?.message}
        activeNav={activeNav}
        onNavigate={handleNav}
      />

      <div className="dd-app-body">
        <aside className="dd-sidebar flex w-[var(--dd-sidebar-width)] shrink-0 flex-col border-r">
          <div className="border-b border-zinc-800 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Job creations
            </p>
            <Button
              type="button"
              onClick={openNewProjectDialog}
              className="mt-3 w-full"
            >
              + New project
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3">
              {projects.length === 0 ? (
                <p className="px-1 py-4 text-xs leading-relaxed text-zinc-400">
                  No projects yet. Use Job Creations above or the top nav to start a tender.
                </p>
              ) : (
                projects.map((project) => {
                  const isActive = project.id === activeId;
                  const statusStyle = statusTheme[project.status];
                  return (
                    <Card
                      key={project.id}
                      className={cn(
                        "mb-2 gap-0 py-0 ring-0",
                        isActive
                          ? "border-primary bg-zinc-900/80"
                          : "border-transparent bg-transparent hover:bg-zinc-900/50",
                      )}
                    >
                      <CardContent className="p-0">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => selectProject(project)}
                          className={cn(
                            "h-auto w-full justify-start rounded-lg px-3 py-2.5 text-left hover:bg-transparent",
                            isActive ? "text-white hover:text-white" : "text-zinc-200",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{project.name}</p>
                            {project.vesselName && (
                              <p className="truncate text-xs text-zinc-400">{project.vesselName}</p>
                            )}
                            <div className="mt-1.5 flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase",
                                  statusStyle.bg,
                                )}
                              >
                                {project.status}
                              </Badge>
                              <span className="text-[10px] text-zinc-500">
                                {formatDate(project.updatedAt)}
                              </span>
                            </div>
                          </div>
                        </Button>
                      </CardContent>
                      <CardFooter className="justify-end border-0 bg-transparent px-3 pb-2 pt-0">
                        <Button
                          type="button"
                          variant="link"
                          size="xs"
                          onClick={() => setDeleteTarget(project)}
                          className="h-auto p-0 text-[10px] text-destructive"
                        >
                          Delete
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <SyncStatusPanel status={syncStatus} apiConnected={apiConnected} dark />
        </aside>

        <div className="dd-main">
          <div className="dd-sub-bar">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {activeProject?.name ?? "Select a job"}
              </p>
              {activeProject?.vesselName && (
                <p className="text-xs text-muted-foreground">{activeProject.vesselName}</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {activeProject ? "Online yard quotes · synced when connected" : ""}
            </p>
          </div>

          <div className="dd-main-scroll">
            {error && (
              <PageShell className="pt-4">
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </PageShell>
            )}

            {activeProject ? (
              <PageShell size="wide">
                <Alert>
                  <AlertDescription>
                    Shipyards submit quotations through their secure portal links. Comparison
                    updates automatically when yards save or submit online — no Excel uploads
                    required.
                  </AlertDescription>
                </Alert>
                <HybridComparisonMatrix
                  key={activeProject.id}
                  projectId={activeProject.id}
                  comparisonUrl={`${fleetApiBaseUrl}/projects/${activeProject.id}/comparison`}
                />
              </PageShell>
            ) : (
              <PageShell className="flex flex-col items-center justify-center py-24 text-center">
                <h2 className="text-xl font-semibold text-foreground">Start a tender</h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Create a job from the sidebar, invite shipyards from the office portal, and
                  compare quotes as they are submitted online.
                </p>
                <Button type="button" onClick={openNewProjectDialog} className="mt-8">
                  Create first project
                </Button>
              </PageShell>
            )}
          </div>
        </div>
      </div>

      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Create a local tender job stored in PostgreSQL.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project name</Label>
              <Input
                id="project-name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Dry dock comparison"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vessel-name">Vessel name (optional)</Label>
              <Input
                id="vessel-name"
                value={newVesselName}
                onChange={(e) => setNewVesselName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setNewProjectOpen(false)}
              disabled={creatingProject}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void submitNewProject()}
              disabled={creatingProject || !newProjectName.trim()}
            >
              {creatingProject ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;{deleteTarget?.name}&rdquo;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void confirmDeleteProject()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
