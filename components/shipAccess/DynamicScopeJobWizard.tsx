"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckIcon, ListPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableMultiSelect } from "@/components/ui/SearchableMultiSelect";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationBar } from "@/components/superintendent/PaginationBar";
import { JOB_PRIORITY_ITEMS } from "@/lib/superintendent/constants";
import type {
  JobInputFieldDef,
  JobLibraryNodeDto,
  JobLibraryNodeType,
} from "@/lib/vessel/jobLibrary/catalog";
import { CONDITION_RATING_ITEMS } from "@/lib/vessel/machinery/parameters";
import { uploadPendingVesselJobFiles } from "@/components/shipAccess/VesselJobAttachmentsPanel";
import type { DdVesselJobDto } from "@/lib/superintendent/types";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import type { MachineryAssetDto } from "@/lib/db/vesselMachineryAssets";
import { JOB_REQUIREMENT_OPTIONS } from "@/lib/vessel/jobRequirements";
import { cn } from "@/lib/utils";

export type DefectJobPrefill = {
  id: string;
  title: string;
  description: string | null;
  equipmentLabel: string | null;
  priority: string;
};

type Props = {
  vesselId: string;
  vesselName?: string | null;
  vesselCode?: string | null;
  dryDockProjectId?: string | null;
  dryDockProjectName?: string | null;
  dryDockProjectReference?: string | null;
  linkedDefectId?: string | null;
  defectPrefill?: DefectJobPrefill | null;
  createdByName?: string;
  onSaved?: () => void;
  jobsApiBase?: string;
  jobLibraryApiBase?: string;
};

type Accent = "rose" | "orange" | "yellow" | "black";

type JobScopeMeta = {
  machineryKey: string | null;
  componentKey: string | null;
  machineryName: string | null;
  componentName: string | null;
};

const NODE_TYPE_LABELS: Record<JobLibraryNodeType, string> = {
  department: "Department",
  category: "Category",
  system: "System",
  machinery: "Machinery",
  component: "Component",
  standard_job: "Standard job",
};

const ACCENT_CARD: Record<Accent, string> = {
  rose: "dd-card-rose border-dd-rose-border",
  orange: "dd-card-orange border-dd-orange-border",
  yellow: "dd-card-yellow border-dd-yellow-border",
  black: "dd-card-black border-dd-black-soft/20",
};

const ACCENT_BADGE: Record<Accent, string> = {
  rose: "bg-dd-rose text-white",
  orange: "bg-dd-orange-bright text-white",
  yellow: "bg-dd-yellow-bright text-dd-black",
  black: "bg-dd-black text-white",
};

const ACCENT_TITLE: Record<Accent, string> = {
  rose: "text-dd-rose",
  orange: "text-dd-orange",
  yellow: "text-dd-yellow",
  black: "text-dd-black",
};

const MEASUREMENT_KEYS = new Set([
  "runningHours",
  "lastOverhaul",
  "measurements",
  "clearance",
  "wear",
  "thickness",
  "pressure",
  "temperature",
]);

function SectionCard({
  accent,
  title,
  description,
  badge,
  children,
  className,
}: {
  accent: Accent;
  title: string;
  description?: string;
  badge?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn(ACCENT_CARD[accent], "shadow-sm", className)}>
      <CardHeader className="border-b border-black/5 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {badge ? (
            <span
              className={cn(
                "inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                ACCENT_BADGE[accent],
              )}
            >
              {badge}
            </span>
          ) : null}
          <CardTitle className={cn("text-base", ACCENT_TITLE[accent])}>{title}</CardTitle>
        </div>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4 pt-4">{children}</CardContent>
    </Card>
  );
}

function levelLabel(options: JobLibraryNodeDto[], selected?: JobLibraryNodeDto | null): string {
  const type = selected?.nodeType ?? options[0]?.nodeType;
  if (!type) return "Select";
  return NODE_TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

function isHomogeneousLevel(
  options: JobLibraryNodeDto[],
  nodeType: JobLibraryNodeType,
): boolean {
  return options.length > 0 && options.every((node) => node.nodeType === nodeType);
}

function defaultConditionDescription(node: JobLibraryNodeDto): string {
  const description = node.description?.trim();
  if (description) return description;
  return `Inspect and record present condition for: ${node.name}.`;
}

function defaultRepairRecommendation(node: JobLibraryNodeDto): string {
  const description = node.description?.trim();
  if (description) {
    return `Carry out: ${node.name}.\n\n${description}`;
  }
  return `Carry out ${node.name} as per maker instructions and applicable class / maker requirements.`;
}

const STANDARD_JOBS_PAGE_SIZE = 15;

function StandardJobsPickerTable({
  jobs,
  plannedIds,
  componentLabel,
  onAdd,
  onRemove,
  onAddAll,
}: {
  jobs: JobLibraryNodeDto[];
  plannedIds: string[];
  componentLabel: (node: JobLibraryNodeDto) => string;
  onAdd: (node: JobLibraryNodeDto) => void;
  onRemove: (node: JobLibraryNodeDto) => void;
  onAddAll: () => void;
}) {
  const [page, setPage] = useState(1);
  const plannedSet = useMemo(() => new Set(plannedIds), [plannedIds]);
  const unplannedCount = useMemo(
    () => jobs.filter((job) => !plannedSet.has(job.id)).length,
    [jobs, plannedSet],
  );

  useEffect(() => {
    setPage(1);
  }, [jobs]);

  const totalPages = Math.max(1, Math.ceil(jobs.length / STANDARD_JOBS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = jobs.slice(
    (safePage - 1) * STANDARD_JOBS_PAGE_SIZE,
    safePage * STANDARD_JOBS_PAGE_SIZE,
  );

  if (jobs.length === 0) return null;

  return (
    <div className="space-y-3 sm:col-span-2 lg:col-span-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <Label>Standard jobs</Label>
          <p className="text-xs text-muted-foreground">
            Review the library jobs, then add the ones you need to the planned job list.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">
            Showing {pageRows.length} of {jobs.length}
            {plannedIds.length > 0 ? ` · ${plannedIds.length} planned` : ""}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={unplannedCount === 0}
            onClick={onAddAll}
          >
            <ListPlus className="size-3.5" />
            {unplannedCount === 0
              ? "All jobs planned"
              : `Add all (${unplannedCount})`}
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-dd-rose-border bg-white/90">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[12rem] whitespace-nowrap">Component</TableHead>
              <TableHead className="w-[14rem] whitespace-nowrap">Job Heading</TableHead>
              <TableHead className="min-w-[18rem]">Job description</TableHead>
              <TableHead className="w-[9.5rem] text-right whitespace-nowrap">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((node) => {
              const planned = plannedSet.has(node.id);
              const description =
                node.description?.trim() ||
                `Carry out ${node.name} as per maker instructions and applicable class / maker requirements.`;
              return (
                <TableRow key={node.id} data-planned={planned || undefined}>
                  <TableCell className="align-top text-sm text-muted-foreground">
                    {componentLabel(node)}
                  </TableCell>
                  <TableCell className="align-top">
                    <p className="font-medium text-foreground">{node.name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {node.referenceCode ?? node.code}
                      {node.estimatedManhours != null ? ` · ${node.estimatedManhours} mh` : ""}
                    </p>
                  </TableCell>
                  <TableCell className="align-top">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                      {description}
                    </p>
                  </TableCell>
                  <TableCell className="align-top text-right">
                    {planned ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                        onClick={() => onRemove(node)}
                      >
                        <CheckIcon className="size-3.5" />
                        Planned
                      </Button>
                    ) : (
                      <Button type="button" size="sm" onClick={() => onAdd(node)}>
                        <ListPlus className="size-3.5" />
                        Add
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <PaginationBar
        page={safePage}
        totalPages={totalPages}
        total={jobs.length}
        onPageChange={setPage}
      />
    </div>
  );
}

export function DynamicScopeJobWizard({
  vesselId,
  vesselName,
  vesselCode,
  dryDockProjectId,
  dryDockProjectName,
  dryDockProjectReference,
  linkedDefectId,
  defectPrefill,
  createdByName = "",
  onSaved,
  jobsApiBase = "/api/ship-access/jobs",
  jobLibraryApiBase = "/api/ship-access/job-library",
}: Props) {
  const [path, setPath] = useState<JobLibraryNodeDto[]>([]);
  const [levelOptions, setLevelOptions] = useState<JobLibraryNodeDto[][]>([]);
  const [loadingLevel, setLoadingLevel] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [priority, setPriority] = useState("medium");
  const [conditionRating, setConditionRating] = useState("monitor");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [resolvedTemplate, setResolvedTemplate] = useState<JobInputFieldDef[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [machineryAssets, setMachineryAssets] = useState<MachineryAssetDto[]>([]);
  const [machineryLoading, setMachineryLoading] = useState(true);
  const [selectedMachineryAssetId, setSelectedMachineryAssetId] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<JobLibraryNodeDto[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [selectedMachineryIds, setSelectedMachineryIds] = useState<string[]>([]);
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [componentOptions, setComponentOptions] = useState<JobLibraryNodeDto[]>([]);
  const [aggregatedStandardJobs, setAggregatedStandardJobs] = useState<JobLibraryNodeDto[]>([]);
  const [jobScopeById, setJobScopeById] = useState<Record<string, JobScopeMeta>>({});
  const [branchLoading, setBranchLoading] = useState(false);
  const [collaborateMode, setCollaborateMode] = useState(false);
  const [jobRequirements, setJobRequirements] = useState<string[]>([]);
  const [userEditedKeys, setUserEditedKeys] = useState<Set<string>>(() => new Set());
  const descriptionSeededRef = useRef(false);

  const machineryLevelIndex = levelOptions.findIndex((options) =>
    isHomogeneousLevel(options, "machinery"),
  );
  const machineryOptions = useMemo(
    () => (machineryLevelIndex >= 0 ? (levelOptions[machineryLevelIndex] ?? []) : []),
    [levelOptions, machineryLevelIndex],
  );
  const hasMachineryMultiSelect = machineryLevelIndex >= 0;

  const ancestorPath = useMemo(() => {
    if (hasMachineryMultiSelect && machineryLevelIndex >= 0) {
      return path.slice(0, machineryLevelIndex);
    }
    return path.filter((node) => node.nodeType !== "standard_job");
  }, [hasMachineryMultiSelect, machineryLevelIndex, path]);

  const selectedMachineryNodes = useMemo(
    () => machineryOptions.filter((node) => selectedMachineryIds.includes(node.id)),
    [machineryOptions, selectedMachineryIds],
  );
  const selectedComponentNodes = useMemo(
    () => componentOptions.filter((node) => selectedComponentIds.includes(node.id)),
    [componentOptions, selectedComponentIds],
  );

  const multiBranchSelection =
    selectedMachineryIds.length > 1 || selectedComponentIds.length > 1;
  const effectiveCollaborate =
    collaborateMode || multiBranchSelection || selectedJobIds.length >= 2;

  const primarySelectedJob =
    selectedJobIds.length > 0
      ? (aggregatedStandardJobs.find((node) => node.id === selectedJobIds[0]) ??
        path.find((node) => node.id === selectedJobIds[0] && node.nodeType === "standard_job") ??
        null)
      : (path.find((node) => node.nodeType === "standard_job") ?? null);

  const activeScopeJob = primarySelectedJob;
  const formReady = Boolean(activeScopeJob) && selectedJobIds.length >= 1;
  const packageMode = effectiveCollaborate && selectedJobIds.length >= 2;

  const template = useMemo(
    () => (resolvedTemplate.length > 0 ? resolvedTemplate : (activeScopeJob?.inputTemplate ?? [])),
    [activeScopeJob?.inputTemplate, resolvedTemplate],
  );
  const selectedMachineryAsset =
    machineryAssets.find((asset) => asset.id === selectedMachineryAssetId) ?? null;

  const {
    defectFields,
    measurementFields,
    repairFields,
    riskFields,
    approvalFields,
    attachmentFields,
    otherFields,
  } =
    useMemo(() => {
      /** Templates can inject the same key more than once (e.g. photosNote). Keep first. */
      function uniqueByKey(fields: JobInputFieldDef[]): JobInputFieldDef[] {
        const seen = new Set<string>();
        const out: JobInputFieldDef[] = [];
        for (const field of fields) {
          if (seen.has(field.key)) continue;
          seen.add(field.key);
          out.push(field);
        }
        return out;
      }

      const uniqueTemplate = uniqueByKey(template);
      const condition = uniqueTemplate.filter((f) => f.section === "condition");
      const attachmentFields = uniqueTemplate.filter((f) => f.type === "photos_note");
      const defectFields = condition.filter(
        (f) =>
          f.type !== "photos_note" &&
          !MEASUREMENT_KEYS.has(f.key) &&
          f.type !== "number" &&
          f.type !== "date" &&
          f.type !== "measurement",
      );
      const measurementFields = condition.filter(
        (f) =>
          MEASUREMENT_KEYS.has(f.key) ||
          f.type === "number" ||
          f.type === "date" ||
          f.type === "measurement",
      );
      return {
        defectFields,
        measurementFields,
        repairFields: uniqueTemplate.filter((f) => f.section === "repair"),
        riskFields: uniqueTemplate.filter((f) => f.section === "risk"),
        approvalFields: uniqueTemplate.filter((f) => f.section === "approval"),
        attachmentFields,
        otherFields: uniqueTemplate.filter(
          (f) =>
            f.type !== "photos_note" &&
            (!f.section || !["condition", "repair", "risk", "approval"].includes(f.section)),
        ),
      };
    }, [template]);

  useEffect(() => {
    if (!defectPrefill) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setFormValues((prev) => ({
        ...prev,
        conditionDescription:
          prev.conditionDescription ||
          [defectPrefill.title, defectPrefill.description].filter(Boolean).join("\n\n"),
        observedDefect:
          prev.observedDefect || defectPrefill.equipmentLabel || defectPrefill.title,
        repairRecommendation:
          prev.repairRecommendation ||
          `Scope repair linked to Master-approved defect: ${defectPrefill.title}`,
      }));
      if (defectPrefill.priority) setPriority(defectPrefill.priority);
    });
    return () => {
      cancelled = true;
    };
  }, [defectPrefill]);

  const fetchChildren = useCallback(
    async (parentId: string | null) => {
      const qs = new URLSearchParams();
      if (parentId) qs.set("parentId", parentId);
      else {
        if (dryDockProjectId) qs.set("dryDockProjectId", dryDockProjectId);
        qs.set("vesselId", vesselId);
      }
      const query = qs.toString();
      const res = await fetch(`${jobLibraryApiBase}${query ? `?${query}` : ""}`);
      const data = (await res.json()) as { nodes?: JobLibraryNodeDto[] };
      return data.nodes ?? [];
    },
    [dryDockProjectId, vesselId, jobLibraryApiBase],
  );

  const markUserEdited = useCallback((key: string) => {
    setUserEditedKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const applyLibraryDescriptionDefaults = useCallback(
    (node: JobLibraryNodeDto, forceEmptyOnly: boolean) => {
      setFormValues((prev) => {
        const next = { ...prev };
        const fill = (key: string, value: string) => {
          if (userEditedKeys.has(key)) return;
          const current = next[key]?.trim() ?? "";
          if (forceEmptyOnly && current) return;
          if (!forceEmptyOnly && descriptionSeededRef.current && current) return;
          next[key] = value;
        };

        fill("conditionDescription", defaultConditionDescription(node));
        fill("observedDefect", node.name);
        fill("repairRecommendation", defaultRepairRecommendation(node));
        if (node.estimatedManhours != null && !userEditedKeys.has("estimatedManhours")) {
          if (!forceEmptyOnly || !next.estimatedManhours?.trim()) {
            next.estimatedManhours = String(node.estimatedManhours);
          }
        }
        return next;
      });
      descriptionSeededRef.current = true;
    },
    [userEditedKeys],
  );

  const loadTemplateForJob = useCallback(
    (node: JobLibraryNodeDto, options?: { seedDescriptions?: boolean; emptyOnly?: boolean }) => {
      setPriority(node.defaultPriority ?? "medium");
      setResolvedTemplate([]);
      setTemplateLoading(true);
      void fetch(`${jobLibraryApiBase}/${node.id}`)
        .then((r) => r.json())
        .then((data: { node?: JobLibraryNodeDto }) => {
          const resolved = data.node ?? node;
          setResolvedTemplate(resolved.inputTemplate ?? node.inputTemplate ?? []);
          if (options?.seedDescriptions !== false) {
            applyLibraryDescriptionDefaults(resolved, options?.emptyOnly === true);
          }
        })
        .catch(() => {
          setResolvedTemplate(node.inputTemplate ?? []);
          if (options?.seedDescriptions !== false) {
            applyLibraryDescriptionDefaults(node, options?.emptyOnly === true);
          }
        })
        .finally(() => setTemplateLoading(false));
    },
    [applyLibraryDescriptionDefaults, jobLibraryApiBase],
  );

  const resetBranchSelection = useCallback(() => {
    setSelectedMachineryIds([]);
    setSelectedComponentIds([]);
    setSelectedJobIds([]);
    setComponentOptions([]);
    setAggregatedStandardJobs([]);
    setJobScopeById({});
    setCollaborateMode(false);
    setBranchLoading(false);
  }, []);

  const resetSelection = useCallback(async () => {
    setPath([]);
    setResolvedTemplate([]);
    setSelectedMachineryAssetId("");
    setFormValues({});
    setPendingPhotos([]);
    setSearchQuery("");
    setSearchResults([]);
    setJobRequirements([]);
    setUserEditedKeys(new Set());
    descriptionSeededRef.current = false;
    resetBranchSelection();
    setLoadingLevel(true);
    const roots = await fetchChildren(null);
    setLevelOptions([roots]);
    setLoadingLevel(false);
  }, [fetchChildren, resetBranchSelection]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void resetSelection();
    });
    return () => {
      cancelled = true;
    };
  }, [resetSelection]);

  useEffect(() => {
    const qs = new URLSearchParams({ vesselId });
    void fetch(`/api/ship-access/machinery/assets?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { assets?: MachineryAssetDto[] } | null) => {
        setMachineryAssets(data?.assets ?? []);
      })
      .finally(() => setMachineryLoading(false));
  }, [vesselId]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      queueMicrotask(() => {
        setSearchResults([]);
        setSearchLoading(false);
      });
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setSearchLoading(true);
    });
    const handle = window.setTimeout(() => {
      void fetch(`${jobLibraryApiBase}?search=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data: { nodes?: JobLibraryNodeDto[] }) => {
          if (!cancelled) setSearchResults(data.nodes ?? []);
        })
        .catch(() => {
          if (!cancelled) setSearchResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [searchQuery, jobLibraryApiBase]);

  useEffect(() => {
    if (selectedMachineryIds.length > 1) {
      queueMicrotask(() => setCollaborateMode(true));
    }
  }, [selectedMachineryIds.length]);

  async function selectAtLevel(levelIndex: number, nodeId: string) {
    const options = levelOptions[levelIndex] ?? [];
    const node = options.find((n) => n.id === nodeId);
    if (!node) return;

    // Machinery / component / job levels use dedicated multi-select handlers.
    if (node.nodeType === "machinery" || node.nodeType === "component") {
      return;
    }

    const nextPath = [...path.slice(0, levelIndex), node];
    setPath(nextPath);
    setError(null);
    setSearchQuery("");
    setSearchResults([]);
    resetBranchSelection();
    descriptionSeededRef.current = false;

    if (node.nodeType === "standard_job") {
      setSelectedJobIds([node.id]);
      setAggregatedStandardJobs([node]);
      setLevelOptions((prev) => prev.slice(0, levelIndex + 1));
      loadTemplateForJob(node, { emptyOnly: false });
      return;
    }

    setResolvedTemplate([]);
    setLoadingLevel(true);
    const children = await fetchChildren(node.id);
    setLevelOptions((prev) => {
      const base = prev.slice(0, levelIndex + 1);
      return children.length > 0 ? [...base, children] : base;
    });
    setLoadingLevel(false);
  }

  async function applyMachinerySelection(nextIds: string[]) {
    setSelectedMachineryIds(nextIds);
    setSelectedComponentIds([]);
    setSelectedJobIds([]);
    setComponentOptions([]);
    setAggregatedStandardJobs([]);
    setJobScopeById({});
    setResolvedTemplate([]);
    setError(null);

    if (nextIds.length === 0) {
      setBranchLoading(false);
      return;
    }

    if (nextIds.length > 1) setCollaborateMode(true);

    setBranchLoading(true);
    const selected = machineryOptions.filter((node) => nextIds.includes(node.id));
    const childGroups = await Promise.all(
      selected.map(async (machinery) => ({
        machinery,
        children: await fetchChildren(machinery.id),
      })),
    );

    const components: JobLibraryNodeDto[] = [];
    const directJobs: JobLibraryNodeDto[] = [];
    const scopes: Record<string, JobScopeMeta> = {};

    for (const group of childGroups) {
      for (const child of group.children) {
        if (child.nodeType === "component") {
          components.push(child);
        } else if (child.nodeType === "standard_job") {
          directJobs.push(child);
          scopes[child.id] = {
            machineryKey: group.machinery.code,
            componentKey: null,
            machineryName: group.machinery.name,
            componentName: null,
          };
        }
      }
    }

    // Deduplicate by id while preserving order.
    const uniqueComponents = [...new Map(components.map((node) => [node.id, node])).values()];
    const uniqueJobs = [...new Map(directJobs.map((node) => [node.id, node])).values()];

    setComponentOptions(uniqueComponents);
    if (uniqueComponents.length === 0 && uniqueJobs.length > 0) {
      setAggregatedStandardJobs(uniqueJobs);
      setJobScopeById(scopes);
    } else {
      setAggregatedStandardJobs([]);
      setJobScopeById({});
    }
    setBranchLoading(false);
  }

  async function applyComponentSelection(nextIds: string[]) {
    setSelectedComponentIds(nextIds);
    setSelectedJobIds([]);
    setResolvedTemplate([]);
    setError(null);

    if (nextIds.length === 0) {
      // Keep any direct machinery jobs if present.
      if (selectedMachineryIds.length > 0 && componentOptions.length === 0) {
        return;
      }
      setAggregatedStandardJobs([]);
      setJobScopeById({});
      return;
    }

    setBranchLoading(true);
    const selectedComponents = componentOptions.filter((node) => nextIds.includes(node.id));
    const machineryById = new Map(selectedMachineryNodes.map((node) => [node.id, node]));

    const jobGroups = await Promise.all(
      selectedComponents.map(async (component) => ({
        component,
        machinery: component.parentId ? machineryById.get(component.parentId) ?? null : null,
        children: await fetchChildren(component.id),
      })),
    );

    const jobs: JobLibraryNodeDto[] = [];
    const scopes: Record<string, JobScopeMeta> = {};
    for (const group of jobGroups) {
      const machinery =
        group.machinery ??
        (group.component.parentId
          ? selectedMachineryNodes.find((node) => node.id === group.component.parentId) ?? null
          : null);
      for (const child of group.children) {
        if (child.nodeType !== "standard_job") continue;
        jobs.push(child);
        scopes[child.id] = {
          machineryKey: machinery?.code ?? null,
          componentKey: group.component.code,
          machineryName: machinery?.name ?? null,
          componentName: group.component.name,
        };
      }
    }

    const uniqueJobs = [...new Map(jobs.map((node) => [node.id, node])).values()];
    setAggregatedStandardJobs(uniqueJobs);
    setJobScopeById(scopes);
    setBranchLoading(false);
  }

  function toggleJob(node: JobLibraryNodeDto) {
    setSelectedJobIds((prev) => {
      const exists = prev.includes(node.id);
      const next = exists ? prev.filter((id) => id !== node.id) : [...prev, node.id];
      if (next.length >= 2) setCollaborateMode(true);

      const primaryId = next[0];
      if (primaryId) {
        const primary =
          aggregatedStandardJobs.find((job) => job.id === primaryId) ??
          (primaryId === node.id ? node : null);
        if (primary) {
          loadTemplateForJob(primary, {
            emptyOnly: descriptionSeededRef.current,
          });
        }
      } else {
        setResolvedTemplate([]);
      }
      return next;
    });
  }

  function addAllJobsToPlanned(jobs: JobLibraryNodeDto[]) {
    if (jobs.length === 0) return;
    setSelectedJobIds((prev) => {
      const next = [...prev];
      const seen = new Set(prev);
      for (const job of jobs) {
        if (seen.has(job.id)) continue;
        seen.add(job.id);
        next.push(job.id);
      }
      if (next.length >= 2) setCollaborateMode(true);

      const primaryId = next[0];
      const primary = primaryId
        ? (jobs.find((job) => job.id === primaryId) ??
          aggregatedStandardJobs.find((job) => job.id === primaryId) ??
          null)
        : null;
      if (primary) {
        loadTemplateForJob(primary, {
          emptyOnly: descriptionSeededRef.current,
        });
      }
      return next;
    });
  }

  function selectSearchHit(node: JobLibraryNodeDto) {
    setPath([node]);
    setLevelOptions([[node]]);
    setSearchQuery("");
    setSearchResults([]);
    resetBranchSelection();
    setSelectedJobIds([node.id]);
    setAggregatedStandardJobs([node]);
    setJobScopeById({
      [node.id]: {
        machineryKey: null,
        componentKey: null,
        machineryName: null,
        componentName: null,
      },
    });
    descriptionSeededRef.current = false;
    loadTemplateForJob(node, { emptyOnly: false });
  }

  function setCollaborateEnabled(enabled: boolean) {
    setError(null);
    if (!enabled && selectedMachineryIds.length > 1) {
      setCollaborateMode(true);
      setError("Multiple machinery selected — collaboration stays on until you reduce machinery.");
      return;
    }
    setCollaborateMode(enabled);
    if (!enabled && selectedJobIds.length > 1) {
      const keepId = selectedJobIds[0];
      setSelectedJobIds(keepId ? [keepId] : []);
      const primary = keepId
        ? aggregatedStandardJobs.find((job) => job.id === keepId)
        : null;
      if (primary) loadTemplateForJob(primary, { emptyOnly: true });
    }
  }

  function toggleRequirement(key: string) {
    setJobRequirements((prev) => {
      const exists = prev.includes(key);
      const next = exists ? prev.filter((item) => item !== key) : [...prev, key];
      setFormValues((values) => ({
        ...values,
        classAttendance: next.includes("class_attendance") ? "true" : values.classAttendance || "false",
        makerAttendance: next.includes("maker_attendance") ? "true" : values.makerAttendance || "false",
      }));
      return next;
    });
  }

  function buildSharedPayload(submitForReview: boolean) {
    const department =
      ancestorPath.find((n) => n.department)?.department ??
      path.find((n) => n.department)?.department ??
      path[0]?.name ??
      "General";
    const systemNode =
      ancestorPath.find((n) => n.nodeType === "system") ??
      path.find((n) => n.nodeType === "system");
    const primaryScope = activeScopeJob ? jobScopeById[activeScopeJob.id] : undefined;
    const machineryNode = selectedMachineryNodes[0] ?? path.find((n) => n.nodeType === "machinery");
    const componentNode =
      selectedComponentNodes[0] ?? path.find((n) => n.nodeType === "component");

    const requirements = [...jobRequirements];
    const classAttendance =
      requirements.includes("class_attendance") || formValues.classAttendance === "true";
    const makerAttendance =
      requirements.includes("maker_attendance") || formValues.makerAttendance === "true";

    return {
      vesselId,
      targetDryDockProjectId: dryDockProjectId ?? null,
      category: path.find((n) => n.nodeType === "category")?.code ?? department.toLowerCase(),
      department,
      systemKey: systemNode?.code ?? null,
      machineryKey: primaryScope?.machineryKey ?? machineryNode?.code ?? null,
      componentKey: primaryScope?.componentKey ?? componentNode?.code ?? null,
      workshop: systemNode?.workshop ?? path.find((n) => n.workshop)?.workshop ?? null,
      description:
        formValues.jobDescription ?? formValues.conditionDescription ?? activeScopeJob?.description ?? null,
      priority,
      source: "vessel" as const,
      conditionRating,
      conditionDescription: formValues.conditionDescription ?? null,
      observedDefect: formValues.observedDefect ?? null,
      repairRecommendation: formValues.repairRecommendation ?? null,
      replacementParts: formValues.replacementParts ?? null,
      consumables: formValues.consumables ?? null,
      estimatedCost: formValues.estimatedCost ? Number(formValues.estimatedCost) : null,
      classAttendance,
      makerAttendance,
      operationalRisk: formValues.operationalRisk ?? null,
      safetyRisk: formValues.safetyRisk ?? null,
      environmentalRisk: formValues.environmentalRisk ?? null,
      criticality: formValues.criticality ?? null,
      runningHoursAtSurvey: formValues.runningHours
        ? Number.parseInt(formValues.runningHours, 10)
        : null,
      lastOverhaulDate: formValues.lastOverhaul || null,
      linkedPmsReference: selectedMachineryAsset
        ? `machinery:${selectedMachineryAsset.id}`
        : null,
      linkedDefectId: linkedDefectId ?? null,
      formData: {
        ...formValues,
        jobRequirements: requirements,
        selectedMachineryKeys: selectedMachineryNodes.map((node) => node.code),
        selectedMachineryNames: selectedMachineryNodes.map((node) => node.name),
        selectedComponentKeys: selectedComponentNodes.map((node) => node.code),
        selectedComponentNames: selectedComponentNodes.map((node) => node.name),
        machineryAssetId: selectedMachineryAsset?.id ?? "",
        machineryAssetName: selectedMachineryAsset?.name ?? "",
        machineryAssetMaker: selectedMachineryAsset?.maker ?? "",
        machineryAssetModel: selectedMachineryAsset?.model ?? "",
        machineryAssetSerialNumber: selectedMachineryAsset?.serialNumber ?? "",
      },
      createdByName: createdByName.trim() || null,
      createdByRole: "vessel" as const,
      submit: submitForReview,
    };
  }

  async function submit(submitForReview: boolean) {
    if (selectedJobIds.length === 0 && !activeScopeJob) return;

    if (packageMode && selectedJobIds.length < 2) {
      setError("Select at least two standard jobs to collaborate");
      return;
    }

    setSaving(true);
    setError(null);

    const shared = buildSharedPayload(submitForReview);

    try {
      if (packageMode) {
        const memberScopes = selectedJobIds.map((id) => ({
          standardJobLibraryId: id,
          machineryKey: jobScopeById[id]?.machineryKey ?? shared.machineryKey,
          componentKey: jobScopeById[id]?.componentKey ?? shared.componentKey,
        }));
        const res = await fetch(`${jobsApiBase}/collaborate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...shared,
            standardJobLibraryIds: selectedJobIds,
            memberScopes,
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          vesselJobs?: DdVesselJobDto[];
          collaborationPackageId?: string;
        };
        if (!res.ok) {
          setError(data.error ?? "Failed to save collaborated jobs");
          return;
        }
        const primaryId = data.vesselJobs?.[0]?.id;
        if (primaryId && pendingPhotos.length > 0) {
          await uploadPendingVesselJobFiles(primaryId, pendingPhotos);
        }
      } else {
        const job = activeScopeJob!;
        const res = await fetch(jobsApiBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...shared,
            standardJobLibraryId: job.id,
            title: job.name,
            estimatedManhours: formValues.estimatedManhours
              ? Number(formValues.estimatedManhours)
              : job.estimatedManhours,
          }),
        });
        const data = (await res.json()) as { error?: string; vesselJob?: DdVesselJobDto };
        if (!res.ok) {
          setError(data.error ?? "Failed to save job");
          return;
        }
        if (data.vesselJob?.id && pendingPhotos.length > 0) {
          await uploadPendingVesselJobFiles(data.vesselJob.id, pendingPhotos);
        }
      }
      await resetSelection();
      onSaved?.();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  function formatDateForInput(value: string | null): string {
    return value ? value.slice(0, 10) : "";
  }

  function applyMachineryAsset(assetId: string) {
    setSelectedMachineryAssetId(assetId);
    const asset = machineryAssets.find((item) => item.id === assetId);
    if (!asset) return;

    const makeModel = [asset.maker, asset.model].filter(Boolean).join(" / ");
    setFormValues((prev) => ({
      ...prev,
      machineryAssetId: asset.id,
      equipmentTag: prev.equipmentTag || asset.name,
      department: prev.department || asset.department,
      runningHours:
        asset.currentRunningHours != null ? String(asset.currentRunningHours) : prev.runningHours || "",
      lastOverhaul: formatDateForInput(asset.lastOverhaulDate) || prev.lastOverhaul || "",
      makeModel: prev.makeModel || makeModel,
      engineMake: prev.engineMake || asset.maker || "",
      engineModel: prev.engineModel || asset.model || "",
      turbochargerMake: prev.turbochargerMake || asset.maker || "",
      turbochargerModel: prev.turbochargerModel || asset.model || "",
      pumpName: prev.pumpName || asset.name,
      motorNameNo: prev.motorNameNo || asset.name,
      generatorNo: prev.generatorNo || asset.name,
      equipmentSerialNumber: prev.equipmentSerialNumber || asset.serialNumber || "",
      machineryNotes: prev.machineryNotes || asset.notes || "",
    }));
    if (asset.conditionRating) setConditionRating(asset.conditionRating);
  }

  function renderField(field: JobInputFieldDef) {
    const value = formValues[field.key] ?? "";
    const onChange = (v: string) => {
      markUserEdited(field.key);
      setFormValues((prev) => ({ ...prev, [field.key]: v }));
    };

    if (field.type === "textarea") {
      return (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          required={field.required}
        />
      );
    }
    if (field.type === "boolean") {
      return (
        <LabeledSelect
          items={[
            { value: "false", label: "No" },
            { value: "true", label: "Yes" },
          ]}
          value={value || "false"}
          onValueChange={onChange}
          className="w-full"
        />
      );
    }
    if (field.type === "photos_note") {
      return (
        <div className="space-y-2">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={2}
            placeholder="Describe photos taken or attach files below"
          />
          <Input
            type="file"
            accept="image/*,video/*,.pdf"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              setPendingPhotos((prev) => [...prev, ...files]);
              e.target.value = "";
            }}
          />
          {pendingPhotos.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {pendingPhotos.length} file{pendingPhotos.length === 1 ? "" : "s"} ready to upload on save
            </p>
          ) : null}
        </div>
      );
    }
    if (field.type === "select" && field.options) {
      return (
        <LabeledSelect
          items={field.options}
          value={value}
          onValueChange={onChange}
          className="w-full"
        />
      );
    }
    return (
      <Input
        type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      />
    );
  }

  function renderFieldGrid(fields: JobInputFieldDef[]) {
    if (fields.length === 0) return null;
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field, index) => (
          <div
            key={`${field.key}-${index}`}
            className={
              field.type === "textarea" || field.type === "photos_note"
                ? "space-y-2 sm:col-span-2"
                : "space-y-2"
            }
          >
            <Label>
              {field.label}
              {field.unit ? ` (${field.unit})` : ""}
              {field.required ? " *" : ""}
            </Label>
            {renderField(field)}
          </div>
        ))}
      </div>
    );
  }

  function renderReadonlyValue(label: string, value: string | number | null | undefined) {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <Input value={value == null || value === "" ? "—" : String(value)} readOnly className="bg-slate-50" />
      </div>
    );
  }

  function setManualValue(key: string, value: string) {
    markUserEdited(key);
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }

  function emptyPickerMessage(): string {
    const inMasterRepoFramework = path.some(
      (n) =>
        n.code === "mtil_master_repo_v12" ||
        n.name.includes("Master Engineering Repository") ||
        n.name === "Engineering Domains",
    );
    const atFrameworkLeaf =
      inMasterRepoFramework && path[path.length - 1]?.nodeType === "system";

    if (atFrameworkLeaf) {
      return (
        "This R0.9 framework folder is a placeholder — it does not contain seeded jobs yet. " +
        "Go back to the top level and choose “Main Propulsion & Auxiliary (V3.1 ME+AE)” instead. " +
        "If that option is missing, an administrator must seed the EMDR V3.1 master repository from Admin → Job library."
      );
    }

    if (path.length > 0 || selectedMachineryIds.length > 0) {
      return (
        "No jobs are available under this branch. Clear selection and choose “Main Propulsion & Auxiliary (V3.1 ME+AE)”. " +
        "If it is not listed, ask an administrator to seed the EMDR master repository from Admin → Job library."
      );
    }

    return (
      "No job library departments are available for this vessel and project type. " +
      "An administrator must seed the EMDR V3.1 (Main Engine + Auxiliary Engine) master repository from Admin → Job library, " +
      "then reload this page."
    );
  }

  const cascadeLevels = levelOptions.length;
  const lastSelected = path[path.length - 1] ?? null;
  const showEmptyMessage =
    !loadingLevel &&
    !branchLoading &&
    !formReady &&
    ((path.length === 0 && (levelOptions[0]?.length ?? 0) === 0) ||
      (Boolean(lastSelected) &&
        lastSelected?.nodeType !== "standard_job" &&
        !hasMachineryMultiSelect &&
        levelOptions.length === path.length) ||
      (selectedMachineryIds.length > 0 &&
        componentOptions.length === 0 &&
        aggregatedStandardJobs.length === 0 &&
        !branchLoading) ||
      (selectedComponentIds.length > 0 &&
        aggregatedStandardJobs.length === 0 &&
        !branchLoading));

  const machineryGroupLabel = (node: JobLibraryNodeDto) => {
    const machinery = selectedMachineryNodes.find((item) => item.id === node.parentId);
    return machinery?.name ?? null;
  };

  const categoryNode = path.find((n) => n.nodeType === "category");
  const systemNode = path.find((n) => n.nodeType === "system");
  const machineryNode = selectedMachineryNodes[0] ?? path.find((n) => n.nodeType === "machinery");
  const componentNode = selectedComponentNodes[0] ?? path.find((n) => n.nodeType === "component");
  const projectLabel =
    dryDockProjectReference ?? dryDockProjectName ?? (dryDockProjectId ? "Active dry dock project" : "—");
  const vesselLabel = [vesselName, vesselCode ? `(${vesselCode})` : ""].filter(Boolean).join(" ");
  const selectedRequirementLabels = JOB_REQUIREMENT_OPTIONS.filter((option) =>
    jobRequirements.includes(option.key),
  ).map((option) => option.label);

  return (
    <div className="dd-job-wizard space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-xl text-blue-700">
              ▣
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Dry Dock Jobs › Create New Job</p>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                Create New Dry Dock Job
              </h2>
              <p className="text-sm text-slate-500">
                Define job details, requirements and scope for planning and execution.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!formReady || saving || templateLoading}
              onClick={() => void submit(false)}
            >
              {packageMode ? "Save Package Draft" : "Save as Draft"}
            </Button>
            <Button
              className="bg-blue-700 text-white hover:bg-blue-800"
              disabled={!formReady || saving || templateLoading}
              onClick={() => void submit(true)}
            >
              {saving ? "Creating…" : packageMode ? "Create Jobs" : "Create Job"}
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-4">
          {[
            ["1", "Job Overview", "Basic information"],
            ["2", "Scope & Requirements", "Define scope"],
            ["3", "Planning & Resources", "Survey, repair & team"],
            ["4", "Review & Confirm", "Validate & create"],
          ].map(([number, title, caption], index) => {
            const active = formReady ? index <= 2 : index === 0;
            return (
              <div key={number} className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    active ? "bg-blue-700 text-white" : "bg-slate-200 text-slate-600",
                  )}
                >
                  {number}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-950">{title}</span>
                  <span className="block text-xs text-slate-500">{caption}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {defectPrefill ? (
        <Card className="border-dd-rose-border bg-dd-rose-muted/70">
          <CardContent className="py-3 text-sm">
            Creating scope job from Master-approved defect:{" "}
            <span className="font-medium text-dd-rose">{defectPrefill.title}</span>
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <SectionCard
        className="dd-create-picker"
        accent="rose"
        badge="1 · Select"
        title="Job identification"
        description="Pick department → system → machinery → component(s) → standard job(s). Multi-select components under one machinery, or multiple machinery to aggregate and collaborate sibling jobs."
      >
        <div className="space-y-2">
          <Label htmlFor="job-library-search">Quick search standard jobs</Label>
          <Input
            id="job-library-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type at least 2 characters…"
            className="border-dd-rose-border/80 bg-white/80"
            disabled={effectiveCollaborate && selectedJobIds.length > 1}
          />
          {searchLoading ? (
            <p className="text-xs text-muted-foreground">Searching…</p>
          ) : null}
          {searchResults.length > 0 && !(effectiveCollaborate && selectedJobIds.length > 1) ? (
            <div className="max-h-48 overflow-auto rounded-lg border border-dd-rose-border bg-white/90">
              {searchResults.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className="flex w-full flex-col gap-0.5 border-b border-dd-rose-border/40 px-3 py-2 text-left last:border-b-0 hover:bg-dd-rose-muted"
                  onClick={() => selectSearchHit(node)}
                >
                  <span className="text-sm font-medium">{node.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {node.referenceCode ?? node.code} · standard job
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {ancestorPath.length > 0 ||
        selectedMachineryNodes.length > 0 ||
        selectedComponentNodes.length > 0 ||
        selectedJobIds.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {ancestorPath.map((node, idx) => (
              <span key={node.id} className="inline-flex items-center gap-1.5">
                {idx > 0 ? <span className="text-dd-rose/50">→</span> : null}
                <span className="rounded-md bg-dd-rose-muted px-2 py-1 text-xs font-medium text-dd-rose">
                  {node.name}
                </span>
              </span>
            ))}
            {selectedMachineryNodes.map((node, idx) => (
              <span key={node.id} className="inline-flex items-center gap-1.5">
                <span className="text-dd-rose/50">
                  {ancestorPath.length > 0 || idx > 0 ? (idx === 0 ? "→" : "+") : ""}
                </span>
                <span className="rounded-md bg-dd-orange-muted px-2 py-1 text-xs font-medium text-dd-orange">
                  {node.name}
                </span>
              </span>
            ))}
            {selectedComponentNodes.map((node, idx) => (
              <span key={node.id} className="inline-flex items-center gap-1.5">
                <span className="text-dd-rose/50">{idx === 0 ? "→" : "+"}</span>
                <span className="rounded-md bg-dd-yellow-muted px-2 py-1 text-xs font-medium text-dd-yellow">
                  {node.name}
                </span>
              </span>
            ))}
            {selectedJobIds.map((id, idx) => {
              const node = aggregatedStandardJobs.find((job) => job.id === id);
              if (!node) return null;
              return (
                <span key={id} className="inline-flex items-center gap-1.5">
                  <span className="text-dd-rose/50">{idx === 0 ? "→" : "+"}</span>
                  <span className="rounded-md bg-dd-rose px-2 py-1 text-xs font-medium text-white">
                    {node.name}
                  </span>
                </span>
              );
            })}
          </div>
        ) : null}

        {(aggregatedStandardJobs.length >= 2 || multiBranchSelection || collaborateMode) &&
        aggregatedStandardJobs.length > 0 ? (
          <div className="rounded-lg border border-dd-orange-border bg-dd-orange-muted/40 p-3">
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                checked={effectiveCollaborate}
                onCheckedChange={(checked) => setCollaborateEnabled(checked === true)}
                className="mt-0.5 border-dd-orange data-checked:border-dd-orange data-checked:bg-dd-orange"
                disabled={selectedMachineryIds.length > 1}
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium text-dd-orange">
                  Collaborate multiple jobs
                </span>
                <span className="block text-xs text-muted-foreground">
                  {selectedMachineryIds.length > 1
                    ? "Enabled automatically because multiple machinery items are selected. Jobs from all selected machinery/components appear below."
                    : "Combine related standard jobs into one collaboration package. Each job keeps its library template; they share equipment context and move as a group."}
                </span>
              </span>
            </label>
          </div>
        ) : null}

        {loadingLevel && cascadeLevels === 0 ? (
          <ActiniumLoadingState label="Loading options…" size="sm" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {levelOptions.map((options, levelIndex) => {
              if (isHomogeneousLevel(options, "machinery")) {
                // Rendered in the machinery + components two-column row below.
                return null;
              }

              if (isHomogeneousLevel(options, "component")) {
                // Legacy single-parent component list — prefer branch multi-select state.
                return null;
              }

              if (isHomogeneousLevel(options, "standard_job")) {
                // Jobs under machinery/components are rendered from aggregatedStandardJobs.
                if (hasMachineryMultiSelect) return null;

                return (
                  <StandardJobsPickerTable
                    key={`jobs-${levelIndex}`}
                    jobs={options}
                    plannedIds={selectedJobIds}
                    componentLabel={() =>
                      selectedComponentNodes[0]?.name ??
                      path.find((n) => n.nodeType === "component")?.name ??
                      "—"
                    }
                    onAdd={(node) => {
                      setAggregatedStandardJobs(options);
                      if (!selectedJobIds.includes(node.id)) toggleJob(node);
                    }}
                    onRemove={(node) => {
                      if (selectedJobIds.includes(node.id)) toggleJob(node);
                    }}
                    onAddAll={() => {
                      setAggregatedStandardJobs(options);
                      addAllJobsToPlanned(options);
                    }}
                  />
                );
              }

              const selected = path[levelIndex] ?? null;
              return (
                <div key={`level-${levelIndex}`} className="space-y-2">
                  <Label>{levelLabel(options, selected)}</Label>
                  <LabeledSelect
                    items={options.map((node) => ({
                      value: node.id,
                      label: `${node.name}${node.nodeType === "standard_job" && node.referenceCode ? ` (${node.referenceCode})` : ""}`,
                    }))}
                    value={selected?.id ?? ""}
                    onValueChange={(id) => void selectAtLevel(levelIndex, id)}
                    placeholder={`Select ${levelLabel(options, selected).toLowerCase()}`}
                    className="w-full border-dd-rose-border/60 bg-white/90"
                  />
                </div>
              );
            })}

            {hasMachineryMultiSelect ||
            selectedMachineryNodes.length > 0 ||
            componentOptions.length > 0 ? (
              <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2 lg:col-span-3">
                <div className="space-y-2">
                  <Label>
                    Selected machinery
                    {selectedMachineryIds.length > 0
                      ? ` (${selectedMachineryIds.length} selected)`
                      : ""}
                  </Label>
                  <div className="min-h-[4.5rem] space-y-2 rounded-lg border border-dd-orange-border bg-dd-orange-muted/30 p-3">
                    {selectedMachineryNodes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Choose machinery from the list below.
                      </p>
                    ) : (
                      selectedMachineryNodes.map((node) => (
                        <div
                          key={node.id}
                          className="flex items-start justify-between gap-2 rounded-md border border-dd-orange bg-white/90 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-dd-orange">{node.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {node.referenceCode ?? node.code}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 shrink-0 px-2 text-xs text-dd-orange"
                            onClick={() =>
                              void applyMachinerySelection(
                                selectedMachineryIds.filter((id) => id !== node.id),
                              )
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                  {machineryOptions.length > 0 ? (
                    <SearchableMultiSelect
                      items={machineryOptions.map((node) => ({
                        value: node.id,
                        label: node.name,
                        searchText: `${node.name} ${node.code} ${node.referenceCode ?? ""}`,
                      }))}
                      values={selectedMachineryIds}
                      onValuesChange={(ids) => void applyMachinerySelection(ids)}
                      placeholder="Search & select machinery…"
                      searchPlaceholder="Search machinery…"
                      className="w-full"
                    />
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>
                    Components
                    {selectedComponentIds.length > 0
                      ? ` (${selectedComponentIds.length} selected)`
                      : ""}
                  </Label>
                  <SearchableMultiSelect
                    items={componentOptions.map((node) => ({
                      value: node.id,
                      label:
                        selectedMachineryIds.length > 1 && machineryGroupLabel(node)
                          ? `${node.name} · ${machineryGroupLabel(node)}`
                          : node.name,
                      searchText: `${node.name} ${node.code} ${node.referenceCode ?? ""} ${machineryGroupLabel(node) ?? ""}`,
                    }))}
                    values={selectedComponentIds}
                    onValuesChange={(ids) => void applyComponentSelection(ids)}
                    placeholder={
                      selectedMachineryIds.length === 0
                        ? "Select machinery first…"
                        : "Search & select components…"
                    }
                    searchPlaceholder="Search components…"
                    disabled={selectedMachineryIds.length === 0}
                    emptyMessage={
                      selectedMachineryIds.length === 0
                        ? "Select machinery first"
                        : "No components under selected machinery"
                    }
                    className="w-full"
                  />
                  {selectedComponentNodes.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedComponentNodes.map((node) => (
                        <span
                          key={node.id}
                          className="inline-flex items-center gap-1 rounded-md bg-dd-yellow-muted px-2 py-1 text-xs font-medium text-dd-yellow"
                        >
                          {node.name}
                          <button
                            type="button"
                            className="rounded-sm px-0.5 hover:bg-white/50"
                            aria-label={`Remove ${node.name}`}
                            onClick={() =>
                              void applyComponentSelection(
                                selectedComponentIds.filter((id) => id !== node.id),
                              )
                            }
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {aggregatedStandardJobs.length > 0 ? (
              <StandardJobsPickerTable
                jobs={aggregatedStandardJobs}
                plannedIds={selectedJobIds}
                componentLabel={(node) => {
                  const scope = jobScopeById[node.id];
                  return scope?.componentName ?? scope?.machineryName ?? "—";
                }}
                onAdd={(node) => {
                  if (!selectedJobIds.includes(node.id)) toggleJob(node);
                }}
                onRemove={(node) => {
                  if (selectedJobIds.includes(node.id)) toggleJob(node);
                }}
                onAddAll={() => addAllJobsToPlanned(aggregatedStandardJobs)}
              />
            ) : null}
          </div>
        )}

        {selectedJobIds.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-dd-orange-border bg-dd-orange-muted/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-dd-orange">
                  Planned job list ({selectedJobIds.length})
                </p>
                <p className="text-xs text-muted-foreground">
                  These jobs will be used for the create / collaborate form below.
                </p>
              </div>
            </div>
            <ul className="space-y-2">
              {selectedJobIds.map((id) => {
                const node = aggregatedStandardJobs.find((job) => job.id === id);
                if (!node) return null;
                const scope = jobScopeById[id];
                const component =
                  scope?.componentName ??
                  selectedComponentNodes[0]?.name ??
                  "—";
                return (
                  <li
                    key={id}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-dd-orange/30 bg-white/90 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{node.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {component}
                        {node.referenceCode ? ` · ${node.referenceCode}` : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => toggleJob(node)}
                    >
                      <Trash2 className="size-3.5" />
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {(loadingLevel && cascadeLevels > 0) || branchLoading ? (
          <ActiniumLoadingState label="Loading next level…" size="sm" />
        ) : null}

        {showEmptyMessage ? (
          <p className="text-sm text-muted-foreground">{emptyPickerMessage()}</p>
        ) : null}

        {selectedJobIds.length === 1 && effectiveCollaborate && !packageMode ? (
          <p className="text-xs text-dd-orange">
            Select at least one more related job to create a collaboration package, or keep a single
            job to save normally.
          </p>
        ) : null}

        {path.length > 0 ||
        selectedMachineryIds.length > 0 ||
        selectedJobIds.length > 0 ||
        collaborateMode ? (
          <Button variant="ghost" size="sm" className="text-dd-rose" onClick={() => void resetSelection()}>
            Clear selection
          </Button>
        ) : null}
      </SectionCard>

      {formReady && activeScopeJob ? (
        <div className="dd-create-job-board">
          <SectionCard
            className="dd-create-card"
            accent="black"
            badge="A"
            title="Vessel & Project"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {renderReadonlyValue("Vessel", vesselLabel || vesselId)}
              {renderReadonlyValue("IMO Number", formValues.imoNumber || formValues.imoNo)}
              {renderReadonlyValue("Project", projectLabel)}
              {renderReadonlyValue("Docking Period", formValues.dockingPeriod || "Active project")}
            </div>
          </SectionCard>

          <SectionCard
            className="dd-create-card"
            accent="black"
            badge="B"
            title="Job Categorization"
            description={
              packageMode
                ? `Shared setup for ${selectedJobIds.length} collaborated jobs`
                : `${activeScopeJob.name}${activeScopeJob.referenceCode ? ` · Ref ${activeScopeJob.referenceCode}` : ""}`
            }
          >
            {templateLoading ? (
              <ActiniumLoadingState label="Loading job form template…" size="sm" />
            ) : null}
            {packageMode ? (
              <div className="rounded-lg border border-dd-black-soft/15 bg-white/70 p-3 text-sm">
                <p className="mb-2 font-medium text-foreground">Package members</p>
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  {selectedJobIds.map((id) => {
                    const node = aggregatedStandardJobs.find((job) => job.id === id);
                    const scope = jobScopeById[id];
                    const scopeLabel = [scope?.machineryName, scope?.componentName]
                      .filter(Boolean)
                      .join(" / ");
                    return (
                      <li key={id}>
                        {node?.name ?? id}
                        {scopeLabel ? ` · ${scopeLabel}` : ""}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              {renderReadonlyValue("Job Category", categoryNode?.name ?? path[0]?.name)}
              {renderReadonlyValue("Sub Category", systemNode?.name)}
              {renderReadonlyValue("Equipment / System", machineryNode?.name ?? formValues.equipmentTag)}
              {renderReadonlyValue("Location on Board", componentNode?.name ?? formValues.locationOnBoard)}
              {renderReadonlyValue("Job Code (Auto)", activeScopeJob.referenceCode ?? activeScopeJob.code)}
              <div className="space-y-2">
                <Label>Machinery / equipment from vessel register</Label>
                {machineryLoading ? (
                  <ActiniumLoadingState label="Loading machinery…" size="sm" />
                ) : machineryAssets.length > 0 ? (
                  <LabeledSelect
                    items={machineryAssets.map((asset) => ({
                      value: asset.id,
                      label: `${asset.name}${asset.department ? ` · ${asset.department}` : ""}`,
                    }))}
                    value={selectedMachineryAssetId}
                    onValueChange={applyMachineryAsset}
                    placeholder="Select machinery"
                    className="w-full"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No machinery registered for this vessel.</p>
                )}
              </div>
              {selectedMachineryAsset ? (
                <div className="rounded-lg border border-dd-black-soft/15 bg-white/70 p-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{selectedMachineryAsset.name}</p>
                  <p>
                    {[selectedMachineryAsset.maker, selectedMachineryAsset.model]
                      .filter(Boolean)
                      .join(" / ") || "Maker/model not recorded"}
                  </p>
                  <p>
                    Running hours: {selectedMachineryAsset.currentRunningHours ?? "—"} · Last overhaul:{" "}
                    {selectedMachineryAsset.lastOverhaulDate
                      ? new Date(selectedMachineryAsset.lastOverhaulDate).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard className="dd-create-card" accent="yellow" badge="C" title="Job Description">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Short Description *</Label>
                <Input
                  value={formValues.shortDescription ?? activeScopeJob.name}
                  onChange={(event) => setManualValue("shortDescription", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Detailed Description *</Label>
                <Textarea
                  value={formValues.jobDescription ?? formValues.conditionDescription ?? ""}
                  onChange={(event) => setManualValue("jobDescription", event.target.value)}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>Reference Document</Label>
                <Input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    setPendingPhotos((prev) => [...prev, ...files]);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            className="dd-create-card"
            accent="orange"
            badge="D"
            title="Priority & condition"
            description={
              packageMode
                ? "Shared across all jobs in this collaboration package."
                : "Set how urgent this scope is and the current equipment condition."
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Priority</Label>
                <LabeledSelect
                  items={JOB_PRIORITY_ITEMS}
                  value={priority}
                  onValueChange={(v) => setPriority(v || "medium")}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>Condition rating</Label>
                <LabeledSelect
                  items={CONDITION_RATING_ITEMS.map((i) => ({ value: i.value, label: i.label }))}
                  value={conditionRating}
                  onValueChange={(v) => setConditionRating(v || "monitor")}
                  className="w-full"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Criticality Indicator</Label>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {["Low", "Medium", "High", "Critical"].map((item) => {
                    const value = item.toLowerCase();
                    const checked = (formValues.criticality || "medium") === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setManualValue("criticality", value)}
                        className={cn(
                          "rounded-md border px-3 py-2 text-sm font-medium",
                          checked
                            ? "border-orange-400 bg-orange-50 text-orange-700"
                            : "border-slate-200 bg-white text-slate-700",
                        )}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Impact if Delayed</Label>
                <LabeledSelect
                  items={JOB_PRIORITY_ITEMS}
                  value={formValues.impactIfDelayed || priority}
                  onValueChange={(v) => setManualValue("impactIfDelayed", v || "medium")}
                  className="w-full"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            className="dd-create-card"
            accent="yellow"
            badge="E"
            title="Job type requirements"
            description="Select permits and attendance needs for this scope. Stored with the job for planning."
          >
            <div className="flex flex-wrap gap-2">
              {JOB_REQUIREMENT_OPTIONS.map((option) => {
                const checked = jobRequirements.includes(option.key);
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => toggleRequirement(option.key)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm transition-colors",
                      checked
                        ? "border-dd-yellow bg-dd-yellow-bright text-dd-black"
                        : "border-dd-yellow-border bg-white/80 text-dd-black hover:bg-dd-yellow-muted",
                    )}
                    aria-pressed={checked}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {jobRequirements.length === 0 ? (
              <p className="text-xs text-muted-foreground">No special requirements selected.</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {jobRequirements.length} requirement{jobRequirements.length === 1 ? "" : "s"} selected.
              </p>
            )}
            {selectedRequirementLabels.length > 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600">
                Permits to be arranged: {selectedRequirementLabels.join(", ")}
              </div>
            ) : null}
          </SectionCard>

          {defectFields.length > 0 ? (
            <SectionCard
              className="dd-create-card dd-create-card-tall"
              accent="yellow"
              badge="F"
              title="Condition description & defects"
              description="Auto-filled from the standard job library when you select a job. Edit as needed."
            >
              {renderFieldGrid(defectFields)}
            </SectionCard>
          ) : null}

          {measurementFields.length > 0 ? (
            <SectionCard
              className="dd-create-card"
              accent="orange"
              badge="G"
              title="Technical measurements / survey data"
              description="Running hours, dates, clearances, and other survey figures."
            >
              {renderFieldGrid(measurementFields)}
            </SectionCard>
          ) : null}

          {repairFields.length > 0 ? (
            <SectionCard
              className="dd-create-card dd-create-card-tall"
              accent="rose"
              badge="H"
              title="Repair scope & resources"
              description="Recommendations, parts, consumables, and attendance needs."
            >
              {renderFieldGrid(repairFields)}
            </SectionCard>
          ) : null}

          {riskFields.length > 0 ? (
            <SectionCard
              className="dd-create-card"
              accent="black"
              badge="I"
              title="Risk & criticality"
              description="Operational, safety, and environmental risk ratings."
            >
              {renderFieldGrid(riskFields)}
            </SectionCard>
          ) : null}

          {approvalFields.length > 0 ? (
            <SectionCard
              className="dd-create-card"
              accent="yellow"
              badge="J"
              title="Approval notes"
            >
              {renderFieldGrid(approvalFields)}
            </SectionCard>
          ) : null}

          {otherFields.length > 0 ? (
            <SectionCard className="dd-create-card" accent="orange" badge="K" title="Additional fields">
              {renderFieldGrid(otherFields)}
            </SectionCard>
          ) : null}

          <SectionCard className="dd-create-card dd-create-card-wide" accent="black" badge="L" title="Attachments">
            {attachmentFields.length > 0 ? renderFieldGrid(attachmentFields) : null}
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
              <Label>Attach reports, images, drawings or supporting files</Label>
              <Input
                className="mt-2 bg-white"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.jpg,.jpeg,.png,video/*"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  setPendingPhotos((prev) => [...prev, ...files]);
                  e.target.value = "";
                }}
              />
              <p className="mt-2 text-xs text-slate-500">
                {pendingPhotos.length > 0
                  ? `${pendingPhotos.length} file${pendingPhotos.length === 1 ? "" : "s"} ready to upload on save.`
                  : "PDF, DOC, XLS, DWG, JPG, PNG and video files can be attached."}
              </p>
            </div>
          </SectionCard>

          <SectionCard className="dd-create-card dd-create-card-wide" accent="black" badge="M" title="Additional Notes">
            <Textarea
              value={formValues.additionalNotes ?? ""}
              onChange={(event) => setManualValue("additionalNotes", event.target.value)}
              rows={4}
              placeholder="Add any additional notes or special instructions..."
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => void resetSelection()}>
                Clear & reselect
              </Button>
              <Button
                variant="outline"
                disabled={saving || templateLoading}
                onClick={() => void submit(false)}
              >
                {packageMode ? "Save package as draft" : "Save as Draft"}
              </Button>
              <Button
                className="bg-blue-700 text-white hover:bg-blue-800"
                disabled={saving || templateLoading}
                onClick={() => void submit(true)}
              >
                {saving ? "Creating…" : packageMode ? `Create ${selectedJobIds.length} Jobs` : "Create Job"}
              </Button>
            </div>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
