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
import type { EntityStatus } from "@prisma/client";
import type { VesselDto } from "@/lib/admin/types";
import { ENTITY_STATUS_ITEMS } from "@/lib/ui/labeledSelect";

type CompanyOption = { id: string; code: string; name: string };

type VesselFormProps = {
  initial?: Partial<VesselDto>;
  vesselId?: string;
  mode: "create" | "edit";
  defaultCompanyId?: string;
  defaultCompany?: CompanyOption;
};

function seedCompanies(
  defaultCompany?: CompanyOption,
  initial?: Partial<VesselDto>,
): CompanyOption[] {
  if (defaultCompany) return [defaultCompany];
  if (initial?.companyId && initial.companyName) {
    return [
      {
        id: initial.companyId,
        name: initial.companyName,
        code: initial.companyCode ?? "",
      },
    ];
  }
  return [];
}

export function VesselForm({
  initial,
  vesselId,
  mode,
  defaultCompanyId,
  defaultCompany,
}: VesselFormProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [companies, setCompanies] = useState<CompanyOption[]>(() =>
    seedCompanies(defaultCompany, initial),
  );

  const [companyId, setCompanyId] = useState(initial?.companyId ?? defaultCompanyId ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [imoNumber, setImoNumber] = useState(initial?.imoNumber ?? "");
  const [flag, setFlag] = useState(initial?.flag ?? "");
  const [vesselType, setVesselType] = useState(initial?.vesselType ?? "");
  const [callSign, setCallSign] = useState(initial?.callSign ?? "");
  const [grossTonnage, setGrossTonnage] = useState(
    initial?.grossTonnage != null ? String(initial.grossTonnage) : "",
  );
  const [yearBuilt, setYearBuilt] = useState(
    initial?.yearBuilt != null ? String(initial.yearBuilt) : "",
  );
  const [status, setStatus] = useState<EntityStatus>(initial?.status ?? "active");

  useEffect(() => {
    void fetch("/api/admin/companies?select=1&activeOnly=0")
      .then((r) => r.json())
      .then((d) => {
        const fetched = (d.companies ?? []) as CompanyOption[];
        setCompanies((prev) => {
          const byId = new Map<string, CompanyOption>();
          for (const c of [...prev, ...fetched]) byId.set(c.id, c);
          return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
        });
      })
      .finally(() => setCompaniesLoading(false));
  }, []);

  const companyItems = useMemo(
    () =>
      companies.map((c) => ({
        value: c.id,
        label: c.name,
      })),
    [companies],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const body = {
      companyId,
      name,
      ...(mode === "create" && code ? { code } : {}),
      imoNumber: imoNumber || null,
      flag: flag || null,
      vesselType: vesselType || null,
      callSign: callSign || null,
      grossTonnage: grossTonnage ? Number(grossTonnage) : null,
      yearBuilt: yearBuilt ? Number(yearBuilt) : null,
      status,
    };

    const url = mode === "create" ? "/api/admin/vessels" : `/api/admin/vessels/${vesselId}`;
    const res = await fetch(url, {
      method: mode === "create" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to save vessel");
      return;
    }

    router.push(`/admin/vessels/${data.vessel.id}`);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {mode === "create" ? "Register vessel" : "Edit vessel"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void handleSubmit(e)} className="max-w-xl space-y-4">
          <div className="space-y-2">
            <Label>Company</Label>
            <Select
              items={companyItems}
              value={companyId || null}
              onValueChange={(v) => setCompanyId(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={companiesLoading ? "Loading companies…" : "Select company"} />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Vessel name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            {mode === "create" ? (
              <div className="space-y-2">
                <Label htmlFor="code">Code (optional)</Label>
                <Input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Auto: AAA-BBB" />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={initial?.code ?? ""} disabled />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="imo">IMO number</Label>
              <Input id="imo" value={imoNumber} onChange={(e) => setImoNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flag">Flag</Label>
              <Input id="flag" value={flag} onChange={(e) => setFlag(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vesselType">Vessel type</Label>
              <Input id="vesselType" value={vesselType} onChange={(e) => setVesselType(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="callSign">Call sign</Label>
              <Input id="callSign" value={callSign} onChange={(e) => setCallSign(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="gt">Gross tonnage</Label>
              <Input id="gt" type="number" value={grossTonnage} onChange={(e) => setGrossTonnage(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">Year built</Label>
              <Input id="year" type="number" value={yearBuilt} onChange={(e) => setYearBuilt(e.target.value)} />
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

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !companyId}>
              {busy ? "Saving…" : mode === "create" ? "Register vessel" : "Save changes"}
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
