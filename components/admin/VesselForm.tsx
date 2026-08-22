"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerField, toDateInput } from "@/components/ui/DatePickerField";
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
import { generateVesselCode, normalizeVesselCode } from "@/lib/admin/codes";
import type { VesselDto } from "@/lib/admin/types";
import { ENTITY_STATUS_ITEMS } from "@/lib/ui/labeledSelect";
import { computeVesselSurveyStatus } from "@/lib/vessels/surveyWindows";
import { cn } from "@/lib/utils";

type CompanyOption = { id: string; code: string; name: string };
type CodeMode = "manual" | "auto";

type VesselFormProps = {
  initial?: Partial<VesselDto>;
  vesselId?: string;
  mode: "create" | "edit";
  defaultCompanyId?: string;
  defaultCompany?: CompanyOption;
  /** Prefetched companies (avoids empty dropdown if client fetch fails). */
  initialCompanies?: CompanyOption[];
};

function seedCompanies(
  defaultCompany?: CompanyOption,
  initial?: Partial<VesselDto>,
  initialCompanies?: CompanyOption[],
): CompanyOption[] {
  const byId = new Map<string, CompanyOption>();
  for (const c of initialCompanies ?? []) byId.set(c.id, c);
  if (defaultCompany) byId.set(defaultCompany.id, defaultCompany);
  if (initial?.companyId && initial.companyName) {
    byId.set(initial.companyId, {
      id: initial.companyId,
      name: initial.companyName,
      code: initial.companyCode ?? "",
    });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function VesselForm({
  initial,
  vesselId,
  mode,
  defaultCompanyId,
  defaultCompany,
  initialCompanies,
}: VesselFormProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companiesLoading, setCompaniesLoading] = useState(!(initialCompanies && initialCompanies.length > 0));
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>(() =>
    seedCompanies(defaultCompany, initial, initialCompanies),
  );

  const [companyId, setCompanyId] = useState(initial?.companyId ?? defaultCompanyId ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [codeMode, setCodeMode] = useState<CodeMode>("auto");
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
  const [lastIntermediateSurveyDate, setLastIntermediateSurveyDate] = useState(
    toDateInput(initial?.lastIntermediateSurveyDate),
  );
  const [lastDryDockDate, setLastDryDockDate] = useState(
    toDateInput(initial?.lastDryDockDate),
  );
  const [status, setStatus] = useState<EntityStatus>(initial?.status ?? "active");

  const surveyStatus = useMemo(
    () =>
      computeVesselSurveyStatus({
        lastDockingDate: lastDryDockDate || null,
        lastIntermediateSurveyDate: lastIntermediateSurveyDate || null,
      }),
    [lastDryDockDate, lastIntermediateSurveyDate],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/companies?select=1&activeOnly=0", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const data = (await res.json()) as { companies?: CompanyOption[]; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setCompaniesError(data.error ?? "Failed to load companies");
          return;
        }
        const fetched = data.companies ?? [];
        setCompaniesError(null);
        setCompanies((prev) => {
          const byId = new Map<string, CompanyOption>();
          for (const c of [...prev, ...fetched]) byId.set(c.id, c);
          return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
        });
      } catch {
        if (!cancelled) setCompaniesError("Failed to load companies");
      } finally {
        if (!cancelled) setCompaniesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const companyItems = useMemo(
    () =>
      companies.map((c) => ({
        value: c.id,
        label: c.name,
      })),
    [companies],
  );

  const autoCodePreview = useMemo(() => {
    if (!name.trim()) return "AAA-BBB";
    return generateVesselCode(name);
  }, [name]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    if (mode === "create" && codeMode === "manual" && !code.trim()) {
      setBusy(false);
      setError("Enter a vessel code, or switch to Auto-generated unique code.");
      return;
    }

    const body =
      mode === "create"
        ? {
            companyId,
            name,
            codeMode,
            ...(codeMode === "manual" ? { code: normalizeVesselCode(code) } : {}),
            imoNumber: imoNumber || null,
            flag: flag || null,
            vesselType: vesselType || null,
            callSign: callSign || null,
            grossTonnage: grossTonnage ? Number(grossTonnage) : null,
            yearBuilt: yearBuilt ? Number(yearBuilt) : null,
            lastIntermediateSurveyDate: lastIntermediateSurveyDate || null,
            lastDryDockDate: lastDryDockDate || null,
            status,
          }
        : {
            companyId,
            name,
            imoNumber: imoNumber || null,
            flag: flag || null,
            vesselType: vesselType || null,
            callSign: callSign || null,
            grossTonnage: grossTonnage ? Number(grossTonnage) : null,
            yearBuilt: yearBuilt ? Number(yearBuilt) : null,
            lastIntermediateSurveyDate: lastIntermediateSurveyDate || null,
            lastDryDockDate: lastDryDockDate || null,
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
              key={`company-select-${companies.length}`}
              items={companyItems}
              value={companyId || null}
              onValueChange={(v) => setCompanyId(v ?? "")}
            >
              <SelectTrigger className="w-full min-w-[16rem]">
                <SelectValue
                  placeholder={
                    companiesLoading
                      ? "Loading companies…"
                      : companies.length === 0
                        ? "No companies found"
                        : "Select company"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {companiesError ? (
              <p className="text-xs text-destructive">{companiesError}</p>
            ) : null}
            {!companiesLoading && companies.length === 0 && !companiesError ? (
              <p className="text-xs text-muted-foreground">
                No companies available. Register a company first under Admin → Companies.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Vessel name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          {mode === "create" ? (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-2">
                <Label>Vessel code</Label>
                <Select
                  items={[
                    { value: "auto", label: "Auto-generated unique code" },
                    { value: "manual", label: "Manual entry" },
                  ]}
                  value={codeMode}
                  onValueChange={(v) => setCodeMode((v as CodeMode) || "auto")}
                >
                  <SelectTrigger className="w-full min-w-[16rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-generated unique code</SelectItem>
                    <SelectItem value="manual">Manual entry</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {codeMode === "auto" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="autoCodePreview">Preview</Label>
                  <Input
                    id="autoCodePreview"
                    value={autoCodePreview}
                    disabled
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Format AAA-BBB from vessel name. If taken, the system assigns the next unique code.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="code">
                    Enter code <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. TAR-EVE"
                    className="font-mono"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Use AAA-BBB (letters). Must be unique for this company.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={initial?.code ?? ""} disabled className="font-mono" />
            </div>
          )}

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
                <SelectTrigger className="w-full">
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

          <div className="space-y-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Class survey dates</p>
              <p className="text-xs text-muted-foreground">
                Used to detect intermediate (≈2.5y) and docking / special survey (≈5y) windows.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <DatePickerField
                id="lastIntermediateSurveyDate"
                name="lastIntermediateSurveyDate"
                label="Last Intermediate Survey date"
                value={lastIntermediateSurveyDate}
                onValueChange={setLastIntermediateSurveyDate}
                placeholder="Select date"
              />
              <DatePickerField
                id="lastDryDockDate"
                name="lastDryDockDate"
                label="Last Docking Survey date"
                value={lastDryDockDate}
                onValueChange={setLastDryDockDate}
                placeholder="Select date"
              />
            </div>
            <div
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                surveyStatus.activeWindow === "docking" &&
                  "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100",
                surveyStatus.activeWindow === "intermediate" &&
                  "border-sky-500/40 bg-sky-500/10 text-sky-950 dark:text-sky-100",
                surveyStatus.activeWindow === "none" && "bg-muted/40",
                surveyStatus.activeWindow === "unknown" && "bg-muted/30 text-muted-foreground",
              )}
            >
              <p className="font-medium">{surveyStatus.label}</p>
              <p className="mt-0.5 text-xs opacity-90">{surveyStatus.message}</p>
              {surveyStatus.nextDockingDue ? (
                <p className="mt-1 text-xs">
                  Next docking due: <span className="font-mono">{surveyStatus.nextDockingDue}</span>
                  {surveyStatus.nextIntermediateDue ? (
                    <>
                      {" "}
                      · Next intermediate due:{" "}
                      <span className="font-mono">{surveyStatus.nextIntermediateDue}</span>
                    </>
                  ) : null}
                </p>
              ) : null}
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
