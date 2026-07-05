"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

type VesselOption = {
  id: string;
  code: string;
  name: string;
  companyName?: string;
};

export function VesselSelectPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const [vesselId, setVesselId] = useState("");

  useEffect(() => {
    void fetch("/api/admin/vessels?limit=100&status=active")
      .then((res) => res.json())
      .then((data) => {
        setVessels(
          (data.vessels ?? []).map((v: VesselOption & { companyName?: string }) => ({
            id: v.id,
            code: v.code,
            name: v.name,
            companyName: v.companyName,
          })),
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const vesselItems = useMemo(
    () =>
      vessels.map((v) => ({
        value: v.id,
        label: `${v.name} (${v.code})`,
        searchText: `${v.name} ${v.code} ${v.companyName ?? ""}`,
      })),
    [vessels],
  );

  function handleContinue() {
    if (!vesselId) return;
    router.push(`/admin/crew-credentials/${vesselId}`);
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">Select vessel</CardTitle>
        <CardDescription>
          Crew credentials are created per vessel. Choose the vessel first, then register onboard
          crew using the standard designation list.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Vessel</Label>
          <SearchableSelect
            items={vesselItems}
            value={vesselId}
            onValueChange={setVesselId}
            placeholder={loading ? "Loading vessels…" : "Search by name or code"}
            disabled={loading || vessels.length === 0}
          />
        </div>

        {!loading && vessels.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active vessels found. Register a vessel first under Admin → Vessels.
          </p>
        ) : null}

        <Button type="button" disabled={!vesselId} onClick={handleContinue}>
          Continue to crew credentials
        </Button>
      </CardContent>
    </Card>
  );
}
