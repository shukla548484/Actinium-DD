"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import type { CompanyCategory, CompanyType, EntityStatus } from "@prisma/client";
import { COMPANY_CATEGORY_OPTIONS } from "@/lib/admin/companyCategory";
import type { OrganizationModule } from "@/lib/admin/organizationModules";
import type { CompanyDto } from "@/lib/admin/types";
import {
  COMPANY_TYPE_ITEMS,
  ENTITY_STATUS_ITEMS,
  mapSelectItems,
} from "@/lib/ui/labeledSelect";

type CompanyOption = { id: string; code: string; name: string; type: CompanyType };

type Props = {
  module: OrganizationModule;
  initial?: Partial<CompanyDto>;
  companyId?: string;
  mode: "create" | "edit";
};

export function OrganizationCompanyForm({ module, initial, companyId, mode }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [masters, setMasters] = useState<CompanyOption[]>([]);

  const lockedCategory = module.category;

  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<CompanyCategory | "">(
    initial?.category ?? lockedCategory ?? "",
  );
  const [type, setType] = useState<CompanyType>(initial?.type ?? "MASTER");
  const [parentId, setParentId] = useState(initial?.parentId ?? "");
  const [status, setStatus] = useState<EntityStatus>(initial?.status ?? "wait");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [contactPerson, setContactPerson] = useState(initial?.contactPerson ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? "");

  useEffect(() => {
    void fetch("/api/admin/companies?select=1&activeOnly=0")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.companies ?? []) as CompanyOption[];
        setMasters(list.filter((c) => c.type === "MASTER" && c.id !== companyId));
      });
  }, [companyId]);

  const categoryItems = useMemo(
    () => COMPANY_CATEGORY_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    [],
  );

  const parentItems = useMemo(
    () => mapSelectItems(masters, (m) => m.id, (m) => m.name),
    [masters],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const resolvedCategory = lockedCategory ?? category;
    if (!resolvedCategory) {
      setError("Company type is required");
      return;
    }

    setBusy(true);
    setError(null);
    const body = {
      name,
      category: resolvedCategory,
      type,
      parentId: type === "SUB" && parentId ? parentId : null,
      status,
      address: address || null,
      contactPerson: contactPerson || null,
      contactEmail: contactEmail || null,
      contactPhone: contactPhone || null,
    };

    const url =
      mode === "create" ? "/api/admin/companies" : `/api/admin/companies/${companyId}`;
    const res = await fetch(url, {
      method: mode === "create" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? `Failed to save ${module.labelSingular.toLowerCase()}`);
      return;
    }

    router.push(`${module.basePath}/${data.company.id}`);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {mode === "create" ? module.registerLabel : `Edit ${module.labelSingular.toLowerCase()}`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void handleSubmit(e)} className="max-w-xl space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{module.labelSingular} name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          {lockedCategory ? (
            <div className="space-y-2">
              <Label>Organization type</Label>
              <Input
                value={
                  COMPANY_CATEGORY_OPTIONS.find((o) => o.value === lockedCategory)?.label ??
                  lockedCategory
                }
                disabled
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>
                Company type <span className="text-destructive">*</span>
              </Label>
              <Select
                items={categoryItems}
                value={category}
                onValueChange={(v) => setCategory(v as CompanyCategory)}
                required
              >
                <SelectTrigger aria-required="true">
                  <SelectValue placeholder="Select company type" />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_CATEGORY_OPTIONS.filter(
                    (option) => !module.excludeCategories?.includes(option.value),
                  ).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Organization level</Label>
              <Select
                items={COMPANY_TYPE_ITEMS}
                value={type}
                onValueChange={(v) => setType(v as CompanyType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MASTER">Master company</SelectItem>
                  <SelectItem value="SUB">Sub company</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                items={ENTITY_STATUS_ITEMS}
                value={status}
                onValueChange={(v) => setStatus(v as EntityStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="wait">Waiting</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {type === "SUB" ? (
            <div className="space-y-2">
              <Label>Parent company</Label>
              <Select
                items={parentItems}
                value={parentId || null}
                onValueChange={(v) => setParentId(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select master company" />
                </SelectTrigger>
                <SelectContent>
                  {masters.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contactPerson">Contact person</Label>
              <Input id="contactPerson" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact phone</Label>
              <Input id="contactPhone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact email</Label>
            <Input id="contactEmail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : mode === "create" ? module.registerLabel : "Save changes"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
