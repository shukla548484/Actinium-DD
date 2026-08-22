"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckIcon, ChevronDown, ChevronRight, ListPlus, Trash2 } from "lucide-react";
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

function StandardJobsPickerTable({
  jobs,
  plannedIds,
  componentLabel,
  onAdd,
  onRemove,
  onAddAll,
  onAddMany,
}: {
  jobs: JobLibraryNodeDto[];
  plannedIds: string[];
  componentLabel: (node: JobLibraryNodeDto) => string;
  onAdd: (node: JobLibraryNodeDto) => void;
  onRemove: (node: JobLibraryNodeDto) => void;
  onAddAll: () => void;
  onAddMany?: (nodes: JobLibraryNodeDto[]) => void;
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const plannedSet = useMemo(() => new Set(plannedIds), [plannedIds]);
  const unplannedCount = useMemo(
    () => jobs.filter((job) => !plannedSet.has(job.id)).length,
    [jobs, plannedSet],
  );

  const groups = useMemo(() => {
    const map = new Map<string, JobLibraryNodeDto[]>();
    for (const job of jobs) {
      const label = componentLabel(job) || "—";
      const list = map.get(label) ?? [];
      list.push(job);
      map.set(label, list);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }, [jobs, componentLabel]);

  const groupLabelsKey = groups.map((group) => group.label).join("\0");

  useEffect(() => {
    setCollapsedGroups((prev) => {
      const labels = new Set(groupLabelsKey ? groupLabelsKey.split("\0") : []);
      const next = new Set<string>();
      for (const label of prev) {
        if (labels.has(label)) next.add(label);
      }
      return next;
    });
  }, [jobs, groupLabelsKey]);

  const visibleCount = useMemo(
    () =>
      groups.reduce(
        (sum, group) => (collapsedGroups.has(group.label) ? sum : sum + group.items.length),
        0,
      ),
    [groups, collapsedGroups],
  );

  const allCollapsed = groups.length > 0 && groups.every((group) => collapsedGroups.has(group.label));

  function toggleGroup(label: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function setAllCollapsed(collapsed: boolean) {
    setCollapsedGroups(collapsed ? new Set(groups.map((group) => group.label)) : new Set());
  }

  if (jobs.length === 0) return null;

  return (
    <div className="space-y-3 sm:col-span-2 lg:col-span-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <Label>Suggested jobs</Label>
          <p className="text-xs text-muted-foreground">
            Select library jobs to include in this package.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">
            Showing {visibleCount} of {jobs.length}
            {plannedIds.length > 0 ? ` · ${plannedIds.length} planned` : ""}
          </p>
          {groups.length > 1 ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={() => setAllCollapsed(!allCollapsed)}
            >
              {allCollapsed ? "Expand all" : "Collapse all"}
            </Button>
          ) : null}
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
              <TableHead className="w-[11rem] whitespace-nowrap">Job code</TableHead>
              <TableHead className="w-[4.5rem] whitespace-nowrap">MH</TableHead>
              <TableHead className="w-[9.5rem] text-right whitespace-nowrap">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => {
              const collapsed = collapsedGroups.has(group.label);
              const plannedInGroup = group.items.filter((job) => plannedSet.has(job.id)).length;
              const unplannedInGroup = group.items.length - plannedInGroup;

              return (
                <Fragment key={`group-${group.label}`}>
                  <TableRow className="bg-slate-50/90 hover:bg-slate-50/90">
                    <TableCell colSpan={6} className="py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 text-left text-sm font-semibold text-slate-800"
                          onClick={() => toggleGroup(group.label)}
                          aria-expanded={!collapsed}
                        >
                          {collapsed ? (
                            <ChevronRight className="size-4 shrink-0 text-slate-500" />
                          ) : (
                            <ChevronDown className="size-4 shrink-0 text-slate-500" />
                          )}
                          <span>{group.label}</span>
                          <span className="font-normal text-muted-foreground">
                            ({group.items.length} job{group.items.length === 1 ? "" : "s"}
                            {plannedInGroup > 0 ? ` · ${plannedInGroup} planned` : ""}
                            {collapsed ? " · collapsed" : ""})
                          </span>
                        </button>
                        <div className="flex items-center gap-2">
                          {unplannedInGroup > 0 ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                const toAdd = group.items.filter((job) => !plannedSet.has(job.id));
                                if (onAddMany) onAddMany(toAdd);
                                else for (const job of toAdd) onAdd(job);
                              }}
                            >
                              <ListPlus className="size-3.5" />
                              Add group ({unplannedInGroup})
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => toggleGroup(group.label)}
                          >
                            {collapsed ? "Expand" : "Collapse"}
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                  {collapsed
                    ? null
                    : group.items.map((node) => {
                        const planned = plannedSet.has(node.id);
                        const description =
                          node.description?.trim() ||
                          `Carry out ${node.name} as per maker instructions and applicable class / maker requirements.`;
                        return (
                          <TableRow key={node.id} data-planned={planned || undefined}>
                            <TableCell className="align-top text-sm text-muted-foreground">
                              {group.label}
                            </TableCell>
                            <TableCell className="align-top">
                              <p className="font-medium text-foreground">{node.name}</p>
                            </TableCell>
                            <TableCell className="align-top">
                              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                                {description}
                              </p>
                            </TableCell>
                            <TableCell className="align-top font-mono text-xs text-muted-foreground">
                              {node.referenceCode ?? node.code}
                            </TableCell>
                            <TableCell className="align-top text-sm text-muted-foreground">
                              {node.estimatedManhours != null ? node.estimatedManhours : "—"}
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
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
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
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [showAdvancedRisk, setShowAdvancedRisk] = useState(false);
  const [expandedSelectedGroups, setExpandedSelectedGroups] = useState<Set<string>>(
    () => new Set(),
  );

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
    measurementFields,
    riskFields,
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
      const measurementFields = condition.filter(
        (f) =>
          MEASUREMENT_KEYS.has(f.key) ||
          f.type === "number" ||
          f.type === "date" ||
          f.type === "measurement",
      );
      return {
        measurementFields,
        riskFields: uniqueTemplate.filter((f) => f.section === "risk"),
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
    setWizardStep(1);
    setShowAdvancedRisk(false);
    setExpandedSelectedGroups(new Set());
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
    setError(null);

    if (nextIds.length === 0) {
      // Keep any direct machinery jobs if present.
      if (selectedMachineryIds.length > 0 && componentOptions.length === 0) {
        return;
      }
      setAggregatedStandardJobs([]);
      setJobScopeById({});
      setSelectedJobIds([]);
      setResolvedTemplate([]);
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
    const validJobIds = new Set(uniqueJobs.map((node) => node.id));

    setAggregatedStandardJobs(uniqueJobs);
    setJobScopeById(scopes);
    setSelectedJobIds((prev) => {
      const next = prev.filter((id) => validJobIds.has(id));
      if (next.length === 0) {
        setResolvedTemplate([]);
      } else if (next[0] !== prev[0]) {
        const primary = uniqueJobs.find((job) => job.id === next[0]);
        if (primary) {
          void loadTemplateForJob(primary, {
            emptyOnly: descriptionSeededRef.current,
          });
        }
      }
      if (next.length >= 2) setCollaborateMode(true);
      return next;
    });
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
  const departmentLevelIndex = levelOptions.findIndex(
    (options) =>
      options.length > 0 &&
      !isHomogeneousLevel(options, "machinery") &&
      !isHomogeneousLevel(options, "component") &&
      !isHomogeneousLevel(options, "standard_job"),
  );
  const departmentOptions =
    departmentLevelIndex >= 0 ? (levelOptions[departmentLevelIndex] ?? []) : [];
  const departmentSelected =
    departmentLevelIndex >= 0 ? (path[departmentLevelIndex] ?? null) : null;
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

  const projectLabel =
    dryDockProjectReference ?? dryDockProjectName ?? (dryDockProjectId ? "Active dry dock project" : "—");
  const vesselLabel = [vesselName, vesselCode ? `(${vesselCode})` : ""].filter(Boolean).join(" ");
  const selectedRequirementLabels = JOB_REQUIREMENT_OPTIONS.filter((option) =>
    jobRequirements.includes(option.key),
  ).map((option) => option.label);

  const selectedJobs = selectedJobIds
    .map((id) => aggregatedStandardJobs.find((job) => job.id === id))
    .filter((node): node is JobLibraryNodeDto => Boolean(node));

  const fromFormMh = Number(formValues.estimatedManhours);
  const estimatedMhTotal =
    Number.isFinite(fromFormMh) && fromFormMh > 0
      ? fromFormMh
      : selectedJobs.reduce((sum, job) => sum + (job.estimatedManhours ?? 0), 0);

  const estimatedCostTotal = Number(formValues.estimatedCost) || 0;

  const scopePathLabel = [
    ...ancestorPath.map((n) => n.name),
    ...selectedMachineryNodes.map((n) => n.name),
    ...selectedComponentNodes.map((n) => n.name),
  ]
    .filter(Boolean)
    .join(" → ");

  const selectedGroups = (() => {
    const map = new Map<string, JobLibraryNodeDto[]>();
    for (const job of selectedJobs) {
      const scope = jobScopeById[job.id];
      const label = scope?.componentName ?? scope?.machineryName ?? "Selected jobs";
      const list = map.get(label) ?? [];
      list.push(job);
      map.set(label, list);
    }
    return Array.from(map.entries()).map(([label, jobs]) => ({
      label,
      jobs,
      mh: jobs.reduce((sum, job) => sum + (job.estimatedManhours ?? 0), 0),
    }));
  })();

  const packageTitle =
    formValues.shortDescription?.trim() ||
    (selectedJobs.length === 1
      ? selectedJobs[0]!.name
      : selectedJobs.length > 1
        ? `${selectedJobs[0]!.name} (+${selectedJobs.length - 1} more)`
        : "Job package");

  const overallRisk = formValues.criticality || "medium";

  const stepMeta: { id: 1 | 2 | 3 | 4; title: string; caption: string }[] = [
    { id: 1, title: "Select jobs", caption: "Choose standard jobs" },
    { id: 2, title: "Define scope", caption: "Shared work package" },
    { id: 3, title: "Plan resources", caption: "Permits & technical data" },
    { id: 4, title: "Review & create", caption: "Confirm package" },
  ];

  function goNext() {
    if (wizardStep === 1 && selectedJobIds.length < 1) {
      setError("Select at least one standard job to continue");
      return;
    }
    setError(null);
    if (wizardStep === 1 && selectedJobIds.length >= 1 && !formValues.shortDescription) {
      setFormValues((prev) => ({
        ...prev,
        shortDescription:
          prev.shortDescription ||
          (selectedJobs.length === 1
            ? selectedJobs[0]!.name
            : selectedComponentNodes[0]?.name
              ? `${selectedComponentNodes[0].name} inspection and overhaul`
              : selectedJobs[0]?.name || "Job package"),
      }));
    }
    setWizardStep((s) => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : s));
  }

  function goBack() {
    setError(null);
    setWizardStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s));
  }

  const summaryPanel = (
    <aside className="space-y-4 lg:sticky lg:top-4">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Package summary</CardTitle>
          <CardDescription>Totals update as you build the package.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Jobs selected</span>
            <span className="font-medium">{selectedJobIds.length}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Estimated MH</span>
            <span className="font-medium">{estimatedMhTotal || "—"}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Estimated cost</span>
            <span className="font-medium">
              {estimatedCostTotal > 0 ? `$${estimatedCostTotal.toLocaleString()}` : "—"}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Permits</span>
            <span className="font-medium">{jobRequirements.length || "None"}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Risk</span>
            <span className="font-medium capitalize">{overallRisk}</span>
          </div>
          {wizardStep < 4 ? (
            <div className="flex flex-col gap-2 border-t pt-3">
              <Button
                variant="outline"
                disabled={!formReady || saving || templateLoading}
                onClick={() => void submit(false)}
              >
                Save draft
              </Button>
              <Button
                className="bg-blue-700 text-white hover:bg-blue-800"
                disabled={wizardStep === 1 ? selectedJobIds.length < 1 : !formReady}
                onClick={goNext}
              >
                Continue
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </aside>
  );

  return (
    <div className="dd-job-wizard space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              Create Dry-Dock Job
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Vessel: <span className="font-medium text-slate-900">{vesselLabel || vesselId}</span>
              {" · "}
              Project: <span className="font-medium text-slate-900">{projectLabel}</span>
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-4">
          {stepMeta.map((step) => {
            const active = wizardStep === step.id;
            const done = wizardStep > step.id;
            return (
              <button
                key={step.id}
                type="button"
                className="flex items-center gap-3 text-left"
                onClick={() => {
                  if (step.id < wizardStep || (step.id === 2 && selectedJobIds.length >= 1)) {
                    setWizardStep(step.id);
                  }
                }}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    active || done ? "bg-blue-700 text-white" : "bg-slate-200 text-slate-600",
                  )}
                >
                  {step.id}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-950">{step.title}</span>
                  <span className="block text-xs text-slate-500">{step.caption}</span>
                </span>
              </button>
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

      <div
        className={cn(
          "grid gap-4",
          wizardStep < 4 ? "lg:grid-cols-[minmax(0,1fr)_17rem]" : "",
        )}
      >
        <div className="min-w-0 space-y-4">
          {wizardStep === 1 ? (
            <SectionCard accent="rose" title="Select jobs">
              <div className="space-y-3">
                <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
                  <div className="flex flex-col gap-2 sm:contents">
                    <Label htmlFor="job-library-search" className="sm:col-start-1 sm:row-start-1">
                      Search jobs
                    </Label>
                    <Input
                      id="job-library-search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cylinder head inspection…"
                      className="h-8 border-dd-rose-border/80 bg-white/80 sm:col-start-1 sm:row-start-2"
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:contents">
                    <Label htmlFor="job-department" className="sm:col-start-2 sm:row-start-1">
                      {departmentLevelIndex >= 0
                        ? levelLabel(departmentOptions, departmentSelected)
                        : "Department"}
                    </Label>
                    {departmentLevelIndex >= 0 && !(loadingLevel && cascadeLevels === 0) ? (
                      <LabeledSelect
                        id="job-department"
                        items={departmentOptions.map((node) => ({
                          value: node.id,
                          label: node.name,
                        }))}
                        value={departmentSelected?.id ?? ""}
                        onValueChange={(id) => void selectAtLevel(departmentLevelIndex, id)}
                        placeholder="Select department"
                        className="h-8 w-full border-dd-rose-border/60 bg-white/90 py-0 sm:col-start-2 sm:row-start-2"
                      />
                    ) : (
                      <div className="flex h-8 items-center rounded-lg border border-dashed border-dd-rose-border/50 px-2.5 text-sm text-muted-foreground sm:col-start-2 sm:row-start-2">
                        {loadingLevel ? "Loading…" : "Select department"}
                      </div>
                    )}
                  </div>
                </div>
                {searchLoading ? <p className="text-xs text-muted-foreground">Searching…</p> : null}
                {searchResults.length > 0 ? (
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

              {scopePathLabel ? (
                <p className="text-sm text-slate-700">
                  <span className="text-muted-foreground">Scope path: </span>
                  {scopePathLabel}
                </p>
              ) : null}

              {loadingLevel && cascadeLevels === 0 ? (
                <ActiniumLoadingState label="Loading options…" size="sm" />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {levelOptions.map((options, levelIndex) => {
                    if (levelIndex === departmentLevelIndex) return null;
                    if (isHomogeneousLevel(options, "machinery")) return null;
                    if (isHomogeneousLevel(options, "component")) return null;
                    if (isHomogeneousLevel(options, "standard_job")) {
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
                          onAddMany={(nodes) => {
                            setAggregatedStandardJobs(options);
                            addAllJobsToPlanned(nodes);
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
                            label: node.name,
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
                        <Label>Machinery</Label>
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
                        <Label>Component</Label>
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
                      onAddMany={(nodes) => addAllJobsToPlanned(nodes)}
                    />
                  ) : null}
                </div>
              )}

              {(loadingLevel && cascadeLevels > 0) || branchLoading ? (
                <ActiniumLoadingState label="Loading next level…" size="sm" />
              ) : null}
              {showEmptyMessage ? (
                <p className="text-sm text-muted-foreground">{emptyPickerMessage()}</p>
              ) : null}

              {selectedGroups.length > 0 ? (
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                  <p className="text-sm font-semibold text-slate-900">
                    Selected package — {selectedJobIds.length} job
                    {selectedJobIds.length === 1 ? "" : "s"}
                  </p>
                  {selectedGroups.map((group) => {
                    const expanded = expandedSelectedGroups.has(group.label);
                    return (
                      <div
                        key={group.label}
                        className="rounded-md border border-slate-200 bg-white px-3 py-2"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <button
                            type="button"
                            className="min-w-0 text-left"
                            onClick={() =>
                              setExpandedSelectedGroups((prev) => {
                                const next = new Set(prev);
                                if (next.has(group.label)) next.delete(group.label);
                                else next.add(group.label);
                                return next;
                              })
                            }
                          >
                            <p className="text-sm font-medium">
                              {group.label}{" "}
                              <span className="font-normal text-muted-foreground">
                                {group.jobs.length} job{group.jobs.length === 1 ? "" : "s"}
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {group.jobs.map((j) => j.name).join(" · ")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Estimated: {group.mh || "—"} MH
                            </p>
                          </button>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() =>
                                setExpandedSelectedGroups((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(group.label)) next.delete(group.label);
                                  else next.add(group.label);
                                  return next;
                                })
                              }
                            >
                              {expanded ? "Hide" : "Edit"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-destructive"
                              onClick={() => {
                                for (const job of group.jobs) toggleJob(job);
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                        {expanded ? (
                          <ul className="mt-2 space-y-1 border-t pt-2">
                            {group.jobs.map((job) => (
                              <li
                                key={job.id}
                                className="flex items-center justify-between gap-2 text-sm"
                              >
                                <span>
                                  {job.name}
                                  {job.estimatedManhours != null
                                    ? ` · ${job.estimatedManhours} MH`
                                    : ""}
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-destructive"
                                  onClick={() => toggleJob(job)}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedJobIds.length} job{selectedJobIds.length === 1 ? "" : "s"}
                </p>
                <div className="flex gap-2">
                  {selectedJobIds.length > 0 || path.length > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void resetSelection();
                        setWizardStep(1);
                      }}
                    >
                      Reset selection
                    </Button>
                  ) : null}
                  <Button
                    className="bg-blue-700 text-white hover:bg-blue-800"
                    disabled={selectedJobIds.length < 1}
                    onClick={goNext}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            </SectionCard>
          ) : null}

          {wizardStep === 2 && formReady && activeScopeJob ? (
            <SectionCard accent="yellow" title="Define work scope">
              {templateLoading ? (
                <ActiniumLoadingState label="Loading job form template…" size="sm" />
              ) : null}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Package title</Label>
                  <Input
                    value={formValues.shortDescription ?? packageTitle}
                    onChange={(e) => setManualValue("shortDescription", e.target.value)}
                    placeholder="Cylinder Head Inspection and Overhaul"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Existing condition / defect</Label>
                  <Textarea
                    value={formValues.conditionDescription ?? formValues.observedDefect ?? ""}
                    onChange={(e) => {
                      setManualValue("conditionDescription", e.target.value);
                      setManualValue("observedDefect", e.target.value);
                    }}
                    rows={3}
                    placeholder="Describe leakage, wear, cracks, operating issue…"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Work scope</Label>
                  <Textarea
                    value={
                      formValues.repairRecommendation ??
                      formValues.jobDescription ??
                      ""
                    }
                    onChange={(e) => {
                      setManualValue("repairRecommendation", e.target.value);
                      setManualValue("jobDescription", e.target.value);
                    }}
                    rows={4}
                    placeholder="Inspect, dismantle, clean, measure and overhaul selected items…"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expected result / acceptance criteria</Label>
                  <Textarea
                    value={formValues.expectedResult ?? ""}
                    onChange={(e) => setManualValue("expectedResult", e.target.value)}
                    rows={3}
                    placeholder="Pressure test satisfactory, clearances within maker limits…"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Replacement parts</Label>
                    <Textarea
                      value={formValues.replacementParts ?? ""}
                      onChange={(e) => setManualValue("replacementParts", e.target.value)}
                      rows={3}
                      placeholder="Add parts…"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Consumables</Label>
                    <Textarea
                      value={formValues.consumables ?? ""}
                      onChange={(e) => setManualValue("consumables", e.target.value)}
                      rows={3}
                      placeholder="Add consumables…"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reference drawing or manual</Label>
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
                  {pendingPhotos.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {pendingPhotos.length} file{pendingPhotos.length === 1 ? "" : "s"} ready to
                      upload on save.
                    </p>
                  ) : null}
                </div>
                {selectedJobs.length > 1 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p className="font-medium">Jobs in this package</p>
                    <p className="mt-1 text-muted-foreground">
                      Shared scope applies to all jobs. Optional job-specific notes can be added
                      later from job details.
                    </p>
                    <ul className="mt-2 list-inside list-disc text-muted-foreground">
                      {selectedJobs.map((job) => (
                        <li key={job.id}>{job.name}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              <div className="flex justify-between gap-2 border-t pt-3">
                <Button variant="outline" onClick={goBack}>
                  Back
                </Button>
                <Button className="bg-blue-700 text-white hover:bg-blue-800" onClick={goNext}>
                  Continue
                </Button>
              </div>
            </SectionCard>
          ) : null}

          {wizardStep === 3 && formReady && activeScopeJob ? (
            <div className="space-y-4">
              <SectionCard accent="orange" title="Resources">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Estimated man-hours</Label>
                    <Input
                      type="number"
                      min={0}
                      value={
                        formValues.estimatedManhours ??
                        (estimatedMhTotal ? String(estimatedMhTotal) : "")
                      }
                      onChange={(e) => setManualValue("estimatedManhours", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estimated cost</Label>
                    <Input
                      type="number"
                      min={0}
                      value={formValues.estimatedCost ?? ""}
                      onChange={(e) => setManualValue("estimatedCost", e.target.value)}
                      placeholder="6500"
                    />
                  </div>
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
                      items={CONDITION_RATING_ITEMS.map((i) => ({
                        value: i.value,
                        label: i.label,
                      }))}
                      value={conditionRating}
                      onValueChange={(v) => setConditionRating(v || "monitor")}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
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
                      <p className="text-sm text-muted-foreground">
                        No machinery registered for this vessel.
                      </p>
                    )}
                  </div>
                </div>
              </SectionCard>

              <SectionCard accent="yellow" title="Permits and preparations">
                <div className="grid gap-2 sm:grid-cols-2">
                  {JOB_REQUIREMENT_OPTIONS.map((option) => {
                    const checked = jobRequirements.includes(option.key);
                    return (
                      <label
                        key={option.key}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleRequirement(option.key)}
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </SectionCard>

              <SectionCard accent="orange" title="Technical data">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Running hours</Label>
                    <Input
                      value={formValues.runningHours ?? ""}
                      onChange={(e) => setManualValue("runningHours", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last overhaul date</Label>
                    <Input
                      type="date"
                      value={formValues.lastOverhaul ?? ""}
                      onChange={(e) => setManualValue("lastOverhaul", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Required measurements / maker limits</Label>
                    <Textarea
                      value={formValues.measurements ?? formValues.clearance ?? ""}
                      onChange={(e) => setManualValue("measurements", e.target.value)}
                      rows={3}
                      placeholder="Expected clearances, maker limits…"
                    />
                  </div>
                </div>
                {measurementFields.length > 0 ? (
                  <div className="mt-4 border-t pt-4">{renderFieldGrid(measurementFields)}</div>
                ) : null}
              </SectionCard>

              <SectionCard accent="black" title="Risk">
                <div className="space-y-3">
                  <Label>Overall risk</Label>
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                    {["Low", "Medium", "High", "Critical"].map((item) => {
                      const value = item.toLowerCase();
                      const checked = overallRisk === value;
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
                  <button
                    type="button"
                    className="text-sm font-medium text-blue-700 hover:underline"
                    onClick={() => setShowAdvancedRisk((v) => !v)}
                  >
                    {showAdvancedRisk ? "Hide" : "Show"} advanced risk assessment
                  </button>
                  {showAdvancedRisk ? (
                    <div className="grid gap-4 rounded-lg border border-slate-200 p-3 sm:grid-cols-3">
                      {(
                        [
                          ["operationalRisk", "Operational risk"],
                          ["safetyRisk", "Safety risk"],
                          ["environmentalRisk", "Environmental risk"],
                        ] as const
                      ).map(([key, label]) => (
                        <div key={key} className="space-y-2">
                          <Label>{label}</Label>
                          <LabeledSelect
                            items={[
                              { value: "low", label: "Low" },
                              { value: "medium", label: "Medium" },
                              { value: "high", label: "High" },
                              { value: "critical", label: "Critical" },
                            ]}
                            value={formValues[key] || overallRisk}
                            onValueChange={(v) => setManualValue(key, v || "medium")}
                            className="w-full"
                          />
                        </div>
                      ))}
                      {riskFields.length > 0 ? renderFieldGrid(riskFields) : null}
                    </div>
                  ) : null}
                </div>
              </SectionCard>

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={goBack}>
                  Back
                </Button>
                <Button className="bg-blue-700 text-white hover:bg-blue-800" onClick={goNext}>
                  Continue
                </Button>
              </div>
            </div>
          ) : null}

          {wizardStep === 4 && formReady && activeScopeJob ? (
            <SectionCard accent="black" title="Review and create">
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Job package
                  </p>
                  <p className="text-lg font-semibold text-slate-950">{packageTitle}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Jobs included:</span>{" "}
                    <span className="font-medium">{selectedJobIds.length}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Estimated man-hours:</span>{" "}
                    <span className="font-medium">{estimatedMhTotal || "—"}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Estimated cost:</span>{" "}
                    <span className="font-medium">
                      {estimatedCostTotal > 0
                        ? `$${estimatedCostTotal.toLocaleString()}`
                        : "—"}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Class attendance:</span>{" "}
                    <span className="font-medium">
                      {jobRequirements.includes("class_attendance") ? "Required" : "Not required"}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Maker attendance:</span>{" "}
                    <span className="font-medium">
                      {jobRequirements.includes("maker_attendance") ? "Required" : "Not required"}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Risk:</span>{" "}
                    <span className="font-medium capitalize">{overallRisk}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Permits</p>
                  <p className="font-medium">
                    {selectedRequirementLabels.length > 0
                      ? selectedRequirementLabels.join(" · ")
                      : "None selected"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Attachments
                  </p>
                  <p className="font-medium">
                    {pendingPhotos.length} file{pendingPhotos.length === 1 ? "" : "s"}
                  </p>
                </div>
                {scopePathLabel ? (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Scope</p>
                    <p className="font-medium">{scopePathLabel}</p>
                  </div>
                ) : null}
                <ul className="list-inside list-disc text-muted-foreground">
                  {selectedJobs.map((job) => (
                    <li key={job.id}>{job.name}</li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-t pt-3">
                <Button variant="outline" onClick={goBack}>
                  Back
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={saving || templateLoading}
                    onClick={() => void submit(false)}
                  >
                    Save Draft
                  </Button>
                  <Button
                    className="bg-blue-700 text-white hover:bg-blue-800"
                    disabled={saving || templateLoading}
                    onClick={() => void submit(true)}
                  >
                    {saving
                      ? "Creating…"
                      : packageMode
                        ? `Create ${selectedJobIds.length} Jobs`
                        : "Create Job"}
                  </Button>
                </div>
              </div>
            </SectionCard>
          ) : null}
        </div>

        {wizardStep < 4 ? summaryPanel : null}
      </div>
    </div>
  );
}
