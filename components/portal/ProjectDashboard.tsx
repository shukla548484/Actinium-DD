"use client";

import { BackButton } from "@/components/layout/BackButton";
import { HybridComparisonMatrix } from "@/components/portal/HybridComparisonMatrix";
import { CategoryEditor } from "@/components/portal/CategoryEditor";
import { SpecEditor } from "@/components/portal/SpecEditor";
import { YardInvitePanel } from "@/components/portal/YardInvitePanel";
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
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ProjectDetail, ProjectStatus } from "@/lib/tender/types";

type Tab = "overview" | "categories" | "spec" | "yards" | "comparison";

interface Props {
  project: ProjectDetail;
}

export function ProjectDashboard({ project: initial }: Props) {
  const router = useRouter();
  const [project, setProject] = useState(initial);
  const [tab, setTab] = useState<Tab>("overview");
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/projects/${project.id}`);
    const data = await res.json();
    if (res.ok) {
      setProject(data.project);
      setRefreshKey((k) => k + 1);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteOpen(false);
    if (res.ok) {
      router.push("/projects");
    }
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "categories", label: "Categories", count: project.categories.length },
    { id: "spec", label: "Specification", count: project.specLines.length },
    { id: "yards", label: "Yard Invites", count: project.yardInvites.length },
    { id: "comparison", label: "Comparison" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-sm text-muted-foreground">
            {project.vesselName ?? "No vessel"} · {project.currency} ·{" "}
            <StatusBadge status={project.status} />
          </p>
        </div>
        <div className="flex gap-2">
          <BackButton fallbackHref="/projects" label="All projects" />
          <Button
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </header>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this project and all its data? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
              {t.count != null && (
                <Badge variant="secondary" className="ml-1.5">
                  {t.count}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {editing ? (
            <ProjectEditForm
              project={project}
              onSaved={(p) => {
                setProject((prev) => ({ ...prev, ...p }));
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <Card>
                <CardHeader className="border-b">
                  <CardTitle>Project Details</CardTitle>
                  <CardAction>
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                      Edit
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                    <Stat label="Spec lines" value={String(project.specLines.length)} />
                    <Stat label="Yards invited" value={String(project.yardInvites.length)} />
                    <Stat label="Shipyard days" value={String(project.shipyardDays ?? "—")} />
                    <Stat label="Dry-dock days" value={String(project.dryDockDays ?? "—")} />
                    <Stat label="CPR days" value={String(project.cprDays ?? "—")} />
                    <Stat label="Currency" value={project.currency} />
                  </div>
                  {project.vesselName && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Vessel:</span>{" "}
                      {project.vesselName}
                    </p>
                  )}
                  {project.referenceCode && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Ref code:</span>{" "}
                      {project.referenceCode}
                    </p>
                  )}
                  {project.notes && (
                    <p className="mt-2 text-sm text-muted-foreground">{project.notes}</p>
                  )}
                </CardContent>
              </Card>

              {project.yardInvites.length > 0 && (
                <Card>
                  <CardHeader className="border-b">
                    <CardTitle>Yard status</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {project.yardInvites.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between rounded-lg border px-3 py-2"
                        >
                          <span className="text-sm font-medium">{inv.yardName}</span>
                          <StatusBadge status={inv.status} />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="categories">
          <CategoryEditor
            projectId={project.id}
            initialCategories={project.categories}
            onUpdated={() => void refresh()}
          />
        </TabsContent>

        <TabsContent value="spec">
          <SpecEditor
            projectId={project.id}
            specLines={project.specLines}
            categories={project.categories}
            onUpdated={refresh}
          />
        </TabsContent>

        <TabsContent value="yards">
          <YardInvitePanel
            projectId={project.id}
            projectName={project.name}
            vesselName={project.vesselName}
            invites={project.yardInvites}
            onInviteCreated={refresh}
          />
        </TabsContent>

        <TabsContent value="comparison">
          <HybridComparisonMatrix key={refreshKey} projectId={project.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProjectEditForm({
  project,
  onSaved,
  onCancel,
}: {
  project: ProjectDetail;
  onSaved: (p: Partial<ProjectDetail>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: project.name,
    vesselName: project.vesselName ?? "",
    referenceCode: project.referenceCode ?? "",
    currency: project.currency,
    shipyardDays: project.shipyardDays?.toString() ?? "",
    dryDockDays: project.dryDockDays?.toString() ?? "",
    cprDays: project.cprDays?.toString() ?? "",
    status: project.status as ProjectStatus,
    notes: project.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        vesselName: form.vesselName || null,
        referenceCode: form.referenceCode || null,
        currency: form.currency,
        shipyardDays: form.shipyardDays ? Number(form.shipyardDays) : null,
        dryDockDays: form.dryDockDays ? Number(form.dryDockDays) : null,
        cprDays: form.cprDays ? Number(form.cprDays) : null,
        status: form.status,
        notes: form.notes || null,
      }),
    });

    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Save failed.");
      return;
    }
    const data = await res.json();
    onSaved(data.project);
  }

  const statuses: ProjectStatus[] = ["draft", "tendering", "comparing", "closed"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Project</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Project name *</Label>
              <Input
                id="edit-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-vessel">Vessel name</Label>
              <Input
                id="edit-vessel"
                value={form.vesselName}
                onChange={(e) => setForm({ ...form, vesselName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ref">Reference code</Label>
              <Input
                id="edit-ref"
                value={form.referenceCode}
                onChange={(e) => setForm({ ...form, referenceCode: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-currency">Currency</Label>
              <Input
                id="edit-currency"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm({ ...form, status: v as ProjectStatus })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-shipyard">Shipyard days</Label>
              <Input
                id="edit-shipyard"
                type="number"
                value={form.shipyardDays}
                onChange={(e) => setForm({ ...form, shipyardDays: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-drydock">Dry-dock days</Label>
              <Input
                id="edit-drydock"
                type="number"
                value={form.dryDockDays}
                onChange={(e) => setForm({ ...form, dryDockDays: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cpr">CPR days</Label>
              <Input
                id="edit-cpr"
                type="number"
                value={form.cprDays}
                onChange={(e) => setForm({ ...form, cprDays: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-zinc-100 text-zinc-700",
    tendering: "bg-blue-100 text-blue-800",
    comparing: "bg-purple-100 text-purple-800",
    closed: "bg-zinc-200 text-zinc-600",
    invited: "bg-zinc-100 text-zinc-600",
    in_progress: "bg-amber-100 text-amber-800",
    submitted: "bg-emerald-100 text-emerald-800",
    excel_imported: "bg-emerald-100 text-emerald-800",
    accepted: "bg-emerald-200 text-emerald-900",
    rejected: "bg-red-100 text-red-700",
  };
  return (
    <Badge variant="secondary" className={colors[status] ?? "bg-zinc-100 text-zinc-600"}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
