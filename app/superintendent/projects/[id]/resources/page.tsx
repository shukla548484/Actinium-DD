"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { fmtDate } from "@/lib/superintendent/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ResourceRow = {
  id: string;
  title: string;
  resourceType: string;
  quantity: number;
  unit: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
};

const RESOURCE_TYPES = ["crane", "scaffolding", "worker_team", "equipment", "other"] as const;

export default function ProjectResourcesPage() {
  const { id } = useParams<{ id: string }>();
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [resourceType, setResourceType] = useState<string>("crane");
  const [quantity, setQuantity] = useState("1");

  const load = useCallback(() => {
    void fetch(`/api/superintendent/resources?dryDockProjectId=${encodeURIComponent(id)}&limit=50`)
      .then((r) => r.json())
      .then((d: { items?: ResourceRow[] }) => setResources(d.items ?? []))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function addResource(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/superintendent/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dryDockProjectId: id,
        title,
        resourceType,
        quantity: Number(quantity) || 1,
        status: "planned",
      }),
    });
    setBusy(false);
    if (res.ok) {
      setTitle("");
      setQuantity("1");
      load();
    }
  }

  async function updateStatus(resourceId: string, status: string) {
    await fetch(`/api/superintendent/resources/${resourceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  return (
    <PageShell size="wide">
      <PageHeader
        title="Resources"
        description="Cranes, scaffolding, worker teams, and equipment for this dry dock."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resource allocations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-3 md:grid-cols-4" onSubmit={(e) => void addResource(e)}>
            <div className="space-y-1 md:col-span-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={resourceType} onValueChange={(v) => setResourceType(v ?? "other")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Quantity</Label>
              <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <Button type="submit" size="sm" disabled={busy} className="md:col-span-4 w-fit">
              Add resource
            </Button>
          </form>

          {loading ? (
            <ActiniumLoadingState label="Loading resources…" size="sm" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No resources allocated yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  resources.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.title}</TableCell>
                      <TableCell className="capitalize">{r.resourceType.replace(/_/g, " ")}</TableCell>
                      <TableCell>
                        {r.quantity}
                        {r.unit ? ` ${r.unit}` : ""}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.status}
                          onValueChange={(v) => v && void updateStatus(r.id, v)}
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["planned", "mobilized", "active", "demobilized"].map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{fmtDate(r.startDate)}</TableCell>
                      <TableCell>{fmtDate(r.endDate)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
