"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { mapSelectItems } from "@/lib/ui/labeledSelect";

type CompanyOption = { id: string; name: string; code: string };

type ImportError = { row: number; message: string };

export function EmployeeBulkPanel({ defaultCompanyId }: { defaultCompanyId?: string }) {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? "all");
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<ImportError[]>([]);

  useEffect(() => {
    void fetch("/api/admin/companies?select=1&activeOnly=0")
      .then((r) => r.json())
      .then((d) => setCompanies(d.companies ?? []));
  }, []);

  const companyItems = useMemo(
    () => [
      { value: "all", label: "All companies" },
      ...mapSelectItems(companies, (c) => c.id, (c) => c.name),
    ],
    [companies],
  );

  const exportHref =
    companyId === "all"
      ? "/api/admin/employees/template"
      : `/api/admin/employees/template?companyId=${encodeURIComponent(companyId)}`;

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    setMessage(null);
    setErrors([]);

    const formData = new FormData();
    formData.set("file", file);

    const res = await fetch("/api/admin/employees/import", {
      method: "POST",
      body: formData,
    });
    const data = (await res.json()) as {
      imported?: number;
      skipped?: number;
      errors?: ImportError[];
      error?: string;
    };

    setImporting(false);

    if (!res.ok) {
      setMessage(data.error ?? "Import failed");
      setErrors(data.errors ?? []);
      return;
    }

    const imported = data.imported ?? 0;
    const skipped = data.skipped ?? 0;
    setErrors(data.errors ?? []);
    setMessage(
      imported > 0
        ? `Imported ${imported} employee(s)${skipped > 0 ? `; ${skipped} row(s) skipped` : ""}.`
        : "No employees were imported.",
    );

    if (imported > 0) {
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bulk upload employees</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Download the Excel template, fill in employee rows, and upload. Designations must match
          the <strong>Designations</strong> sheet. Phone uses country code + 10-digit number.
          System role is assigned automatically from designation.
        </p>

        <div className="space-y-2">
          <Label>Filter export by company (optional)</Label>
          <Select
            items={companyItems}
            value={companyId}
            onValueChange={(v) => setCompanyId(v ?? "all")}
          >
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder="All companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All companies</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            render={<a href="/api/admin/employees/template?mode=empty" />}
            nativeButton={false}
          >
            Download empty template
          </Button>

          <Button variant="outline" render={<a href={exportHref} />} nativeButton={false}>
            Download employee data
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={importing}
            onClick={() => document.getElementById("employee-bulk-import")?.click()}
          >
            {importing ? "Importing…" : "Bulk upload Excel"}
          </Button>
          <input
            id="employee-bulk-import"
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => void handleImport(e)}
          />
        </div>

        <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Template columns</p>
          <p>
            Company, First Name, Last Name, Email, Country Code, Phone (10 digits), Designation,
            Department, Status (active / wait / inactive)
          </p>
        </div>

        {message ? (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        {errors.length > 0 ? (
          <Alert variant="destructive">
            <AlertDescription>
              <p className="mb-2 font-medium">Import issues</p>
              <ul className="list-inside list-disc space-y-1 text-sm">
                {errors.slice(0, 20).map((err) => (
                  <li key={`${err.row}-${err.message}`}>
                    {err.row > 0 ? `Row ${err.row}: ` : ""}
                    {err.message}
                  </li>
                ))}
                {errors.length > 20 ? (
                  <li>…and {errors.length - 20} more</li>
                ) : null}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

      </CardContent>
    </Card>
  );
}
