"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JOB_REQUIREMENT_OPTIONS } from "@/lib/vessel/jobRequirements";
import { conditionRatingLabel } from "@/lib/vessel/machinery/parameters";
import { downloadVesselJobExcel } from "@/lib/shipAccess/vesselJobExcel";
import { notify } from "@/lib/notify";
import type { VesselJobPrintBundle } from "@/lib/db/superintendent/vesselJobs";

type Props = {
  bundle: VesselJobPrintBundle;
  autoPrint?: boolean;
};

const FORM_META = {
  issuedBy: "Technical / Dry Dock",
  approvedBy: "Fleet Superintendent",
} as const;

const YARD_WORK_ITEMS = [
  { key: "lighting_ventilation", label: "Lighting & Ventilation" },
  { key: "cleaning_before_after", label: "Cleaning Before / After" },
  { key: "crane", label: "Crane" },
  { key: "staging", label: "Staging" },
  { key: "hot_work", label: "Hot work related" },
  { key: "gas_free", label: "Gas Free" },
  { key: "transport", label: "Transport" },
  { key: "access", label: "Access" },
  { key: "pressure_function_testing", label: "Pressure / Function Testing" },
  { key: "ndt", label: "NDT" },
  { key: "corrosion_protection", label: "Corrosion Protection" },
  { key: "paint_work", label: "Paint Work" },
] as const;

const SUPPLY_ITEMS = [
  { key: "material", label: "Material" },
  { key: "yard_supply", label: "Yard Supply" },
  { key: "owner_supply", label: "Owner's Supply" },
  { key: "maker_supply", label: "Maker's Supply" },
  { key: "drawing", label: "Drawing" },
  { key: "sketch", label: "Sketch" },
  { key: "photograph", label: "Photograph" },
  { key: "sample", label: "Sample" },
] as const;

const INSPECTION_ITEMS = [
  { key: "classification_society", label: "Classification Society" },
  { key: "flag_administration", label: "Flag Administration" },
  { key: "owners", label: "Owners" },
  { key: "manufacturers", label: "Manufacturers" },
  { key: "underwriters", label: "Underwriters" },
] as const;

function blank(value: string | number | null | undefined): string {
  if (value == null || value === "") return "";
  return String(value);
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

function strField(fd: Record<string, unknown> | null | undefined, ...keys: string[]): string {
  if (!fd) return "";
  for (const key of keys) {
    const v = fd[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return "";
}

function hasMeaningfulText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function CheckboxRow({ label, checked }: { label: string; checked: boolean }) {
  return (
    <label className="dd03-check">
      <span className={`dd03-box${checked ? " is-checked" : ""}`} aria-hidden>
        {checked ? "✓" : ""}
      </span>
      <span>{label}</span>
    </label>
  );
}

function Cell({
  label,
  value,
  className = "",
  multiline = false,
}: {
  label: string;
  value: string;
  className?: string;
  multiline?: boolean;
}) {
  return (
    <div className={`dd03-cell ${className}`.trim()}>
      <span className="dd03-cell-label">{label}</span>
      <span className={`dd03-cell-value${multiline ? " is-multiline" : ""}`}>
        {value || "\u00A0"}
      </span>
    </div>
  );
}

export function VesselJobPrintDocument({ bundle, autoPrint = true }: Props) {
  const { vesselJob: job, vessel, company, dryDockProject } = bundle;
  const fd = (job.formData ?? {}) as Record<string, unknown>;
  const [excelBusy, setExcelBusy] = useState(false);

  const requirements = Array.isArray(fd.jobRequirements)
    ? (fd.jobRequirements as string[]).filter((k): k is string => typeof k === "string")
    : [];
  const reqSet = new Set(requirements);

  const maker =
    strField(fd, "machineryAssetMaker", "engineMake", "turbochargerMake", "paintMaker") ||
    strField(fd, "makeModel").split("/")[0]?.trim() ||
    "";

  const typeAndNo = [
    strField(fd, "machineryAssetModel", "engineModel", "turbochargerModel", "pumpType", "valveType", "type"),
    strField(fd, "machineryAssetSerialNumber", "engineCylinderNo", "generatorNo", "equipmentTag", "valveTag", "craneNameNo", "motorNameNo"),
    strField(fd, "makeModel"),
  ]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(" · ");

  const generalDescription = [
    job.title,
    [job.systemKey, job.machineryKey, job.componentKey].filter(Boolean).join(" / "),
    strField(fd, "machineryAssetName", "pumpName", "systemLine"),
  ]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join("\n");

  const jobDescriptionParts = [
    job.description,
    job.conditionDescription,
    job.observedDefect,
    job.repairRecommendation,
    strField(fd, "jobDescription", "scopeChecklist", "repairDetails", "defectDetails"),
  ].filter(hasMeaningfulText);

  // Deduplicate near-identical blocks
  const jobDescription = jobDescriptionParts
    .filter((part, idx, arr) => {
      const normalized = part!.trim().toLowerCase();
      return arr.findIndex((p) => p!.trim().toLowerCase() === normalized) === idx;
    })
    .join("\n\n");

  const measurements =
    job.measurements && typeof job.measurements === "object"
      ? Object.entries(job.measurements).filter(([, v]) => v != null && String(v).trim() !== "")
      : [];

  const location = [
    strField(fd, "location", "locationOnBoard", "areaLocation"),
    strField(fd, "systemLine"),
  ]
    .filter(Boolean)
    .join(" · ");

  const material = [
    strField(fd, "material", "pipeSize"),
    job.replacementParts,
    job.consumables,
  ]
    .filter(hasMeaningfulText)
    .join("\n");

  const accessNotes = [
    reqSet.has("confined_space") ? "Confined space access required" : "",
    reqSet.has("removal_fitting") ? "Removal & fitting / transport" : "",
    strField(fd, "accessNotes", "access"),
  ]
    .filter(Boolean)
    .join(" · ");

  const stagingNotes = [
    reqSet.has("staging") ? "Staging / scaffolding required" : "",
    strField(fd, "stagingNotes", "staging"),
  ]
    .filter(Boolean)
    .join(" · ");

  const specialRequirements = [
    ...JOB_REQUIREMENT_OPTIONS.filter((o) => reqSet.has(o.key)).map((o) => o.label),
    job.priority !== "medium" ? `Priority: ${job.priority}` : "",
    job.criticality ? `Criticality: ${job.criticality}` : "",
    job.operationalRisk ? `Operational risk: ${job.operationalRisk}` : "",
    job.safetyRisk ? `Safety risk: ${job.safetyRisk}` : "",
    job.environmentalRisk ? `Environmental risk: ${job.environmentalRisk}` : "",
  ]
    .filter(Boolean)
    .join("; ");

  const inspectionChecked: Record<(typeof INSPECTION_ITEMS)[number]["key"], boolean> = {
    classification_society: job.classAttendance || reqSet.has("class_attendance"),
    flag_administration: false,
    owners: Boolean(job.masterReviewAction === "approved" || job.approvedAt),
    manufacturers: job.makerAttendance || reqSet.has("maker_attendance"),
    underwriters: false,
  };

  const pressureTestPresent = Boolean(
    strField(
      fd,
      "pressureTesting",
      "pressureTest",
      "pressureFunctionTestAfterRepair",
      "performanceTest",
      "loadTest",
      "runTest",
      "loadTestDetails",
    ),
  );
  const paintPresent = Boolean(
    strField(fd, "paintSystem", "paintMaker", "paintApplicationRecord", "surfacePreparation"),
  );
  const ndtPresent = /ndt|ultrasonic|mpi|dye.?penetrant|radiograph/i.test(
    `${jobDescription} ${strField(fd, "inspectionReport", "inspectionTestReport", "inspectionResults")}`,
  );

  const yardChecked: Record<(typeof YARD_WORK_ITEMS)[number]["key"], boolean> = {
    lighting_ventilation: reqSet.has("lighting"),
    cleaning_before_after: /clean/i.test(strField(fd, "scopeChecklist", "jobDescription") || job.description || ""),
    crane: reqSet.has("crane_lifting"),
    staging: reqSet.has("staging"),
    hot_work: reqSet.has("hot_work"),
    gas_free: reqSet.has("gas_free"),
    transport: reqSet.has("removal_fitting"),
    access: reqSet.has("confined_space"),
    pressure_function_testing: pressureTestPresent,
    ndt: ndtPresent,
    corrosion_protection: paintPresent || /corrosion|coat|blast/i.test(jobDescription),
    paint_work: paintPresent,
  };

  const attachmentNames = (job.attachmentMeta ?? []).map((a) => a.fileName).filter(Boolean);
  const attachmentBlob = attachmentNames.join(" ").toLowerCase();

  const supplyChecked: Record<(typeof SUPPLY_ITEMS)[number]["key"], boolean> = {
    material: hasMeaningfulText(job.replacementParts) || hasMeaningfulText(job.consumables) || hasMeaningfulText(strField(fd, "material")),
    yard_supply: false,
    owner_supply: /owner.?suppl/i.test(`${job.replacementParts ?? ""} ${job.consumables ?? ""} ${JSON.stringify(fd)}`),
    maker_supply: job.makerAttendance || reqSet.has("maker_attendance"),
    drawing: /draw/.test(attachmentBlob) || Boolean(strField(fd, "drawing", "drawings")),
    sketch: /sketch/.test(attachmentBlob) || Boolean(strField(fd, "sketch")),
    photograph: job.photoCount > 0 || /photo|image|jpg|jpeg|png/.test(attachmentBlob),
    sample: /sample/.test(attachmentBlob) || Boolean(strField(fd, "sample")),
  };

  const formDate =
    fmtDate(job.submittedAt) ||
    fmtDate(job.exportAssignedAt) ||
    fmtDate(job.createdAt) ||
    new Date().toLocaleDateString();

  const additionalRows: { label: string; value: string }[] = [];
  if (job.conditionRating) {
    additionalRows.push({ label: "Condition rating", value: conditionRatingLabel(job.conditionRating) });
  }
  if (job.runningHoursAtSurvey != null) {
    additionalRows.push({ label: "Running hours at survey", value: String(job.runningHoursAtSurvey) });
  }
  if (job.lastOverhaulDate) {
    additionalRows.push({ label: "Last overhaul", value: fmtDate(job.lastOverhaulDate) });
  }
  if (job.estimatedManhours != null) {
    additionalRows.push({ label: "Estimated manhours", value: String(job.estimatedManhours) });
  }
  if (job.estimatedCost != null) {
    additionalRows.push({ label: "Estimated cost (USD)", value: job.estimatedCost.toLocaleString() });
  }
  if (dryDockProject?.name) {
    additionalRows.push({
      label: "Dry dock project",
      value: [dryDockProject.name, dryDockProject.referenceCode].filter(Boolean).join(" · "),
    });
  }
  for (const [key, value] of measurements) {
    additionalRows.push({ label: key, value: String(value) });
  }

  useEffect(() => {
    if (!autoPrint) return;
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, [autoPrint]);

  async function handleDownloadExcel() {
    setExcelBusy(true);
    try {
      const filename = await downloadVesselJobExcel(bundle);
      notify.success("Excel downloaded", { message: filename });
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Excel download failed");
    } finally {
      setExcelBusy(false);
    }
  }

  return (
    <div className="dd03-root mx-auto max-w-[210mm] bg-white px-4 py-6 text-zinc-900">
      <div className="dd03-toolbar mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-sm text-muted-foreground">Drydock Specification For Repair</p>
          <p className="font-mono text-sm font-semibold">{job.jobCode ?? "Assignment pending"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/ship-access/jobs" />} nativeButton={false}>
            Back to jobs
          </Button>
          <Button variant="outline" disabled={excelBusy} onClick={handleDownloadExcel}>
            <FileSpreadsheet className="size-4" />
            {excelBusy ? "Preparing…" : "Download Excel"}
          </Button>
          <Button onClick={() => window.print()}>Print / Save PDF</Button>
        </div>
      </div>

      <article className="dd03-sheet">
        {/* 1. Top header */}
        <header className="dd03-header">
          <div className="dd03-header-title dd03-header-title-wide">
            <h1>Drydock Specification For Repair</h1>
          </div>
          <div className="dd03-header-meta">
            <div>
              <span>Date</span>
              <strong>{formDate}</strong>
            </div>
            <div>
              <span>Issued by</span>
              <strong>{FORM_META.issuedBy}</strong>
            </div>
            <div>
              <span>Approved by</span>
              <strong>{FORM_META.approvedBy}</strong>
            </div>
          </div>
        </header>

        {/* 2. Company + Vessel */}
        <section className="dd03-row dd03-row-2">
          <div className="dd03-panel">
            <h2 className="dd03-panel-title">Company details</h2>
            <Cell label="Company" value={blank(company?.name)} />
            <Cell label="Code" value={blank(company?.code)} />
            <Cell label="Address" value={blank(company?.address)} multiline />
            <Cell label="Contact" value={blank(company?.contactPerson)} />
            <Cell label="Email" value={blank(company?.contactEmail)} />
            <Cell label="Phone" value={blank(company?.contactPhone)} />
          </div>
          <div className="dd03-panel">
            <h2 className="dd03-panel-title">Vessel details</h2>
            <Cell label="Vessel name" value={vessel.name} />
            <Cell label="Vessel code" value={vessel.code} />
            <Cell label="IMO number" value={blank(vessel.imoNumber)} />
            <Cell label="Flag" value={blank(vessel.flag)} />
            <Cell label="Type" value={blank(vessel.vesselType)} />
            <Cell label="Gross tonnage" value={blank(vessel.grossTonnage)} />
            <Cell label="Year built" value={blank(vessel.yearBuilt)} />
            <Cell label="Class society" value={blank(vessel.classSociety)} />
          </div>
        </section>

        {/* 3. Identification bar */}
        <section className="dd03-id-bar">
          <Cell label="JOB No." value={blank(job.jobCode)} />
          <Cell label="Project Ref." value={blank(dryDockProject?.referenceCode)} />
          <Cell
            label="Yard"
            value={blank(dryDockProject?.selectedYard) || blank(dryDockProject?.portLocation)}
          />
          <Cell label="Workshop / Dept." value={[job.workshop, job.department ?? job.category].filter(Boolean).join(" · ")} />
          <Cell label="Page No." value="1" />
          <Cell label="Date" value={formDate} />
        </section>

        {/* 4. General description + Inspection */}
        <section className="dd03-row dd03-row-split">
          <div className="dd03-panel dd03-panel-main">
            <h2 className="dd03-panel-title">General description · Maker · Type &amp; No.</h2>
            <Cell label="General description" value={generalDescription} multiline />
            <Cell label="Maker" value={maker} />
            <Cell label="Type & No." value={typeAndNo} />
          </div>
          <div className="dd03-panel dd03-panel-side">
            <h2 className="dd03-panel-title">Inspection / Surveys</h2>
            <div className="dd03-check-list">
              {INSPECTION_ITEMS.map((item) => (
                <CheckboxRow key={item.key} label={item.label} checked={inspectionChecked[item.key]} />
              ))}
            </div>
          </div>
        </section>

        {/* 5. Actual job description + Yard work */}
        <section className="dd03-row dd03-row-split dd03-row-tall">
          <div className="dd03-panel dd03-panel-main">
            <h2 className="dd03-panel-title">Actual Job description</h2>
            <div className="dd03-prose">{jobDescription || "\u00A0"}</div>
          </div>
          <div className="dd03-panel dd03-panel-side">
            <h2 className="dd03-panel-title">Yard Work</h2>
            <div className="dd03-check-list">
              {YARD_WORK_ITEMS.map((item) => (
                <CheckboxRow key={item.key} label={item.label} checked={yardChecked[item.key]} />
              ))}
            </div>
          </div>
        </section>

        {/* 6. Location / material / access + Supply */}
        <section className="dd03-row dd03-row-split">
          <div className="dd03-panel dd03-panel-main">
            <h2 className="dd03-panel-title">Location · Material · Access · Staging · Special requirements</h2>
            <Cell label="Location" value={location} multiline />
            <Cell label="Material" value={material} multiline />
            <Cell label="Access" value={accessNotes} multiline />
            <Cell label="Staging" value={stagingNotes} multiline />
            <Cell label="Special requirements" value={specialRequirements} multiline />
          </div>
          <div className="dd03-panel dd03-panel-side">
            <h2 className="dd03-panel-title">Supply</h2>
            <div className="dd03-check-list">
              {SUPPLY_ITEMS.map((item) => (
                <CheckboxRow key={item.key} label={item.label} checked={supplyChecked[item.key]} />
              ))}
            </div>
          </div>
        </section>

        {/* Extra app fields — once only */}
        {additionalRows.length > 0 ? (
          <section className="dd03-panel">
            <h2 className="dd03-panel-title">Additional details</h2>
            <div className="dd03-extra-grid">
              {additionalRows.map((row) => (
                <Cell key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          </section>
        ) : null}

        {/* 7. Footer */}
        <footer className="dd03-footer">
          <div className="dd03-sign">
            <span className="dd03-sign-label">Prepared by</span>
            <span className="dd03-sign-line">{blank(job.createdByName)}</span>
            <span className="dd03-sign-sub">Name / Rank</span>
          </div>
          <div className="dd03-sign">
            <span className="dd03-sign-label">Approved by Supdt.</span>
            <span className="dd03-sign-line">{blank(job.approvedByName)}</span>
            <span className="dd03-sign-sub">Name</span>
          </div>
          <div className="dd03-sign">
            <span className="dd03-sign-label">Signature &amp; date</span>
            <span className="dd03-sign-line">{fmtDate(job.approvedAt)}</span>
            <span className="dd03-sign-sub">Signature / Date</span>
          </div>
        </footer>
      </article>

      <style>{`
        .dd03-sheet {
          border: 2px solid #18181b;
          background: #fff;
          color: #18181b;
          font-size: 11px;
          line-height: 1.35;
        }
        .dd03-header {
          display: grid;
          grid-template-columns: 1fr 9.5rem;
          border-bottom: 2px solid #18181b;
          min-height: 4.5rem;
        }
        .dd03-header-title,
        .dd03-header-title-wide {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem 0.75rem;
          border-right: 2px solid #18181b;
          text-align: center;
        }
        .dd03-header-title h1 {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 800;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        .dd03-header-meta {
          display: grid;
          grid-template-rows: repeat(3, minmax(0, 1fr));
          font-size: 9px;
        }
        .dd03-header-meta > div {
          display: grid;
          grid-template-columns: 4.2rem 1fr;
          border-bottom: 1px solid #a1a1aa;
          padding: 0.15rem 0.35rem;
          gap: 0.25rem;
          align-items: center;
        }
        .dd03-header-meta > div:last-child {
          border-bottom: 0;
        }
        .dd03-header-meta span {
          color: #52525b;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .dd03-header-meta strong {
          font-weight: 600;
          font-size: 10px;
        }
        .dd03-row {
          display: grid;
          border-bottom: 2px solid #18181b;
        }
        .dd03-row-2 {
          grid-template-columns: 1fr 1fr;
        }
        .dd03-row-split {
          grid-template-columns: minmax(0, 1.55fr) minmax(9.5rem, 0.7fr);
        }
        .dd03-row-tall .dd03-prose {
          min-height: 9rem;
        }
        .dd03-row-2 > .dd03-panel + .dd03-panel,
        .dd03-row-split > .dd03-panel + .dd03-panel {
          border-left: 2px solid #18181b;
        }
        .dd03-panel {
          min-width: 0;
        }
        .dd03-panel-title {
          margin: 0;
          padding: 0.28rem 0.45rem;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          background: #e4e4e7;
          border-bottom: 1px solid #18181b;
        }
        .dd03-cell {
          display: grid;
          grid-template-columns: 7.25rem 1fr;
          border-bottom: 1px solid #d4d4d8;
          min-height: 1.35rem;
        }
        .dd03-cell:last-child {
          border-bottom: 0;
        }
        .dd03-cell-label {
          padding: 0.28rem 0.4rem;
          font-size: 9px;
          font-weight: 700;
          color: #3f3f46;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          border-right: 1px solid #d4d4d8;
          background: #fafafa;
        }
        .dd03-cell-value {
          padding: 0.28rem 0.45rem;
          font-size: 11px;
          font-weight: 500;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .dd03-cell-value.is-multiline {
          min-height: 2.2rem;
        }
        .dd03-id-bar {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          border-bottom: 2px solid #18181b;
        }
        .dd03-id-bar .dd03-cell {
          grid-template-columns: 1fr;
          border-bottom: 0;
          border-right: 1px solid #18181b;
        }
        .dd03-id-bar .dd03-cell:last-child {
          border-right: 0;
        }
        .dd03-id-bar .dd03-cell-label {
          border-right: 0;
          border-bottom: 1px solid #a1a1aa;
          text-align: center;
        }
        .dd03-id-bar .dd03-cell-value {
          text-align: center;
          font-weight: 700;
          min-height: 1.6rem;
        }
        .dd03-prose {
          padding: 0.5rem 0.55rem;
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 11px;
          line-height: 1.45;
        }
        .dd03-check-list {
          display: grid;
          gap: 0.28rem;
          padding: 0.45rem 0.5rem 0.55rem;
        }
        .dd03-check {
          display: grid;
          grid-template-columns: 0.95rem 1fr;
          gap: 0.4rem;
          align-items: start;
          font-size: 10px;
          font-weight: 500;
        }
        .dd03-box {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 0.9rem;
          height: 0.9rem;
          margin-top: 0.05rem;
          border: 1.5px solid #18181b;
          font-size: 9px;
          font-weight: 800;
          line-height: 1;
          background: #fff;
        }
        .dd03-box.is-checked {
          background: #f4f4f5;
        }
        .dd03-extra-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
        .dd03-extra-grid .dd03-cell {
          border-right: 1px solid #d4d4d8;
        }
        .dd03-extra-grid .dd03-cell:nth-child(2n) {
          border-right: 0;
        }
        .dd03-footer {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          min-height: 4.75rem;
        }
        .dd03-sign {
          display: grid;
          grid-template-rows: auto 1fr auto;
          gap: 0.35rem;
          padding: 0.45rem 0.55rem 0.4rem;
          border-right: 2px solid #18181b;
        }
        .dd03-sign:last-child {
          border-right: 0;
        }
        .dd03-sign-label {
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #3f3f46;
        }
        .dd03-sign-line {
          border-bottom: 1px solid #52525b;
          min-height: 1.6rem;
          font-size: 11px;
          font-weight: 600;
          padding-top: 0.85rem;
        }
        .dd03-sign-sub {
          font-size: 8px;
          color: #71717a;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        @media print {
          @page {
            size: A4;
            margin: 8mm;
          }
          html,
          body {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }
          .dd03-toolbar,
          header:not(.dd03-header),
          nav,
          footer:not(.dd03-footer),
          [data-slot="sidebar"],
          .ship-access-scope-bar,
          .dd-module-sidebar,
          .dd-sub-bar {
            display: none !important;
          }
          .dd03-root {
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }
          .dd03-sheet {
            break-inside: auto;
          }
          .dd03-row,
          .dd03-panel,
          .dd03-footer {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }

        @media (max-width: 720px) {
          .dd03-header,
          .dd03-row-2,
          .dd03-row-split,
          .dd03-id-bar,
          .dd03-footer,
          .dd03-extra-grid {
            grid-template-columns: 1fr;
          }
          .dd03-header-title,
          .dd03-header-title-wide,
          .dd03-row-2 > .dd03-panel + .dd03-panel,
          .dd03-row-split > .dd03-panel + .dd03-panel,
          .dd03-id-bar .dd03-cell,
          .dd03-sign {
            border-right: 0;
            border-bottom: 1px solid #18181b;
          }
        }
      `}</style>
    </div>
  );
}
