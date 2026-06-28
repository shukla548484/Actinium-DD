"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TableCard } from "@/components/layout/TableCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatRegisterCell, REGISTER_CONFIG, type RegisterFieldDef } from "@/lib/shipyard/registerConfig";
import type { YardJobOption, YardProjectOption, YardRegisterType } from "@/lib/shipyard/registerTypes";
import { mapSelectItems } from "@/lib/ui/labeledSelect";

function defaultFormValues(fields: RegisterFieldDef[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.type === "checkbox") values[f.name] = false;
    else if (f.type === "date") values[f.name] = new Date().toISOString().slice(0, 10);
    else if (f.type === "select" && f.options?.[0]) values[f.name] = f.options[0].value;
    else values[f.name] = "";
  }
  return values;
}

function entryToForm(entry: Record<string, unknown>, fields: RegisterFieldDef[]): Record<string, unknown> {
  const values = defaultFormValues(fields);
  for (const f of fields) {
    if (f.type === "job") {
      values.workshopJobId = entry.workshopJobId ?? "";
    } else if (f.type === "date" && entry[f.name]) {
      values[f.name] = new Date(String(entry[f.name])).toISOString().slice(0, 10);
    } else if (f.name in entry) {
      values[f.name] = entry[f.name];
    }
  }
  return values;
}

export function YardRegisterPanel({
  registerType,
  projectId,
  projects,
  jobs,
}: {
  registerType: YardRegisterType;
  projectId: string | null;
  projects: YardProjectOption[];
  jobs: YardJobOption[];
}) {
  const router = useRouter();
  const config = REGISTER_CONFIG[registerType];
  const [entries, setEntries] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(() => defaultFormValues(config.fields));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/shipyard/projects/${projectId}/registers/${registerType}`);
      const data = (await res.json()) as { entries?: Record<string, unknown>[] };
      setEntries(data.entries ?? []);
    } finally {
      setLoading(false);
    }
  }, [projectId, registerType]);

  useEffect(() => {
    void load();
  }, [load]);

  const projectItems = useMemo(
    () => mapSelectItems(projects, (p) => p.projectId, (p) => p.projectName),
    [projects],
  );

  const jobItems = useMemo((): { value: string; label: string }[] => {
    return [
      { value: "__none__", label: "No job linked" },
      ...mapSelectItems(jobs, (j) => j.id, (j) => j.jobTitle),
    ];
  }, [jobs]);

  function openCreate() {
    setEditId(null);
    setForm(defaultFormValues(config.fields));
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(entry: Record<string, unknown>) {
    setEditId(String(entry.id));
    setForm(entryToForm(entry, config.fields));
    setError(null);
    setDialogOpen(true);
  }

  async function save() {
    if (!projectId) return;
    setSaving(true);
    setError(null);
    const payload = { ...form };
    if (payload.workshopJobId === "") payload.workshopJobId = null;
    if (typeof payload.progressPct === "string" && payload.progressPct !== "") {
      payload.progressPct = Number(payload.progressPct);
    }
    if (typeof payload.manpowerCount === "string" && payload.manpowerCount !== "") {
      payload.manpowerCount = Number(payload.manpowerCount);
    }
    if (typeof payload.impactDays === "string" && payload.impactDays !== "") {
      payload.impactDays = Number(payload.impactDays);
    }
    if (typeof payload.commercialImpact === "string" && payload.commercialImpact !== "") {
      payload.commercialImpact = Number(payload.commercialImpact);
    }

    const url = editId
      ? `/api/shipyard/projects/${projectId}/registers/${registerType}/${editId}`
      : `/api/shipyard/projects/${projectId}/registers/${registerType}`;
    const res = await fetch(url, {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Save failed");
      return;
    }
    setDialogOpen(false);
    void load();
    router.refresh();
  }

  async function remove(id: string) {
    if (!projectId || !confirm("Delete this entry?")) return;
    await fetch(`/api/shipyard/projects/${projectId}/registers/${registerType}/${id}`, {
      method: "DELETE",
    });
    void load();
    router.refresh();
  }

  function setField(name: string, value: unknown) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function renderField(field: RegisterFieldDef) {
    const id = `reg-${field.name}`;
    if (field.type === "job") {
      return (
        <div key={field.name} className="space-y-1.5">
          <Label htmlFor={id}>{field.label}</Label>
          <Select
            items={jobItems}
            value={String(form.workshopJobId ?? "__none__")}
            onValueChange={(v) => setField("workshopJobId", v === "__none__" ? null : v)}
          >
            <SelectTrigger id={id} className="w-full">
              <SelectValue placeholder="Select job (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No job linked</SelectItem>
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.jobTitle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    if (field.type === "date") {
      return (
        <DatePickerField
          key={field.name}
          id={`reg-${field.name}`}
          name={field.name}
          label={field.label}
          value={String(form[field.name] ?? "")}
          onValueChange={(v) => setField(field.name, v)}
          required={field.required}
        />
      );
    }
    if (field.type === "textarea") {
      return (
        <div key={field.name} className="space-y-1.5">
          <Label htmlFor={id}>{field.label}</Label>
          <Textarea
            id={id}
            value={String(form[field.name] ?? "")}
            onChange={(e) => setField(field.name, e.target.value)}
            placeholder={field.placeholder}
          />
        </div>
      );
    }
    if (field.type === "select" && field.options) {
      return (
        <div key={field.name} className="space-y-1.5">
          <Label htmlFor={id}>{field.label}</Label>
          <Select
            items={field.options}
            value={String(form[field.name] ?? field.options[0]?.value ?? "")}
            onValueChange={(v) => v && setField(field.name, v)}
          >
            <SelectTrigger id={id} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    if (field.type === "checkbox") {
      return (
        <label key={field.name} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(form[field.name])}
            onChange={(e) => setField(field.name, e.target.checked)}
          />
          {field.label}
        </label>
      );
    }
    return (
      <div key={field.name} className="space-y-1.5">
        <Label htmlFor={id}>{field.label}</Label>
        <Input
          id={id}
          type={field.type === "number" ? "number" : "text"}
          value={String(form[field.name] ?? "")}
          onChange={(e) =>
            setField(
              field.name,
              field.type === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value,
            )
          }
          placeholder={field.placeholder}
          required={field.required}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={projectItems}
          value={projectId ?? ""}
          onValueChange={(v) => {
            if (v) router.push(`?project=${v}`);
          }}
        >
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.projectId} value={p.projectId}>
                {p.projectName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={openCreate} disabled={!projectId}>
          Add entry
        </Button>
      </div>

      {!projectId ? (
        <p className="text-sm text-muted-foreground">Select a project to manage this register.</p>
      ) : (
        <TableCard title={config.title}>
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {config.columns.map((c) => (
                    <TableHead key={c.key}>{c.header}</TableHead>
                  ))}
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={config.columns.length + 1} className="text-center text-muted-foreground">
                      No entries yet
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => (
                    <TableRow key={String(entry.id)}>
                      {config.columns.map((c) => (
                        <TableCell key={c.key}>{formatRegisterCell(c.key, entry)}</TableCell>
                      ))}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(entry)}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => void remove(String(entry.id))}>
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </TableCard>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit entry" : "New entry"}</DialogTitle>
            <DialogDescription>{config.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">{config.fields.map(renderField)}</div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex gap-2">
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
