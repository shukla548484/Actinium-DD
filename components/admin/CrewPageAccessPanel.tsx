"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { CrewPageAccessDto } from "@/lib/db/crewPageAccess";
import { cn } from "@/lib/utils";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

type Props = {
  vesselId: string;
  employeeId: string;
  backHref: string;
};

export function CrewPageAccessPanel({ vesselId, employeeId, backHref }: Props) {
  const [detail, setDetail] = useState<CrewPageAccessDto | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(
      `/api/admin/vessels/${vesselId}/crew-credentials/${employeeId}/pages`,
    );
    const data = (await res.json()) as CrewPageAccessDto & { error?: string };
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to load page assignments");
      return;
    }
    setDetail(data);
    setSelected(new Set(data.assignedPageKeys));
  }, [employeeId, vesselId]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const pages = detail?.availablePages ?? [];
    const grouped = new Map<string, typeof pages>();
    for (const page of pages) {
      const list = grouped.get(page.group) ?? [];
      list.push(page);
      grouped.set(page.group, list);
    }
    return [...grouped.entries()];
  }, [detail?.availablePages]);

  function togglePage(key: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
    setMessage(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await fetch(
      `/api/admin/vessels/${vesselId}/crew-credentials/${employeeId}/pages`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageKeys: [...selected] }),
      },
    );
    const data = (await res.json()) as { error?: string; detail?: CrewPageAccessDto };
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to save page assignments");
      return;
    }
    if (data.detail) {
      setDetail(data.detail);
      setSelected(new Set(data.detail.assignedPageKeys));
    }
    setMessage("Page access saved. The crew member will see only these onboard pages on next load.");
  }

  if (loading) {
    return <ActiniumLoadingState label="Loading page assignments…" size="sm" />;
  }

  if (error && !detail) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!detail) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{detail.employeeName}</CardTitle>
          <CardDescription>
            {detail.designation ?? "Crew"} · Vessel login{" "}
            <span className="font-mono">{detail.vesselLoginId ?? "—"}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Select which onboard pages this crew member can open. Unassigned pages are hidden from
          navigation and blocked by the API.
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {groups.map(([group, pages]) => (
          <Card key={group}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{group}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pages.map((page) => {
                const checked = selected.has(page.key);
                return (
                  <label
                    key={page.key}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                      checked ? "border-primary/40 bg-primary/5" : "hover:bg-muted/40",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => togglePage(page.key, value === true)}
                    />
                    <div className="space-y-1">
                      <Label className="cursor-pointer font-medium">{page.label}</Label>
                      <p className="text-xs text-muted-foreground">{page.description}</p>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {page.route}
                      </Badge>
                    </div>
                  </label>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

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

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void handleSave()} disabled={saving}>
          {saving ? "Saving…" : "Save page access"}
        </Button>
        <Button variant="outline" render={<Link href={backHref} />} nativeButton={false}>
          Back to crew credentials
        </Button>
      </div>
    </div>
  );
}
