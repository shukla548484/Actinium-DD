"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EntityActionsMenu } from "@/components/admin/EntityActionsMenu";
import { EntityStatusBadge, ENTITY_STATUS_OPTIONS } from "@/components/admin/EntityStatusBadge";
import type { OrganizationModule } from "@/lib/admin/organizationModules";
import { TableCard } from "@/components/layout/TableCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EntityStatus } from "@prisma/client";
import type { CompanyDto } from "@/lib/admin/types";
import { companyCategoryLabel } from "@/lib/admin/companyCategory";

type Props = {
  module: OrganizationModule;
};

export function OrganizationCompanyListPanel({ module }: Props) {
  const [companies, setCompanies] = useState<CompanyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<EntityStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      ...(search ? { search } : {}),
      ...(status !== "all" ? { status } : {}),
      ...(module.category ? { category: module.category } : {}),
      ...(module.excludeCategories?.length
        ? { excludeCategories: module.excludeCategories.join(",") }
        : {}),
    });
    const res = await fetch(`/api/admin/companies?${params}`);
    if (!res.ok) {
      setCompanies([]);
      setTotalPages(1);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { companies?: CompanyDto[]; totalPages?: number };
    setCompanies(data.companies ?? []);
    setTotalPages(data.totalPages ?? 1);
    setLoading(false);
  }, [module.category, module.excludeCategories, page, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusItems = useMemo(
    () => ENTITY_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    [],
  );

  const showCategoryColumn = !module.category;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder={`Search ${module.label.toLowerCase()}…`}
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          className="max-w-xs"
        />
        <Select
          items={statusItems}
          value={status}
          onValueChange={(v) => {
            setPage(1);
            setStatus(v as EntityStatus | "all");
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      <TableCard title={`${module.label}${loading ? "" : ` (${companies.length} on page)`}`}>
        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                {showCategoryColumn ? <TableHead>Company type</TableHead> : null}
                <TableHead>Level</TableHead>
                <TableHead>Status</TableHead>
                {module.showFleetSummary ? (
                  <TableHead className="text-right">Vessels</TableHead>
                ) : null}
                <TableHead className="text-right">Contacts</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showCategoryColumn ? 8 : 7}
                    className="text-center text-muted-foreground"
                  >
                    No {module.label.toLowerCase()} found
                  </TableCell>
                </TableRow>
              ) : (
                companies.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.code}</TableCell>
                    <TableCell>
                      <Link
                        href={`${module.basePath}/${c.id}`}
                        className="font-medium hover:underline"
                      >
                        {c.name}
                      </Link>
                      {c.parentName ? (
                        <p className="text-xs text-muted-foreground">Under {c.parentName}</p>
                      ) : null}
                    </TableCell>
                    {showCategoryColumn ? (
                      <TableCell>{companyCategoryLabel(c.category)}</TableCell>
                    ) : null}
                    <TableCell>{c.type === "MASTER" ? "Master" : "Sub"}</TableCell>
                    <TableCell>
                      <EntityStatusBadge status={c.status} />
                    </TableCell>
                    {module.showFleetSummary ? (
                      <TableCell className="text-right">{c.vesselCount ?? 0}</TableCell>
                    ) : null}
                    <TableCell className="text-right">{c.employeeCount ?? 0}</TableCell>
                    <TableCell>
                      <EntityActionsMenu
                        entityType="company"
                        id={c.id}
                        status={c.status}
                        viewHref={`${module.basePath}/${c.id}`}
                        editHref={`${module.basePath}/${c.id}/edit`}
                        listRedirectPath={module.basePath}
                        onChanged={() => void load()}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </TableCard>

      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}