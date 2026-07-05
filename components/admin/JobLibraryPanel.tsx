"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { JOB_PRIORITY_ITEMS } from "@/lib/superintendent/constants";
import type { JobLibraryNodeDto } from "@/lib/vessel/jobLibrary/catalog";

type AdminNode = JobLibraryNodeDto & { isActive?: boolean; sortOrder?: number };

const NODE_TYPE_LABELS: Record<string, string> = {
  department: "Department",
  category: "Category",
  system: "System",
  machinery: "Machinery",
  component: "Component",
  standard_job: "Standard job",
};

export function JobLibraryPanel() {
  const [path, setPath] = useState<AdminNode[]>([]);
  const [nodes, setNodes] = useState<AdminNode[]>([]);
  const [selected, setSelected] = useState<AdminNode | null>(null);
  const [childTypes, setChildTypes] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addNodeType, setAddNodeType] = useState("");
  const [saving, setSaving] = useState(false);

  const parent = path[path.length - 1] ?? null;

  const loadLevel = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ includeInactive: "true" });
    if (search.trim()) {
      params.set("search", search.trim());
    } else if (parent) {
      params.set("parentId", parent.id);
      params.set("parentType", parent.nodeType);
    } else {
      params.set("parentId", "root");
    }

    const res = await fetch(`/api/admin/job-library?${params}`);
    const data = (await res.json()) as {
      nodes?: AdminNode[];
      childTypes?: string[];
      error?: string;
    };
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to load job library.");
      return;
    }
    setNodes(data.nodes ?? []);
    setChildTypes(data.childTypes ?? (parent ? [] : ["department"]));
  }, [parent, search]);

  useEffect(() => {
    if (childTypes.length > 0) setAddNodeType(childTypes[0]!);
  }, [childTypes]);

  useEffect(() => {
    void loadLevel();
  }, [loadLevel]);

  function drillInto(node: AdminNode) {
    if (node.nodeType === "standard_job") {
      setSelected(node);
      return;
    }
    setPath((prev) => [...prev, node]);
    setSelected(null);
    setSearch("");
  }

  function goToIndex(index: number) {
    setPath((prev) => (index < 0 ? [] : prev.slice(0, index + 1)));
    setSelected(null);
    setSearch("");
  }

  async function saveSelected(form: HTMLFormElement) {
    if (!selected) return;
    setSaving(true);
    setError(null);
    const fd = new FormData(form);
    const res = await fetch(`/api/admin/job-library/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: String(fd.get("code") ?? ""),
        name: String(fd.get("name") ?? ""),
        description: String(fd.get("description") ?? "") || null,
        department: String(fd.get("department") ?? "") || null,
        workshop: String(fd.get("workshop") ?? "") || null,
        referenceCode: String(fd.get("referenceCode") ?? "") || null,
        defaultPriority: String(fd.get("defaultPriority") ?? "") || null,
        estimatedManhours: fd.get("estimatedManhours")
          ? Number(fd.get("estimatedManhours"))
          : null,
        sortOrder: Number(fd.get("sortOrder") ?? 0),
        isActive: fd.get("isActive") === "on",
      }),
    });
    setSaving(false);
    const data = (await res.json()) as { node?: AdminNode; error?: string };
    if (!res.ok) {
      setError(data.error ?? "Save failed.");
      return;
    }
    setSelected(data.node ?? null);
    setMessage("Node updated.");
    void loadLevel();
  }

  async function addChild(form: HTMLFormElement) {
    setSaving(true);
    setError(null);
    const fd = new FormData(form);
    const res = await fetch("/api/admin/job-library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentId: parent?.id ?? null,
        nodeType: addNodeType || childTypes[0] || "department",
        code: String(fd.get("code") ?? ""),
        name: String(fd.get("name") ?? ""),
        description: String(fd.get("description") ?? "") || null,
        department: String(fd.get("department") ?? "") || null,
        workshop: String(fd.get("workshop") ?? "") || null,
        referenceCode: String(fd.get("referenceCode") ?? "") || null,
        defaultPriority: String(fd.get("defaultPriority") ?? "") || null,
        estimatedManhours: fd.get("estimatedManhours")
          ? Number(fd.get("estimatedManhours"))
          : null,
        sortOrder: Number(fd.get("sortOrder") ?? nodes.length),
      }),
    });
    setSaving(false);
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Create failed.");
      return;
    }
    setShowAdd(false);
    setMessage("Node created.");
    void loadLevel();
  }

  async function deleteSelected() {
    if (!selected || !confirm("Delete this node? Only leaf nodes can be removed.")) return;
    const res = await fetch(`/api/admin/job-library/${selected.id}`, { method: "DELETE" });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Delete failed.");
      return;
    }
    setSelected(null);
    setMessage("Node deleted.");
    void loadLevel();
  }

  async function reseedCatalog() {
    if (!confirm("Replace entire job library with seed catalog? This deletes all custom nodes.")) {
      return;
    }
    const res = await fetch("/api/admin/job-library/reseed", { method: "POST" });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Reseed failed.");
      return;
    }
    setPath([]);
    setSelected(null);
    setMessage("Job library re-seeded from catalog.");
    void loadLevel();
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Browse hierarchy</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void reseedCatalog()}>
              Re-seed from catalog
            </Button>
            {childTypes.length > 0 ? (
              <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
                {showAdd ? "Cancel add" : "Add child"}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button variant="ghost" size="sm" onClick={() => goToIndex(-1)}>
              Root
            </Button>
            {path.map((node, i) => (
              <span key={node.id} className="flex items-center gap-2">
                <span className="text-muted-foreground">/</span>
                <Button variant="ghost" size="sm" onClick={() => goToIndex(i)}>
                  {node.name}
                </Button>
              </span>
            ))}
          </div>

          <Input
            placeholder="Search by name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {showAdd ? (
            <form
              className="grid gap-3 rounded-md border p-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                void addChild(e.currentTarget);
              }}
            >
              <div className="space-y-1 sm:col-span-2">
                <Label>Node type</Label>
                <select
                  value={addNodeType || childTypes[0] || "department"}
                  onChange={(e) => setAddNodeType(e.target.value)}
                  className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {childTypes.map((t) => (
                    <option key={t} value={t}>
                      {NODE_TYPE_LABELS[t] ?? t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Code</Label>
                <Input name="code" required />
              </div>
              <div className="space-y-1">
                <Label>Name</Label>
                <Input name="name" required />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Description</Label>
                <Textarea name="description" rows={2} />
              </div>
              <div className="space-y-1">
                <Label>Department</Label>
                <Input name="department" />
              </div>
              <div className="space-y-1">
                <Label>Workshop</Label>
                <Input name="workshop" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? "Saving…" : "Create node"}
                </Button>
              </div>
            </form>
          ) : null}

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nodes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No nodes at this level.
                    </TableCell>
                  </TableRow>
                ) : (
                  nodes.map((node) => (
                    <TableRow key={node.id}>
                      <TableCell className="font-medium">{node.name}</TableCell>
                      <TableCell className="capitalize">
                        {NODE_TYPE_LABELS[node.nodeType] ?? node.nodeType}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{node.code}</TableCell>
                      <TableCell>
                        {node.isActive === false ? (
                          <Badge variant="outline">Inactive</Badge>
                        ) : (
                          <Badge variant="secondary">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (node.nodeType === "standard_job") setSelected(node);
                            else drillInto(node);
                          }}
                        >
                          {node.nodeType === "standard_job" ? "Edit" : "Open"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Edit node</CardTitle>
            <Button variant="destructive" size="sm" onClick={() => void deleteSelected()}>
              Delete
            </Button>
          </CardHeader>
          <CardContent>
            <form
              key={selected.id}
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                void saveSelected(e.currentTarget);
              }}
            >
              <div className="space-y-1">
                <Label>Code</Label>
                <Input name="code" defaultValue={selected.code} required />
              </div>
              <div className="space-y-1">
                <Label>Name</Label>
                <Input name="name" defaultValue={selected.name} required />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Description</Label>
                <Textarea name="description" rows={2} defaultValue={selected.description ?? ""} />
              </div>
              <div className="space-y-1">
                <Label>Department</Label>
                <Input name="department" defaultValue={selected.department ?? ""} />
              </div>
              <div className="space-y-1">
                <Label>Workshop</Label>
                <Input name="workshop" defaultValue={selected.workshop ?? ""} />
              </div>
              <div className="space-y-1">
                <Label>Reference code</Label>
                <Input name="referenceCode" defaultValue={selected.referenceCode ?? ""} />
              </div>
              <div className="space-y-1">
                <Label>Sort order</Label>
                <Input
                  name="sortOrder"
                  type="number"
                  defaultValue={selected.sortOrder ?? 0}
                />
              </div>
              {selected.nodeType === "standard_job" ? (
                <>
                  <div className="space-y-1">
                    <Label>Default priority</Label>
                    <select
                      name="defaultPriority"
                      defaultValue={selected.defaultPriority ?? "medium"}
                      className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      {JOB_PRIORITY_ITEMS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Est. manhours</Label>
                    <Input
                      name="estimatedManhours"
                      type="number"
                      defaultValue={selected.estimatedManhours ?? ""}
                    />
                  </div>
                </>
              ) : null}
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" name="isActive" defaultChecked={selected.isActive !== false} />
                Active (visible to ship / superintendent)
              </label>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
