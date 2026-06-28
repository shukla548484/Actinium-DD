"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type VesselContext = {
  name: string;
  code: string;
  imoNumber: string | null;
  vesselType: string | null;
  classSociety: string | null;
  company: { name: string; code: string } | null;
};

type Props = {
  vesselId: string;
  onClassSociety?: (value: string) => void;
};

export function VesselContextFields({ vesselId, onClassSociety }: Props) {
  const [vessel, setVessel] = useState<VesselContext | null>(null);

  useEffect(() => {
    if (!vesselId) {
      setVessel(null);
      return;
    }
    void fetch(`/api/superintendent/vessels/${vesselId}`)
      .then((r) => r.json())
      .then((d) => {
        const v = d.vessel as VesselContext | undefined;
        if (v) {
          setVessel(v);
          if (v.classSociety && onClassSociety) onClassSociety(v.classSociety);
        }
      });
  }, [vesselId, onClassSociety]);

  if (!vesselId) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>Company</Label>
        <Input value={vessel?.company?.name ?? "Loading…"} disabled readOnly />
      </div>
      <div className="space-y-2">
        <Label>IMO</Label>
        <Input value={vessel?.imoNumber ?? "—"} disabled readOnly className="font-mono" />
      </div>
      <div className="space-y-2">
        <Label>Vessel type</Label>
        <Input value={vessel?.vesselType ?? "—"} disabled readOnly />
      </div>
      <div className="space-y-2">
        <Label>Class society (from vessel)</Label>
        <Input value={vessel?.classSociety ?? "—"} disabled readOnly />
      </div>
    </div>
  );
}
