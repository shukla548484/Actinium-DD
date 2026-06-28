"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PhoneNumberField } from "@/components/admin/PhoneNumberField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EntityStatus } from "@prisma/client";
import {
  DESIGNATION_OPTIONS,
  getDesignationByCode,
  getDesignationByLabel,
} from "@/lib/admin/designations";
import {
  formatPhoneE164,
  isValidEmployeePhone,
  isValidLocalPhoneNumber,
  parseStoredPhone,
} from "@/lib/admin/phone";
import type { EmployeeDto } from "@/lib/admin/types";
import { ENTITY_STATUS_ITEMS } from "@/lib/ui/labeledSelect";

type CompanyOption = { id: string; code: string; name: string };

type EmployeeFormProps = {
  initial?: Partial<EmployeeDto>;
  employeeId?: string;
  mode: "create" | "edit";
  defaultCompanyId?: string;
  defaultCompany?: CompanyOption;
};

function seedCompanies(
  defaultCompany?: CompanyOption,
  initial?: Partial<EmployeeDto>,
): CompanyOption[] {
  if (defaultCompany) return [defaultCompany];
  if (initial?.companyId && initial.companyName) {
    return [{ id: initial.companyId, name: initial.companyName, code: "" }];
  }
  return [];
}

function initialDesignationCode(initial?: Partial<EmployeeDto>): string {
  if (!initial?.designation) return "";
  const match = getDesignationByLabel(initial.designation);
  if (match) return match.value;
  return `legacy:${initial.designation}`;
}

export function EmployeeForm({
  initial,
  employeeId,
  mode,
  defaultCompanyId,
  defaultCompany,
}: EmployeeFormProps) {
  const router = useRouter();
  const parsedPhone = parseStoredPhone(initial?.phone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [companies, setCompanies] = useState<CompanyOption[]>(() =>
    seedCompanies(defaultCompany, initial),
  );

  const [companyId, setCompanyId] = useState(initial?.companyId ?? defaultCompanyId ?? "");
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [dialCode, setDialCode] = useState(parsedPhone.dialCode);
  const [localNumber, setLocalNumber] = useState(parsedPhone.localNumber);
  const [designationCode, setDesignationCode] = useState(() => initialDesignationCode(initial));
  const [department, setDepartment] = useState(initial?.department ?? "");
  const [status, setStatus] = useState<EntityStatus>(initial?.status ?? "wait");

  useEffect(() => {
    void fetch("/api/admin/companies?select=1&activeOnly=0")
      .then((r) => r.json())
      .then((companiesData) => {
        const fetched = (companiesData.companies ?? []) as CompanyOption[];
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

  const designationItems = useMemo(() => {
    const items = DESIGNATION_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
      searchText: option.searchText,
    }));
    if (initial?.designation && !getDesignationByLabel(initial.designation)) {
      items.unshift({
        value: `legacy:${initial.designation}`,
        label: initial.designation,
        searchText: initial.designation,
      });
    }
    return items;
  }, [initial?.designation]);

  function handleDesignationChange(code: string) {
    setDesignationCode(code);
    const option = getDesignationByCode(code);
    if (option) setDepartment(option.department);
  }

  function validateForm(): string | null {
    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return "Enter a valid email address";
    }
    if (!isValidLocalPhoneNumber(localNumber)) {
      return "Enter a 10-digit phone number";
    }
    if (!designationCode) {
      return "Select a designation";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    setError(null);

    const designationOption = getDesignationByCode(designationCode);
    const designationLabel = designationOption?.label
      ?? (designationCode.startsWith("legacy:") ? designationCode.slice(7) : "");
    const phone = formatPhoneE164(dialCode, localNumber);

    const body = {
      companyId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone,
      designation: designationLabel,
      department: department.trim() || null,
      status,
    };

    const url =
      mode === "create" ? "/api/admin/employees" : `/api/admin/employees/${employeeId}`;
    const res = await fetch(url, {
      method: mode === "create" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to save employee");
      return;
    }

    const id = data.employee.id as string;
    if (mode === "create") {
      router.push(`/admin/employees/${id}/assign-vessels`);
    } else {
      router.push(`/admin/employees/${id}`);
    }
    router.refresh();
  }

  const phonePreview = isValidLocalPhoneNumber(localNumber)
    ? formatPhoneE164(dialCode, localNumber)
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {mode === "create" ? "Register employee" : "Edit employee"}
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

          {mode === "edit" && initial?.employeeCode ? (
            <div className="space-y-2">
              <Label>Employee code</Label>
              <Input value={initial.employeeCode} disabled />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneLocal">Phone</Label>
            <PhoneNumberField
              dialCode={dialCode}
              localNumber={localNumber}
              onDialCodeChange={setDialCode}
              onLocalNumberChange={setLocalNumber}
              localId="phoneLocal"
            />
            {phonePreview && isValidEmployeePhone(phonePreview) ? (
              <p className="text-xs text-muted-foreground">Registered as {phonePreview}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Designation</Label>
              <SearchableSelect
                items={designationItems}
                value={designationCode}
                onValueChange={handleDesignationChange}
                placeholder="Select designation"
                searchPlaceholder="Search designation…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Auto-filled from designation"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              items={ENTITY_STATUS_ITEMS}
              value={status}
              onValueChange={(v) => setStatus(v as EntityStatus)}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="wait">Waiting</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "create" ? (
            <p className="text-sm text-muted-foreground">
              New employees start in <strong>Waiting</strong> status until vessels are assigned.
              System role is assigned automatically from designation.
            </p>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !companyId}>
              {busy ? "Saving…" : mode === "create" ? "Register employee" : "Save changes"}
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
