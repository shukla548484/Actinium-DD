"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { mapSelectItems, PAGE_ACCESS_TYPE_ITEMS } from "@/lib/ui/labeledSelect";
import { rbacUserTypeLabel } from "@/lib/rbac/userTypes";
import { suggestPageKeysFromJobScope } from "@/lib/rbac/jobScopePages";
import { approvalLevelLabel } from "@/lib/rbac/approvalLevel";

type RoleOption = {
  id: string;
  code: string;
  name: string;
  userType: string;
  hierarchyLevel: number;
  roleNo: number | null;
  approvalLevel: number;
  jobScope: string | null;
  reportsToCode: string | null;
};

type PagePermission = {
  id: string;
  key: string;
  description: string | null;
  appSurface: string | null;
  resource: string | null;
};

const SURFACE_LABEL: Record<string, string> = {
  office: "Office portal",
  desktop: "Desktop app",
  yard: "Yard portal",
  vessel: "Vessel",
  platform: "Platform",
};

export function PageAccessMatrix() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");

  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [pages, setPages] = useState<PagePermission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(roleParam);
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  const loadCatalog = useCallback(async () => {
    const [rolesRes, pagesRes] = await Promise.all([
      fetch("/api/admin/roles"),
      fetch("/api/admin/permissions?pagesOnly=1"),
    ]);
    const rolesData = await rolesRes.json();
    const pagesData = await pagesRes.json();
    setRoles(rolesData.roles ?? []);
    setPages(pagesData.pages ?? []);
  }, []);

  const loadRolePermissions = useCallback(async (roleId: string) => {
    const res = await fetch(`/api/admin/roles/${roleId}`);
    if (!res.ok) return;
    const data = await res.json();
    const pageKeys = (data.role?.permissionKeys ?? []).filter((k: string) =>
      k.startsWith("page."),
    );
    setGranted(new Set(pageKeys));
    if (data.role) {
      setRoles((prev) =>
        prev.map((r) =>
          r.id === roleId
            ? {
                ...r,
                roleNo: data.role.roleNo ?? r.roleNo,
                approvalLevel: data.role.approvalLevel ?? r.approvalLevel,
                jobScope: data.role.jobScope ?? r.jobScope,
                reportsToCode: data.role.reportsToCode ?? r.reportsToCode,
              }
            : r,
        ),
      );
    }
  }, []);

  useEffect(() => {
    void loadCatalog().finally(() => setLoading(false));
  }, [loadCatalog]);

  useEffect(() => {
    if (selectedRoleId) {
      void loadRolePermissions(selectedRoleId);
      router.replace(`/admin/access?role=${encodeURIComponent(selectedRoleId)}`, {
        scroll: false,
      });
    }
  }, [selectedRoleId, loadRolePermissions, router]);

  useEffect(() => {
    if (roleParam && roleParam !== selectedRoleId) {
      setSelectedRoleId(roleParam);
    }
  }, [roleParam, selectedRoleId]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  const filteredRoles = useMemo(() => {
    if (filterType === "all") return roles;
    return roles.filter((r) => r.userType === filterType);
  }, [roles, filterType]);

  const roleItems = useMemo(
    () => mapSelectItems(filteredRoles, (r) => r.id, (r) => r.name),
    [filteredRoles],
  );

  const pagesBySurface = useMemo(() => {
    const map = new Map<string, PagePermission[]>();
    for (const p of pages) {
      const surface = p.appSurface ?? "other";
      const list = map.get(surface) ?? [];
      list.push(p);
      map.set(surface, list);
    }
    return map;
  }, [pages]);

  function toggle(key: string, checked: boolean) {
    setGranted((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function selectAllInSurface(surface: string, checked: boolean) {
    const keys = pagesBySurface.get(surface)?.map((p) => p.key) ?? [];
    setGranted((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (checked) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }

  function applyJobScopeSuggestions() {
    if (!selectedRole?.jobScope) return;
    const suggested = suggestPageKeysFromJobScope(selectedRole.jobScope);
    setGranted((prev) => {
      const next = new Set(prev);
      for (const key of suggested) next.add(key);
      return next;
    });
    setMessage(`Added ${suggested.length} page(s) suggested from job scope. Save to persist.`);
  }

  const jobScopeSuggestions = useMemo(
    () => suggestPageKeysFromJobScope(selectedRole?.jobScope),
    [selectedRole?.jobScope],
  );

  const unsuggestedCount = useMemo(
    () => jobScopeSuggestions.filter((k) => !granted.has(k)).length,
    [jobScopeSuggestions, granted],
  );

  async function save() {
    if (!selectedRoleId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/admin/roles/${selectedRoleId}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pagePermissionKeys: [...granted],
        pagesOnly: true,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save.");
      return;
    }
    setMessage("Page access updated for this role.");
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading access matrix…</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configure page access</CardTitle>
          <CardDescription>
            Choose which pages and modules each role can open. Action permissions (create spec,
            award tender, etc.) are kept unchanged when you save here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="min-w-[220px] flex-1 space-y-2">
            <Label>Role</Label>
            <Select
              items={roleItems}
              value={selectedRoleId ?? ""}
              onValueChange={(v) => setSelectedRoleId(v || null)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a role…" />
              </SelectTrigger>
              <SelectContent>
                {filteredRoles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px] space-y-2">
            <Label>Filter roles</Label>
            <Select
              items={PAGE_ACCESS_TYPE_ITEMS}
              value={filterType}
              onValueChange={(v) => setFilterType(v ?? "all")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="office">Office</SelectItem>
                <SelectItem value="vessel">Vessel</SelectItem>
                <SelectItem value="external">External</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedRole ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {selectedRole.roleNo ? (
              <Badge variant="outline" className="font-mono">
                {selectedRole.roleNo}
              </Badge>
            ) : null}
            <Badge variant="secondary">{rbacUserTypeLabel(selectedRole.userType)}</Badge>
            <Badge variant="outline">Tier {selectedRole.hierarchyLevel}</Badge>
            <Badge variant="outline">{approvalLevelLabel(selectedRole.approvalLevel)}</Badge>
            {selectedRole.reportsToCode ? (
              <Badge variant="outline">Reports to {selectedRole.reportsToCode}</Badge>
            ) : null}
            <span className="text-sm text-muted-foreground">
              {granted.size} of {pages.length} pages enabled
            </span>
          </div>
          {selectedRole.jobScope ? (
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-base">Job scope</CardTitle>
                <CardDescription>
                  Catalog definition for this designation — use suggestions to map scope to pages.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-relaxed text-muted-foreground">{selectedRole.jobScope}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={unsuggestedCount === 0}
                    onClick={applyJobScopeSuggestions}
                  >
                    {unsuggestedCount > 0
                      ? `Apply ${unsuggestedCount} suggested page(s)`
                      : "All suggested pages enabled"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {!selectedRoleId ? (
        <Alert>
          <AlertDescription>Select a role above to edit which pages it can access.</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {[...pagesBySurface.entries()].map(([surface, surfacePages]) => {
            const allChecked = surfacePages.every((p) => granted.has(p.key));
            const someChecked = surfacePages.some((p) => granted.has(p.key));
            return (
              <Card key={surface}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 py-4">
                  <div>
                    <CardTitle className="text-base">
                      {SURFACE_LABEL[surface] ?? surface}
                    </CardTitle>
                    <CardDescription>{surfacePages.length} pages</CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => selectAllInSurface(surface, !allChecked)}
                  >
                    {allChecked ? "Clear all" : someChecked ? "Select all" : "Select all"}
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-72">
                    <ul className="divide-y">
                      {surfacePages.map((page) => (
                        <li key={page.id}>
                          <label
                            className={cn(
                              "flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-muted/50",
                              granted.has(page.key) && "bg-muted/30",
                            )}
                          >
                            <Checkbox
                              checked={granted.has(page.key)}
                              onCheckedChange={(c) => toggle(page.key, c === true)}
                              className="mt-0.5"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-snug">
                                {page.description ?? page.key}
                              </p>
                              <p className="truncate font-mono text-xs text-muted-foreground">
                                {page.resource ?? page.key}
                              </p>
                            </div>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {message ? (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {selectedRoleId ? (
        <div className="flex gap-2">
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save page access"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
