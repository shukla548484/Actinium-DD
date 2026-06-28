"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DryDockProjectSelect } from "@/components/superintendent/DryDockProjectSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function JobImportPanel() {
  const router = useRouter();
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!projectId) return;
    setLoading(true);
    setMessage(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("dryDockProjectId", projectId);
    const res = await fetch("/api/superintendent/jobs/import", {
      method: "POST",
      body: fd,
    });
    setLoading(false);
    if (res.ok) {
      const d = (await res.json()) as { imported: number };
      setMessage(`Imported ${d.imported} job(s).`);
      router.push("/superintendent/jobs");
    } else {
      const d = (await res.json()) as { error?: string };
      setMessage(d.error ?? "Import failed");
    }
  }

  return (
    <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
      <DryDockProjectSelect value={projectId} onChange={setProjectId} required />
      <div className="space-y-2">
        <Label htmlFor="file">Excel file (.xlsx)</Label>
        <Input id="file" name="file" type="file" accept=".xlsx,.xls" required />
        <p className="text-xs text-muted-foreground">
          Columns: title/description, category, job code, priority, budget (auto-detected).
        </p>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
      <Button type="submit" disabled={loading || !projectId}>
        {loading ? "Importing…" : "Import jobs"}
      </Button>
    </form>
  );
}
