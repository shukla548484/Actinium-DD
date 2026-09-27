"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type {
  ClassStatusAnalysis,
  ClassStatusTableRow,
} from "@/lib/superintendent/classStatusAnalysis";

type Props = {
  analysis: ClassStatusAnalysis;
  onChange: (next: ClassStatusAnalysis) => void;
  onSave: (opts?: { markComplete?: boolean }) => void;
  onCreateJobs: () => void;
  dryDockProjectId: string;
  saving: boolean;
  creatingJobs: boolean;
  error: string | null;
  createMessage: string | null;
};

function patchAttend(
  rows: ClassStatusTableRow[],
  id: string,
  attend: boolean,
): ClassStatusTableRow[] {
  return rows.map((row) => (row.id === id ? { ...row, attend } : row));
}

function KeyValueGrid({
  entries,
}: {
  entries: Array<[string, string | null | undefined]>;
}) {
  const visible = entries.filter(([, v]) => v != null && String(v).trim());
  if (visible.length === 0) {
    return null;
  }
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {visible.map(([k, v]) => (
        <div key={k} className="rounded-md border px-3 py-2">
          <dt className="text-xs text-muted-foreground">{k}</dt>
          <dd className="text-sm font-medium whitespace-pre-wrap">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function FindingsTable({
  title,
  rows,
  onToggle,
}: {
  title: string;
  rows: ClassStatusTableRow[];
  onToggle: (id: string, attend: boolean) => void;
}) {
  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? null : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Attend</TableHead>
                  <TableHead className="w-28">Ref</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-36">Due / window</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-24">Job</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} data-state={row.attend ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={row.attend}
                        onCheckedChange={(v) => onToggle(row.id, v === true)}
                        aria-label={`Attend ${row.title}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.ref ?? "—"}</TableCell>
                    <TableCell>
                      <span className="font-medium">{row.title}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.dueOrWindow ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.createdJobId ? (
                        <Link
                          href={`/superintendent/jobs/${row.createdJobId}/edit`}
                          className="text-primary hover:underline"
                        >
                          Created
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ClassStatusConfirmationPanel({
  analysis,
  onChange,
  onSave,
  onCreateJobs,
  dryDockProjectId,
  saving,
  creatingJobs,
  error,
  createMessage: _createMessage,
}: Props) {
  const selectedCount =
    analysis.jobs.filter((r) => r.attend).length +
    analysis.cocs.filter((r) => r.attend).length +
    analysis.otherItems.filter((r) => r.attend).length;

  const jobsHref = `/superintendent/jobs?dryDockProjectId=${encodeURIComponent(dryDockProjectId)}`;
  const { vessel, parties, certificates, surveyPlanning, machinery, conditions } = analysis;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Class / survey status findings</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vessel &amp; class society</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <KeyValueGrid
              entries={[
                ["Vessel", vessel.vesselName],
                ["Classification society", vessel.classificationSociety],
                ["Class / IR no.", vessel.classNumber ?? vessel.irNumber],
                ["IMO", vessel.imoNumber],
                ["Type", vessel.vesselType],
                ["Gross tonnage", vessel.grossTonnage],
                ["Deadweight", vessel.deadweight],
                ["Port of registry", vessel.portOfRegistry],
                ["Flag", vessel.flag],
                ["Date of build", vessel.dateOfBuild],
                ["Report generated", vessel.reportGeneratedOn],
                ...Object.entries(vessel.extra ?? {}),
              ]}
            />
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Owners, managers &amp; invoicing</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValueGrid
              entries={[
                ["Registered owner", parties.registeredOwner],
                ["Owner", parties.owner],
                ["Manager", parties.manager],
                ["ISM manager", parties.ismManager],
                ["Invoicing address", parties.invoicingAddress],
                ...Object.entries(parties.extra ?? {}),
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Survey schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {surveyPlanning.surveys.length === 0 ? null : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Survey</TableHead>
                    <TableHead>Assigned date</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead>Range</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {surveyPlanning.surveys.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.label}</TableCell>
                      <TableCell className="text-sm">{s.assignedDate ?? "—"}</TableCell>
                      <TableCell className="text-sm">{s.dueDate ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {s.rangeLabel ||
                          [s.rangeStart, s.rangeEnd].filter(Boolean).join(" → ") ||
                          "—"}
                      </TableCell>
                      <TableCell className="text-sm">{s.status ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {surveyPlanning.anniversaryDate ? (
            <KeyValueGrid
              entries={[
                ["Anniversary (IOPP issued, informational)", surveyPlanning.anniversaryDate],
                ["Anniversary source", surveyPlanning.anniversarySource],
              ]}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Certificates</CardTitle>
        </CardHeader>
        <CardContent>
          {certificates.length === 0 ? null : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Certificate</TableHead>
                    <TableHead>Number</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Place / by</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Annual endorsement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {certificates.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <span className="font-medium">{c.name}</span>
                        {c.isIopp ? (
                          <span className="ml-2 text-xs text-amber-700">IOPP (anniversary)</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.certificateNumber ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">{c.issuedDate ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {[c.issuedPlace, c.issuedBy].filter(Boolean).join(" · ") || "—"}
                      </TableCell>
                      <TableCell className="text-sm">{c.expiryDate ?? "—"}</TableCell>
                      <TableCell className="text-sm">{c.annualEndorsementDue ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {conditions.length > 0 ? (
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Conditions, due/overdue &amp; memoranda</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kind</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conditions.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs uppercase">{c.kind.replace(/_/g, " ")}</TableCell>
                      <TableCell className="font-mono text-xs">{c.ref ?? "—"}</TableCell>
                      <TableCell className="font-medium">{c.title}</TableCell>
                      <TableCell className="text-sm">{c.dueOrWindow ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.notes ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {machinery.length > 0 ? (
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Machinery last done / due</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Code</TableHead>
                    <TableHead>Machinery</TableHead>
                    <TableHead>Last done</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Include in DD</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {machinery.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">{m.classCode ?? "—"}</TableCell>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-sm">{m.lastDone ?? "—"}</TableCell>
                      <TableCell className="text-sm">{m.dueDate ?? "—"}</TableCell>
                      <TableCell className="text-sm">{m.status ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        {m.includeInDryDock ? "Yes" : "No"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.reason ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Machinery last done / due</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No machinery / continuous-survey items extracted from this report.
            </p>
          </CardContent>
        </Card>
      )}

      {analysis.machinerySync && analysis.machinerySync.length > 0 ? (
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Machinery register sync</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Class report vs vessel register. Class updates dates only when newer than the app;
              running hours are never overwritten.
            </p>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Machinery</TableHead>
                    <TableHead className="w-24">Code</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Class last / due</TableHead>
                    <TableHead>App last / due</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.machinerySync.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="font-mono text-xs">{row.classCode ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.matchBy ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {[row.classLastDone ?? "—", row.classDueDate ?? "—"].join(" / ")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {[row.appLastDone ?? "—", row.appDueDate ?? "—"].join(" / ")}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{row.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <FindingsTable
        title="Jobs to attend in dry dock"
        rows={analysis.jobs}
        onToggle={(id, attend) =>
          onChange({ ...analysis, jobs: patchAttend(analysis.jobs, id, attend) })
        }
      />
      <FindingsTable
        title="Conditions of Class (COC)"
        rows={analysis.cocs}
        onToggle={(id, attend) =>
          onChange({ ...analysis, cocs: patchAttend(analysis.cocs, id, attend) })
        }
      />
      {analysis.otherItems.length > 0 ? (
        <FindingsTable
          title="Other class items"
          rows={analysis.otherItems}
          onToggle={(id, attend) =>
            onChange({
              ...analysis,
              otherItems: patchAttend(analysis.otherItems, id, attend),
            })
          }
        />
      ) : null}

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">CAP certification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                [true, "Yes — CAP required"],
                [false, "No — CAP not required"],
              ] as const
            ).map(([value, label]) => {
              const selected = analysis.capCertification.ownersRequireCap === value;
              return (
                <Button
                  key={label}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  onClick={() =>
                    onChange({
                      ...analysis,
                      capCertification: {
                        ...analysis.capCertification,
                        ownersRequireCap: value,
                      },
                    })
                  }
                >
                  {label}
                </Button>
              );
            })}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cap-notes">CAP notes</Label>
            <Textarea
              id="cap-notes"
              rows={2}
              value={analysis.capCertification.notes}
              onChange={(e) =>
                onChange({
                  ...analysis,
                  capCertification: {
                    ...analysis.capCertification,
                    notes: e.target.value,
                  },
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{selectedCount} selected</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onSave()}
            disabled={saving || creatingJobs}
          >
            {saving ? "Saving…" : "Save ticks"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onSave({ markComplete: true })}
            disabled={saving || creatingJobs}
          >
            Mark complete
          </Button>
          <Button
            type="button"
            onClick={onCreateJobs}
            disabled={saving || creatingJobs || selectedCount === 0}
          >
            {creatingJobs ? "Creating jobs…" : "Create selected jobs"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            render={<Link href={jobsHref} />}
            nativeButton={false}
          >
            Open jobs
          </Button>
        </div>
      </div>
    </div>
  );
}
