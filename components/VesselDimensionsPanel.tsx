"use client";

import {
  HULL_FACTOR_LABELS,
  PAINT_CALCULATOR_DISCLAIMER,
  calculateHullAreas,
  type HullFactorType,
  type VesselParticulars,
} from "@/lib/hull/calculateAreas";
import {
  missingParticularFields,
  particularsComplete,
} from "@/lib/hull/extractVesselParticulars";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";

interface VesselDimensionsPanelProps {
  particulars: VesselParticulars;
  onChange: (p: VesselParticulars) => void;
  extractedFromSheet?: VesselParticulars;
}

const FIELDS: {
  key: keyof VesselParticulars;
  label: string;
  step?: string;
}[] = [
  { key: "loa", label: "LOA (m)" },
  { key: "lbp", label: "LBP (m)" },
  { key: "breadth", label: "Breadth (m)" },
  { key: "depth", label: "Depth (m)" },
  { key: "draught", label: "Draught (m)" },
  { key: "lll", label: "LLL — Light Load Line (m)", step: "0.01" },
  { key: "deadweight", label: "Deadweight (t)" },
];

export function VesselDimensionsPanel({
  particulars,
  onChange,
  extractedFromSheet,
}: VesselDimensionsPanelProps) {
  const calculated = particularsComplete(particulars)
    ? calculateHullAreas(particulars)
    : null;
  const missing = missingParticularFields(particulars);

  const setNum = (key: keyof VesselParticulars, raw: string) => {
    const val = raw === "" ? undefined : Number(raw);
    onChange({ ...particulars, [key]: val });
  };

  return (
    <Card className="border-rose-200 bg-rose-50/60 dark:bg-rose-950/20">
      <CardHeader>
        <CardTitle>Vessel dimensions — area estimation</CardTitle>
        <CardDescription>
          When m² is not in the quote, areas are estimated using the{" "}
          <a
            href="http://www.paint-consultants.com/index-option=com_wrapper&view=wrapper&Itemid=468.php.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            Paint Consultants
          </a>{" "}
          hull paint calculator (bulk carriers, tankers, Ro-Ro).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {extractedFromSheet?.source && (
          <Alert className="mb-4 border-emerald-200 bg-emerald-50 py-2">
            <AlertDescription className="text-xs text-emerald-700">
              Partially pre-filled from Excel ({extractedFromSheet.source}).
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FIELDS.map(({ key, label, step }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`vessel-${key}`}>{label}</Label>
              <Input
                id={`vessel-${key}`}
                type="number"
                step={step ?? "0.1"}
                min={0}
                value={particulars[key] ?? ""}
                onChange={(e) => setNum(key, e.target.value)}
                placeholder={String(
                  extractedFromSheet?.[key as keyof VesselParticulars] ?? "",
                )}
              />
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          <Label>Hull factor</Label>
          <RadioGroup
            value={particulars.hullFactorType ?? ""}
            onValueChange={(value) =>
              onChange({ ...particulars, hullFactorType: value as HullFactorType })
            }
            className="space-y-1"
          >
            {(Object.entries(HULL_FACTOR_LABELS) as [HullFactorType, string][]).map(
              ([id, label]) => (
                <div key={id} className="flex items-center gap-2">
                  <RadioGroupItem value={id} id={`hull-factor-${id}`} />
                  <Label htmlFor={`hull-factor-${id}`} className="cursor-pointer font-normal">
                    {label}
                  </Label>
                </div>
              ),
            )}
          </RadioGroup>
        </div>

        {missing.length > 0 && (
          <Alert className="mt-3 border-amber-200 bg-amber-50">
            <AlertDescription className="text-sm text-amber-800">
              Enter {missing.join(", ")} to calculate estimated hull areas.
            </AlertDescription>
          </Alert>
        )}

        {calculated && (
          <Alert className="mt-4 border-amber-200 bg-amber-50/80">
            <AlertDescription>
              <p className="text-sm font-semibold text-amber-950">
                Proposed areas (estimated) — paint costs use these when sheet has no m²
              </p>
              <Table className="mt-2 max-w-md">
                <TableBody>
                  <TableRow className="hover:bg-transparent">
                    <TableCell className="py-1 text-zinc-700">Topside</TableCell>
                    <TableCell className="py-1 font-medium">{calculated.topside} m²</TableCell>
                  </TableRow>
                  {calculated.boottop != null ? (
                    <>
                      <TableRow className="hover:bg-transparent">
                        <TableCell className="py-1 text-zinc-700">Boot Top</TableCell>
                        <TableCell className="py-1 font-medium">{calculated.boottop} m²</TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-transparent">
                        <TableCell className="py-1 text-zinc-700">Side Bottom</TableCell>
                        <TableCell className="py-1 font-medium">{calculated.sideBottom} m²</TableCell>
                      </TableRow>
                    </>
                  ) : (
                    <TableRow className="hover:bg-transparent">
                      <TableCell className="py-1 text-zinc-700">Side Bottom & Boottop</TableCell>
                      <TableCell className="py-1 font-medium">
                        {calculated.sideBottomAndBoottop} m²
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="hover:bg-transparent">
                    <TableCell className="py-1 text-zinc-700">Flat Bottom</TableCell>
                    <TableCell className="py-1 font-medium">{calculated.flatBottom} m²</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="mt-2 text-xs text-amber-900/80">
                Flat bottom uses hull factor {calculated.hullFactor}.{" "}
                {calculated.boottop == null &&
                  "Add LLL to split Boot Top from Side Bottom."}
              </p>
              <p className="mt-2 text-xs text-zinc-600">{PAINT_CALCULATOR_DISCLAIMER}</p>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
