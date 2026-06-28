"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import {
  EntityFormActions,
  useEntityFormSubmit,
} from "@/components/superintendent/EntityListPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerField, toDateInput } from "@/components/ui/DatePickerField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

type TechnicalProfile = {
  classNotation: string | null;
  mainEngine: string | null;
  auxiliaryEngine: string | null;
  boilerInfo: string | null;
  defectSummary: string | null;
  pmsSummary: string | null;
  sparesSummary: string | null;
  notes: string | null;
};

type VesselDetail = {
  id: string;
  code: string;
  name: string;
  imoNumber: string | null;
  flag: string | null;
  vesselType: string | null;
  callSign: string | null;
  grossTonnage: number | null;
  yearBuilt: number | null;
  nextDryDockDue: string | null;
  lastDryDockDate: string | null;
  classSociety: string | null;
  readinessScore: number | null;
  technicalProfile: TechnicalProfile | null;
  company: { name: string; code: string };
};

export default function SuperintendentVesselDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [vessel, setVessel] = useState<VesselDetail | null>(null);
  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/vessels",
    "edit",
    id,
    "/superintendent/vessels",
  );

  useEffect(() => {
    void fetch(`/api/superintendent/vessels/${id}`)
      .then((r) => r.json())
      .then((d) => setVessel(d.vessel ?? null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Loading vessel…</p>
      </PageShell>
    );
  }

  if (!vessel) {
    return (
      <PageShell>
        <p className="text-sm text-destructive">Vessel not found.</p>
      </PageShell>
    );
  }

  const profile = vessel.technicalProfile;

  return (
    <PageShell>
      <PageHeader
        title={vessel.name}
        description={`${vessel.code} · ${vessel.company.name}`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Vessel & technical profile</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const tp: Record<string, string | null> = {};
              for (const key of [
                "classNotation",
                "mainEngine",
                "auxiliaryEngine",
                "boilerInfo",
                "defectSummary",
                "pmsSummary",
                "sparesSummary",
                "notes",
              ]) {
                tp[key] = (form.get(key) as string) || null;
              }
              void submit({
                name: form.get("name") as string,
                imoNumber: (form.get("imoNumber") as string) || null,
                flag: (form.get("flag") as string) || null,
                vesselType: (form.get("vesselType") as string) || null,
                callSign: (form.get("callSign") as string) || null,
                grossTonnage: form.get("grossTonnage")
                  ? Number(form.get("grossTonnage"))
                  : null,
                yearBuilt: form.get("yearBuilt") ? Number(form.get("yearBuilt")) : null,
                nextDryDockDue: (form.get("nextDryDockDue") as string) || null,
                lastDryDockDate: (form.get("lastDryDockDate") as string) || null,
                classSociety: (form.get("classSociety") as string) || null,
                readinessScore: form.get("readinessScore")
                  ? Number(form.get("readinessScore"))
                  : null,
                technicalProfile: tp,
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" defaultValue={vessel.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imoNumber">IMO number</Label>
                <Input id="imoNumber" name="imoNumber" defaultValue={vessel.imoNumber ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="flag">Flag</Label>
                <Input id="flag" name="flag" defaultValue={vessel.flag ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vesselType">Vessel type</Label>
                <Input id="vesselType" name="vesselType" defaultValue={vessel.vesselType ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="callSign">Call sign</Label>
                <Input id="callSign" name="callSign" defaultValue={vessel.callSign ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grossTonnage">Gross tonnage</Label>
                <Input
                  id="grossTonnage"
                  name="grossTonnage"
                  type="number"
                  defaultValue={vessel.grossTonnage ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yearBuilt">Year built</Label>
                <Input
                  id="yearBuilt"
                  name="yearBuilt"
                  type="number"
                  defaultValue={vessel.yearBuilt ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="readinessScore">Readiness score (0–100)</Label>
                <Input
                  id="readinessScore"
                  name="readinessScore"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={vessel.readinessScore ?? ""}
                />
              </div>
              <DatePickerField
                id="nextDryDockDue"
                name="nextDryDockDue"
                label="Next dry dock due"
                defaultValue={toDateInput(vessel.nextDryDockDue)}
              />
              <DatePickerField
                id="lastDryDockDate"
                name="lastDryDockDate"
                label="Last dry dock"
                defaultValue={toDateInput(vessel.lastDryDockDate)}
              />
              <div className="space-y-2">
                <Label htmlFor="classSociety">Class society</Label>
                <Input
                  id="classSociety"
                  name="classSociety"
                  defaultValue={vessel.classSociety ?? ""}
                />
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-medium">Technical profile</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="classNotation">Class notation</Label>
                  <Input
                    id="classNotation"
                    name="classNotation"
                    defaultValue={profile?.classNotation ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mainEngine">Main engine</Label>
                  <Input id="mainEngine" name="mainEngine" defaultValue={profile?.mainEngine ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auxiliaryEngine">Auxiliary engine</Label>
                  <Input
                    id="auxiliaryEngine"
                    name="auxiliaryEngine"
                    defaultValue={profile?.auxiliaryEngine ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="boilerInfo">Boiler</Label>
                  <Input id="boilerInfo" name="boilerInfo" defaultValue={profile?.boilerInfo ?? ""} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="defectSummary">Defect summary</Label>
                <Textarea
                  id="defectSummary"
                  name="defectSummary"
                  rows={2}
                  defaultValue={profile?.defectSummary ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pmsSummary">PMS summary</Label>
                <Textarea
                  id="pmsSummary"
                  name="pmsSummary"
                  rows={2}
                  defaultValue={profile?.pmsSummary ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sparesSummary">Spares summary</Label>
                <Textarea
                  id="sparesSummary"
                  name="sparesSummary"
                  rows={2}
                  defaultValue={profile?.sparesSummary ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={2} defaultValue={profile?.notes ?? ""} />
              </div>
            </div>

            <EntityFormActions saving={saving} />
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
