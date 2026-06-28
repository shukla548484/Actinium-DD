import Link from "next/link";
import { notFound } from "next/navigation";
import { EntityActionsMenu } from "@/components/admin/EntityActionsMenu";
import { EntityStatusBadge } from "@/components/admin/EntityStatusBadge";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { TableCard } from "@/components/layout/TableCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getVessel } from "@/lib/db/vessels";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function VesselDetailPage({ params }: Props) {
  const { id } = await params;
  const vessel = await getVessel(id);
  if (!vessel) notFound();

  return (
    <PageShell>
      <PageHeader
        title={vessel.name}
        description={`${vessel.code} · ${vessel.company?.name ?? vessel.companyName}`}
        actions={
          <div className="flex gap-2">
            <Button render={<Link href={`/admin/vessels/${id}/edit`} />} nativeButton={false}>
              Edit
            </Button>
            <EntityActionsMenu
              entityType="vessel"
              id={id}
              status={vessel.status}
              viewHref={`/admin/vessels/${id}`}
              editHref={`/admin/vessels/${id}/edit`}
            />
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Particulars</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <EntityStatusBadge status={vessel.status} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IMO</span>
              <span className="font-mono">{vessel.imoNumber ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Flag</span>
              <span>{vessel.flag ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span>{vessel.vesselType ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Call sign</span>
              <span>{vessel.callSign ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gross tonnage</span>
              <span>{vessel.grossTonnage ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Year built</span>
              <span>{vessel.yearBuilt ?? "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-6 text-sm">
            <div>
              <p className="text-2xl font-semibold">{vessel.employeeCount ?? 0}</p>
              <p className="text-muted-foreground">Assigned crew</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">{vessel.projectCount ?? 0}</p>
              <p className="text-muted-foreground">Projects</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {vessel.assignedEmployees && vessel.assignedEmployees.length > 0 ? (
        <TableCard title="Assigned employees">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Watch keeper</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vessel.assignedEmployees.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.employeeCode}</TableCell>
                  <TableCell>
                    <Link href={`/admin/employees/${e.id}`} className="hover:underline">
                      {e.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <EntityStatusBadge status={e.status} />
                  </TableCell>
                  <TableCell>{e.isWatchKeeper ? "Yes" : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      ) : null}
    </PageShell>
  );
}
