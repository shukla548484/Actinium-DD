"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CreateProjectForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const body = {
      name: String(fd.get("name") ?? ""),
      vesselName: String(fd.get("vesselName") ?? "") || undefined,
      vesselId: String(fd.get("vesselId") ?? "") || undefined,
      referenceCode: String(fd.get("referenceCode") ?? "") || undefined,
      currency: String(fd.get("currency") ?? "USD"),
      shipyardDays: fd.get("shipyardDays")
        ? Number(fd.get("shipyardDays"))
        : undefined,
      dryDockDays: fd.get("dryDockDays")
        ? Number(fd.get("dryDockDays"))
        : undefined,
      cprDays: fd.get("cprDays") ? Number(fd.get("cprDays")) : undefined,
      notes: String(fd.get("notes") ?? "") || undefined,
    };

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to create project.");
      return;
    }

    router.push(`/projects/${data.project.id}`);
  }

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>New tender project</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Project name *</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="MV Example — DD 2026"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vesselName">Vessel name</Label>
            <Input id="vesselName" name="vesselName" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vesselId">Fleet vessel ID (sync scope)</Label>
            <Input
              id="vesselId"
              name="vesselId"
              className="font-mono text-xs"
              placeholder="UUID — must match VESSEL_ID on relay/VPS"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="referenceCode">Reference code</Label>
            <Input id="referenceCode" name="referenceCode" />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" defaultValue="USD" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipyardDays">Shipyard days</Label>
              <Input
                id="shipyardDays"
                name="shipyardDays"
                type="number"
                min={0}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dryDockDays">Dry-dock days</Label>
              <Input
                id="dryDockDays"
                name="dryDockDays"
                type="number"
                min={0}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cprDays">CPR days</Label>
              <Input id="cprDays" name="cprDays" type="number" min={0} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} />
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create project"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
