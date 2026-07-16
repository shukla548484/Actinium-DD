"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FilterFieldShell,
  filterTriggerClearPadding,
} from "@/components/ui/clearable-input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Filter,
  RotateCcw,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  FileText,
  Send,
  Download,
  Upload,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useVessels } from "@/hooks/useStaticData";
import { useVesselSelection } from "@/hooks/useVesselSelection";
import { useCachedVesselDetails } from "@/hooks/useCachedData";
import {
  BudgetDefineMatrix,
  type BudgetDefinePeriodContext,
} from "@/components/purchase/BudgetDefineMatrix";
import ActiniumLoader from "@/components/ActiniumLoader";
import { BudgetGroupedEntryTable } from "@/components/purchase/BudgetGroupedEntryTable";
import { BudgetL1UtilizationCharts } from "@/components/purchase/BudgetL1UtilizationCharts";
import { BudgetMonthlyMonitorTable } from "@/components/purchase/BudgetMonthlyMonitorTable";
import { BudgetExposureKpiStrip } from "@/components/purchase/BudgetExposureKpiStrip";
import {
  BudgetVsActualSummaryTable,
  type BudgetDrilldownTarget,
} from "@/components/purchase/BudgetVsActualSummaryTable";
import { BudgetTransactionDrilldown } from "@/components/purchase/BudgetTransactionDrilldown";
import { BudgetMonthlyTrendChart } from "@/components/purchase/BudgetMonthlyTrendChart";
import { BudgetCashFlowForecastChart } from "@/components/purchase/BudgetCashFlowForecastChart";
import { BudgetAccrualPanel } from "@/components/purchase/BudgetAccrualPanel";
import { BudgetFleetMonitorTable } from "@/components/purchase/BudgetFleetMonitorTable";
import type { BudgetFleetMonitorPayload } from "@/lib/purchase-budget-monitor-fleet";
import {
  BUDGET_POSTING_BASIS_LABELS,
  type BudgetPostingBasis,
} from "@/lib/purchase-budget-posting-basis";
import { BASE_CURRENCY, COMMON_MARINE_CURRENCIES } from "@/lib/utils/currency-shared";
import type { CashFlowForecastPayload } from "@/lib/purchase-budget-cash-flow-forecast";
import {
  PURCHASE_BUDGET_FUND_TYPE_LABELS,
  PURCHASE_BUDGET_FUND_TYPES,
  type PurchaseBudgetFundType,
} from "@/lib/purchase-budget-fund-type";
import type { BudgetVersionSummary } from "@/lib/purchase-budget-version";
import type { BudgetVsActualL1Row, BudgetMonitorStats } from "@/lib/purchase-budget-monitor-vs-actual";
import type { BudgetMonitorYtdMetrics } from "@/lib/purchase-budget-monitor-ytd";
import { SearchableOptionSelect } from "@/components/SearchableOptionSelect";
import { OptimizedMultiSelect } from "@/components/ui/optimized-multi-select";
import type { BudgetMonthlyMonitorPayload } from "@/lib/purchase-budget-monthly-monitor";
import { RequisitionType, REQUISITION_TYPE_LABELS } from "@/lib/types/requisition";
import {
  getBudgetAllocatedAmount,
  rollupAllL1BudgetStatusTotals,
  rollupBudgetStatusByL1,
} from "@/lib/purchase-budget-l1-rollup";
import {
  allocatedBudgetColumnLabel,
  deriveBudgetAmountsFromMonthly,
  matchesBudgetPeriod,
  type BudgetPeriodType,
} from "@/lib/purchase-budget-period";
import {
  BUDGET_MONTH_OPTIONS,
  buildBudgetYearOptions,
  defaultBudgetYearMonthRange,
  formatBudgetYearMonthRangeLabel,
  isSingleBudgetYearMonth,
  normalizeBudgetYearEnd,
  normalizeBudgetYearMonthEnd,
  suggestedYearEndForPeriodType,
  type BudgetYearMonth,
} from "@/lib/purchase-budget-year-range";
import {
  buildPurchaseBudgetDeclarationNumber,
  declarationToPeriodCodeInput,
  matchesDeclarationFilter,
  parseBudgetPeriodCodeMonthRange,
  resolveBudgetPeriodCodeForRecord,
  type BudgetDeclarationOption,
} from "@/lib/purchase-budget-period-code";
import { useAuth } from "@/components/auth/AuthProvider";
import { canEditPurchaseBudget } from "@/lib/purchase-budget-access";
import { canEditDryDockBudget } from "@/lib/drydock-budget-access";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import {
  PURCHASE_BUDGET_SCOPE,
  PURCHASE_BUDGET_SCOPE_LABELS,
  type PurchaseBudgetScope,
} from "@/lib/purchase-budget-scope";
import { TableSerialHead, TableSerialCell } from "@/components/ui/table-serial-column";
import { formatBudgetCurrency } from "@/lib/purchase-budget-amount-format";

interface BudgetType {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  displayOrder: number;
  isActive: boolean;
  level: number;
  parentId?: string | null;
  parent?: {
    id: string;
    code: string;
    name: string;
    level?: number;
  } | null;
  children?: BudgetType[];
}

type BudgetStats = BudgetMonitorStats;

interface BudgetEntry {
  id: string;
  budgetTypeId: string;
  budgetType?: {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    level?: number;
    parent?: {
      id: string;
      code: string;
      name: string;
    } | null;
  };
  section?: string; // For backward compatibility
  vesselId: string;
  vessel?: {
    name: string;
    code: string;
  };
  budgetYear: number;
  budgetYearEnd?: number | null;
  budgetMonth: number | null;
  budgetQuarter?: number | null;
  budgetPeriodType?: string | null;
  budgetPeriodCode?: string | null;
  monthlyAmount: number;
  yearlyAmount: number;
  dailyAmount: number;
  currency: string;
  notes?: string | null;
  allocatedAmount?: number;
  spentAmount?: number;
  committedAmount?: number;
  exposureAmount?: number;
  remainingAmount?: number;
  percentageUsed?: number;
  status?: string;
  period?: string;
}

interface BudgetFormData {
  budgetTypeId: string;
  budgetYear: number;
  budgetMonth: number | null;
  monthlyAmount: number;
  currency: string;
  notes: string;
}

export interface DryDockProjectOption {
  id: string;
  vesselId: string;
  projectNumber: string;
  projectName: string;
  status: string;
  plannedStartDate: string;
  vessel?: { name: string; code: string };
}

export interface PurchaseBudgetControlViewProps {
  /** Locks budget scope and hides the Normal / Dry Dock switch when set. */
  fixedBudgetScope?: PurchaseBudgetScope;
  /** Budgets are stored per dry dock project (requires project selection). */
  projectScoped?: boolean;
  /** Pre-select project (e.g. from /drydock/budget-control?projectId=). */
  initialDryDockProjectId?: string | null;
  pageTitle?: string;
  pageDescription?: string;
}

export function PurchaseBudgetControlView({
  fixedBudgetScope,
  projectScoped = false,
  initialDryDockProjectId = null,
  pageTitle = "Budget Control",
  pageDescription,
}: PurchaseBudgetControlViewProps) {
  const { ready, markSuccess } = usePageBootstrap();
  const { user } = useAuth();
  const scopeLocked = fixedBudgetScope != null;
  const canEditBudget = projectScoped
    ? canEditDryDockBudget(user)
    : canEditPurchaseBudget(user?.designationAccessLevel);

  const { selectedVesselId, setSelectedVesselId, isLoading: vesselLoading } = useVesselSelection({
    syncWithAPI: true,
  });
  const { data: vessels = [], isLoading: vesselsLoading } = useVessels({ limit: 100, isActive: true });
  const { vessel: vesselDetails } = useCachedVesselDetails(selectedVesselId || null);

  const [budgetScope, setBudgetScope] = useState<PurchaseBudgetScope>(
    fixedBudgetScope ?? PURCHASE_BUDGET_SCOPE.NORMAL
  );
  const isDryDockBudget =
    (fixedBudgetScope ?? budgetScope) === PURCHASE_BUDGET_SCOPE.DRY_DOCK;

  const [dryDockProjects, setDryDockProjects] = useState<DryDockProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedDryDockProjectId, setSelectedDryDockProjectId] = useState<string>(
    initialDryDockProjectId ?? ""
  );

  useEffect(() => {
    if (fixedBudgetScope) setBudgetScope(fixedBudgetScope);
  }, [fixedBudgetScope]);
  const [activeTab, setActiveTab] = useState<"define" | "monitor" | "types">("define");
  const [budgets, setBudgets] = useState<BudgetEntry[]>([]);
  const [stats, setStats] = useState<BudgetStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentCalendarYear = new Date().getFullYear();
  const defaultRange = defaultBudgetYearMonthRange(currentCalendarYear);
  const [selectedYearStart, setSelectedYearStart] = useState<number>(defaultRange.from.year);
  const [selectedYearEnd, setSelectedYearEnd] = useState<number>(defaultRange.to.year);
  const [selectedMonthStart, setSelectedMonthStart] = useState<number>(defaultRange.from.month);
  const [selectedMonthEnd, setSelectedMonthEnd] = useState<number>(defaultRange.to.month);
  const budgetYearOptions = useMemo(() => buildBudgetYearOptions(currentCalendarYear), [currentCalendarYear]);
  const selectedRangeFrom = useMemo<BudgetYearMonth>(
    () => ({ year: selectedYearStart, month: selectedMonthStart }),
    [selectedYearStart, selectedMonthStart]
  );
  const selectedRangeTo = useMemo<BudgetYearMonth>(
    () => ({ year: selectedYearEnd, month: selectedMonthEnd }),
    [selectedYearEnd, selectedMonthEnd]
  );
  const selectedRangeLabel = useMemo(
    () => formatBudgetYearMonthRangeLabel(selectedRangeFrom, selectedRangeTo),
    [selectedRangeFrom, selectedRangeTo]
  );
  const isSingleMonthRange = useMemo(
    () => isSingleBudgetYearMonth(selectedRangeFrom, selectedRangeTo),
    [selectedRangeFrom, selectedRangeTo]
  );

  const applyNormalizedRangeEnd = useCallback((from: BudgetYearMonth, to: BudgetYearMonth) => {
    const normalized = normalizeBudgetYearMonthEnd(from, to);
    setSelectedYearEnd(normalized.year);
    setSelectedMonthEnd(normalized.month);
  }, []);

  const handleYearStartChange = useCallback(
    (year: number) => {
      setSelectedYearStart(year);
      const from: BudgetYearMonth = { year, month: selectedMonthStart };
      applyNormalizedRangeEnd(from, { year: selectedYearEnd, month: selectedMonthEnd });
      setSelectedYearEnd((prev) => normalizeBudgetYearEnd(year, prev));
    },
    [selectedMonthStart, selectedYearEnd, selectedMonthEnd, applyNormalizedRangeEnd]
  );

  const handleMonthStartChange = useCallback(
    (month: number) => {
      setSelectedMonthStart(month);
      applyNormalizedRangeEnd(
        { year: selectedYearStart, month },
        { year: selectedYearEnd, month: selectedMonthEnd }
      );
    },
    [selectedYearStart, selectedYearEnd, selectedMonthEnd, applyNormalizedRangeEnd]
  );

  const handleYearEndChange = useCallback(
    (year: number) => {
      const nextYear = normalizeBudgetYearEnd(selectedYearStart, year);
      setSelectedYearEnd(nextYear);
      applyNormalizedRangeEnd(
        { year: selectedYearStart, month: selectedMonthStart },
        { year: nextYear, month: selectedMonthEnd }
      );
    },
    [selectedYearStart, selectedMonthStart, selectedMonthEnd, applyNormalizedRangeEnd]
  );

  const handleMonthEndChange = useCallback(
    (month: number) => {
      setSelectedMonthEnd(month);
      applyNormalizedRangeEnd(
        { year: selectedYearStart, month: selectedMonthStart },
        { year: selectedYearEnd, month }
      );
    },
    [selectedYearStart, selectedMonthStart, selectedYearEnd, applyNormalizedRangeEnd]
  );

  const defaultDefinePeriodType = isDryDockBudget ? "dry_docking" : "yearly";

  const handleResetFilters = useCallback(() => {
    const defaults = defaultBudgetYearMonthRange(currentCalendarYear);
    setSelectedYearStart(defaults.from.year);
    setSelectedYearEnd(defaults.to.year);
    setSelectedMonthStart(defaults.from.month);
    setSelectedMonthEnd(defaults.to.month);
    setSelectedDeclarationCode("");
    const currentMonth = new Date().getMonth() + 1;
    setDefinePeriodContext({
      periodType: defaultDefinePeriodType,
      month: currentMonth,
      quarter: Math.ceil(currentMonth / 3) as 1 | 2 | 3 | 4,
    });
    setMonitorViewMode("monthly");
    setSelectedRequisitionType("all");
    setSelectedMachineryInstanceIds([]);
    setSelectedL1BudgetTypeIds([]);
  }, [currentCalendarYear, defaultDefinePeriodType]);
  const [selectedDeclarationCode, setSelectedDeclarationCode] = useState("");
  const [declarationOptions, setDeclarationOptions] = useState<BudgetDeclarationOption[]>([]);
  const [definePeriodContext, setDefinePeriodContext] = useState<BudgetDefinePeriodContext>(() => {
    const month = new Date().getMonth() + 1;
    return {
      periodType: "yearly",
      month,
      quarter: Math.ceil(month / 3) as 1 | 2 | 3 | 4,
    };
  });

  const selectedVesselCode = useMemo(
    () => vessels.find((v) => v.id === selectedVesselId)?.code ?? "",
    [vessels, selectedVesselId]
  );

  const selectedDryDockProjectNumber = useMemo(
    () =>
      dryDockProjects.find((p) => p.id === selectedDryDockProjectId)?.projectNumber ?? "",
    [dryDockProjects, selectedDryDockProjectId]
  );

  const effectiveDryDockProjectId = useMemo(
    () =>
      (isDryDockBudget || projectScoped) && selectedDryDockProjectId
        ? selectedDryDockProjectId
        : undefined,
    [isDryDockBudget, projectScoped, selectedDryDockProjectId]
  );

  const budgetDeclarationNumber = useMemo(
    () =>
      selectedVesselId
        ? buildPurchaseBudgetDeclarationNumber(selectedVesselCode, {
            budgetYear: selectedYearStart,
            budgetYearEnd: selectedYearEnd,
            budgetMonth:
              definePeriodContext.periodType === "monthly" ? definePeriodContext.month : null,
            budgetQuarter:
              definePeriodContext.periodType === "quarterly" ? definePeriodContext.quarter : null,
            periodType: definePeriodContext.periodType,
            rangeFromMonth: selectedMonthStart,
            rangeToMonth: selectedMonthEnd,
            budgetScope: fixedBudgetScope ?? budgetScope,
            dryDockProjectNumber: effectiveDryDockProjectId
              ? selectedDryDockProjectNumber
              : null,
          })
        : "",
    [
      selectedVesselId,
      selectedVesselCode,
      selectedYearStart,
      selectedYearEnd,
      selectedMonthStart,
      selectedMonthEnd,
      definePeriodContext,
      fixedBudgetScope,
      budgetScope,
      effectiveDryDockProjectId,
      selectedDryDockProjectNumber,
    ]
  );

  useEffect(() => {
    setDefinePeriodContext((prev) => {
      const nextType = isDryDockBudget
        ? prev.periodType === "dry_docking"
          ? prev.periodType
          : "dry_docking"
        : prev.periodType === "dry_docking"
          ? "yearly"
          : prev.periodType;
      if (nextType === prev.periodType) return prev;
      return { ...prev, periodType: nextType };
    });
  }, [isDryDockBudget]);

  useEffect(() => {
    const suggested = suggestedYearEndForPeriodType(
      selectedYearStart,
      definePeriodContext.periodType
    );
    setSelectedYearEnd((prev) =>
      definePeriodContext.periodType === "five_yearly" ? suggested : normalizeBudgetYearEnd(selectedYearStart, prev)
    );
  }, [selectedYearStart, definePeriodContext.periodType]);

  const refreshDeclarations = useCallback(async () => {
    if (!selectedVesselId) {
      setDeclarationOptions([]);
      setSelectedDeclarationCode("");
      return;
    }
    if (projectScoped && !selectedDryDockProjectId) {
      setDeclarationOptions([]);
      return;
    }
    const params = new URLSearchParams({
      vesselId: selectedVesselId,
      budgetScope: fixedBudgetScope ?? budgetScope,
    });
    if (effectiveDryDockProjectId) {
      params.set("dryDockProjectId", effectiveDryDockProjectId);
    }
    try {
      const res = await fetch(`/api/purchase/budgets/declarations?${params.toString()}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) return;
      setDeclarationOptions(json.declarations ?? []);
    } catch {
      setDeclarationOptions([]);
    }
  }, [
    selectedVesselId,
    effectiveDryDockProjectId,
    budgetScope,
    fixedBudgetScope,
    projectScoped,
    selectedDryDockProjectId,
  ]);

  useEffect(() => {
    void refreshDeclarations();
  }, [refreshDeclarations]);

  const buildDeclarationLabel = useCallback(
    (decl: BudgetDeclarationOption) => {
      const parsedRange = parseBudgetPeriodCodeMonthRange(decl.code);
      return buildPurchaseBudgetDeclarationNumber(selectedVesselCode, {
        ...declarationToPeriodCodeInput(decl),
        rangeFromMonth: parsedRange?.from.month ?? decl.budgetMonth ?? 1,
        rangeToMonth: parsedRange?.to.month ?? decl.budgetMonth ?? 12,
        budgetScope: fixedBudgetScope ?? budgetScope,
        dryDockProjectNumber: effectiveDryDockProjectId ? selectedDryDockProjectNumber : null,
      });
    },
    [
      selectedVesselCode,
      fixedBudgetScope,
      budgetScope,
      effectiveDryDockProjectId,
      selectedDryDockProjectNumber,
    ]
  );

  const declarationSelectOptions = useMemo(
    () =>
      declarationOptions.map((decl) => {
        const budgetNo = buildDeclarationLabel(decl);
        return {
          value: decl.code,
          label: `${budgetNo} — ${decl.label} (${decl.lineCount} lines)`,
          keywords: `${budgetNo} ${decl.code} ${decl.label} ${decl.periodType} ${decl.budgetYear}`,
        };
      }),
    [declarationOptions, buildDeclarationLabel]
  );

  const selectedDeclaration = useMemo(
    () => declarationOptions.find((d) => d.code === selectedDeclarationCode) ?? null,
    [declarationOptions, selectedDeclarationCode]
  );

  const handleDefinePeriodContextChange = useCallback((ctx: BudgetDefinePeriodContext) => {
    setDefinePeriodContext((prev) =>
      prev.periodType === ctx.periodType &&
      prev.month === ctx.month &&
      prev.quarter === ctx.quarter
        ? prev
        : ctx
    );
  }, []);

  const applyDeclarationFilter = useCallback((code: string) => {
    setSelectedDeclarationCode(code);
    if (!code) return;
    const decl = declarationOptions.find((d) => d.code === code);
    if (!decl) return;

    const parsedRange = parseBudgetPeriodCodeMonthRange(decl.code);
    setSelectedYearStart(parsedRange?.from.year ?? decl.budgetYear);
    setSelectedYearEnd(parsedRange?.to.year ?? decl.budgetYearEnd);
    if (decl.budgetMonth != null) {
      setSelectedMonthStart(decl.budgetMonth);
      setSelectedMonthEnd(decl.budgetMonth);
    } else if (parsedRange) {
      setSelectedMonthStart(parsedRange.from.month);
      setSelectedMonthEnd(parsedRange.to.month);
    } else {
      setSelectedMonthStart(1);
      setSelectedMonthEnd(12);
    }
    setDefinePeriodContext({
      periodType: decl.periodType,
      month: decl.budgetMonth ?? parsedRange?.from.month ?? definePeriodContext.month,
      quarter:
        (decl.budgetQuarter as 1 | 2 | 3 | 4 | null) ??
        definePeriodContext.quarter,
    });
  }, [declarationOptions, definePeriodContext.month, definePeriodContext.quarter]);

  // Monitor filters
  const [monitorViewMode, setMonitorViewMode] = useState<
    "vs_actual" | "monthly" | "cash_flow" | "l2_detail" | "fleet"
  >("vs_actual");
  const [actualsSource, setActualsSource] = useState<"po" | "invoice">("po");
  const [postingBasis, setPostingBasis] = useState<BudgetPostingBasis>("req_created");
  const [fundTypeFilter, setFundTypeFilter] = useState<PurchaseBudgetFundType | "all">("all");
  const [budgetVersionId, setBudgetVersionId] = useState<string>("");
  const [budgetVersions, setBudgetVersions] = useState<BudgetVersionSummary[]>([]);
  const [cashFlowForecast, setCashFlowForecast] = useState<CashFlowForecastPayload | null>(null);
  const [accrualActual, setAccrualActual] = useState(0);
  const [pmsForecastTotal, setPmsForecastTotal] = useState(0);
  const [fleetDisplayCurrency, setFleetDisplayCurrency] = useState(BASE_CURRENCY);
  const [fleetMonitorData, setFleetMonitorData] = useState<BudgetFleetMonitorPayload | null>(null);
  const [selectedRequisitionType, setSelectedRequisitionType] = useState<string>("all");
  const [selectedMachineryInstanceIds, setSelectedMachineryInstanceIds] = useState<string[]>([]);
  const [selectedL1BudgetTypeIds, setSelectedL1BudgetTypeIds] = useState<string[]>([]);
  const [monthlyMonitorData, setMonthlyMonitorData] = useState<BudgetMonthlyMonitorPayload | null>(null);
  const [budgetVsActualL1, setBudgetVsActualL1] = useState<BudgetVsActualL1Row[]>([]);
  const [ytdMetrics, setYtdMetrics] = useState<BudgetMonitorYtdMetrics | null>(null);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownTarget, setDrilldownTarget] = useState<BudgetDrilldownTarget | null>(null);
  const [drilldownMonthKey, setDrilldownMonthKey] = useState<string | null>(null);
  const [machineryInstances, setMachineryInstances] = useState<any[]>([]);
  const [loadingMachinery, setLoadingMachinery] = useState(false);
  
  // PDF Report state
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  
  // Budget types state
  const [budgetTypes, setBudgetTypes] = useState<BudgetType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  
  // Budget type form state
  const [showBudgetTypeForm, setShowBudgetTypeForm] = useState(false);
  const [editingBudgetType, setEditingBudgetType] = useState<BudgetType | null>(null);
  const [budgetTypeForm, setBudgetTypeForm] = useState({
    code: "",
    name: "",
    description: "",
    displayOrder: 0,
    isActive: true,
    level: 2 as 1 | 2,
    parentId: "",
  });
  
  // Form state
  const [formData, setFormData] = useState<BudgetFormData>({
    budgetTypeId: "",
    budgetYear: new Date().getFullYear(),
    budgetMonth: null,
    monthlyAmount: 0,
    currency: "USD",
    notes: "",
  });
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  const [importingBudgetTypes, setImportingBudgetTypes] = useState(false);
  const [syncingFromMaster, setSyncingFromMaster] = useState(false);
  const budgetTypeFileInputRef = useRef<HTMLInputElement>(null);
  const budgetsFetchAbortRef = useRef<AbortController | null>(null);

  const vesselCompanyId = useMemo(() => {
    if (!selectedVesselId) return null;
    const fromDetails =
      vesselDetails?.companyId ?? vesselDetails?.company?.id ?? null;
    if (fromDetails) return fromDetails;
    const vessel = vessels.find((v) => v.id === selectedVesselId) as
      | { companyId?: string; company?: { id?: string } }
      | undefined;
    return vessel?.companyId ?? vessel?.company?.id ?? null;
  }, [
    selectedVesselId,
    vesselDetails?.companyId,
    vesselDetails?.company?.id,
    vessels,
  ]);

  const level1BudgetTypes = useMemo(
    () => budgetTypes.filter((type) => type.level === 1),
    [budgetTypes]
  );
  const level2BudgetTypes = useMemo(
    () => budgetTypes.filter((type) => type.level === 2 && type.isActive),
    [budgetTypes]
  );

  const requisitionTypeOptions = useMemo(
    () => [
      { value: "all", label: "All Types" },
      ...Object.values(RequisitionType).map((type) => ({
        value: type,
        label: `${REQUISITION_TYPE_LABELS[type]} (${type})`,
        keywords: type,
      })),
    ],
    []
  );

  const machinerySelectOptions = useMemo(
    () =>
      machineryInstances.map((instance) => ({
        value: instance.id,
        label: `${instance.name} (${instance.code})`,
        description: instance.code,
      })),
    [machineryInstances]
  );

  const l1BudgetSelectOptions = useMemo(
    () =>
      level1BudgetTypes.map((type) => ({
        value: type.id,
        label: `${type.code} — ${type.name}`,
        description: type.code,
      })),
    [level1BudgetTypes]
  );

  // Initialize page - stop loader immediately, vessels load in background
  useEffect(() => {
    markSuccess();
  }, [markSuccess]);

  const loadBudgetTypes = useCallback(async (companyIdParam: string, scope: PurchaseBudgetScope) => {
    setLoadingTypes(true);
    try {
      const response = await fetch(
        `/api/purchase/budget-types?companyId=${companyIdParam}&includeInactive=true&budgetScope=${scope}`,
        { credentials: "include" }
      );

      if (response.ok) {
        const data = await response.json();
        setBudgetTypes(data.budgetTypes || []);
      } else {
        toast.error("Failed to load budget types");
      }
    } catch (error) {
      console.error("Error loading budget types:", error);
      toast.error("Error loading budget types");
    } finally {
      setLoadingTypes(false);
    }
  }, [budgetScope]);

  const loadMachineryInstances = useCallback(async (vesselId: string) => {
    setLoadingMachinery(true);
    try {
      const response = await fetch(`/api/machinery-instances/all?vesselId=${vesselId}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setMachineryInstances(data || []);
      }
    } catch (error) {
      console.error("Error loading machinery instances:", error);
    } finally {
      setLoadingMachinery(false);
    }
  }, []);

  // Resolve company + machinery when vessel / company id changes (not whole vesselDetails object)
  useEffect(() => {
    if (selectedVesselId) {
      if (vesselCompanyId) {
        setCompanyId(vesselCompanyId);
        void loadBudgetTypes(vesselCompanyId, budgetScope);
      }
      void loadMachineryInstances(selectedVesselId);
    } else {
      setCompanyId(null);
      setBudgetTypes([]);
      setMachineryInstances([]);
    }
  }, [selectedVesselId, vesselCompanyId, budgetScope, loadBudgetTypes, loadMachineryInstances]);

  const loadDryDockProjects = useCallback(async (vesselId: string) => {
    setLoadingProjects(true);
    try {
      const res = await fetch(
        `/api/drydock/projects?vesselId=${encodeURIComponent(vesselId)}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        setDryDockProjects([]);
        return;
      }
      const all = (await res.json()) as DryDockProjectOption[];
      setDryDockProjects(all);
    } catch {
      setDryDockProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    if ((!isDryDockBudget && !projectScoped) || !selectedVesselId) {
      setDryDockProjects([]);
      if (!projectScoped && !initialDryDockProjectId) setSelectedDryDockProjectId("");
      return;
    }
    void loadDryDockProjects(selectedVesselId);
  }, [
    isDryDockBudget,
    projectScoped,
    selectedVesselId,
    loadDryDockProjects,
    initialDryDockProjectId,
  ]);

  useEffect(() => {
    if (initialDryDockProjectId) setSelectedDryDockProjectId(initialDryDockProjectId);
  }, [initialDryDockProjectId]);

  const canLoadBudgetData =
    Boolean(selectedVesselId) && (!projectScoped || Boolean(selectedDryDockProjectId));

  const loadBudgets = useCallback(async () => {
    if (!canLoadBudgetData) return;

    budgetsFetchAbortRef.current?.abort();
    const controller = new AbortController();
    budgetsFetchAbortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("vesselId", selectedVesselId);
      params.append("year", selectedYearStart.toString());
      params.append("yearEnd", selectedYearEnd.toString());
      params.append("monthFrom", selectedMonthStart.toString());
      params.append("monthTo", selectedMonthEnd.toString());
      params.append("budgetScope", fixedBudgetScope ?? budgetScope);
      if (effectiveDryDockProjectId) {
        params.append("dryDockProjectId", effectiveDryDockProjectId);
      }

      const response = await fetch(`/api/purchase/budgets?${params.toString()}`, {
        credentials: "include",
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      if (response.ok) {
        const data = await response.json();
        setBudgets(data.budgets || []);
      } else {
        toast.error("Failed to load budgets");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      console.error("Error loading budgets:", error);
      toast.error("Error loading budgets");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [
    canLoadBudgetData,
    selectedVesselId,
    selectedYearStart,
    selectedYearEnd,
    selectedMonthStart,
    selectedMonthEnd,
    budgetScope,
    fixedBudgetScope,
    effectiveDryDockProjectId,
  ]);

  const loadMonitorData = useCallback(async () => {
    if (!canLoadBudgetData) return;

    budgetsFetchAbortRef.current?.abort();
    const controller = new AbortController();
    budgetsFetchAbortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("vesselId", selectedVesselId);
      params.append("year", selectedYearStart.toString());
      params.append("yearEnd", selectedYearEnd.toString());
      params.append("monthFrom", selectedMonthStart.toString());
      params.append("monthTo", selectedMonthEnd.toString());
      params.append("budgetScope", fixedBudgetScope ?? budgetScope);
      if (effectiveDryDockProjectId) {
        params.append("dryDockProjectId", effectiveDryDockProjectId);
      }
      if (selectedRequisitionType !== "all") {
        params.append("requisitionType", selectedRequisitionType);
      }
      if (selectedMachineryInstanceIds.length > 0) {
        params.append("machineryInstanceIds", selectedMachineryInstanceIds.join(","));
      }
      if (selectedL1BudgetTypeIds.length > 0) {
        params.append("l1BudgetTypeIds", selectedL1BudgetTypeIds.join(","));
      }
      params.append("actualsSource", actualsSource);
      params.append("postingBasis", postingBasis);
      if (fundTypeFilter !== "all") params.append("fundType", fundTypeFilter);
      if (budgetVersionId) params.append("budgetVersionId", budgetVersionId);

      const response = await fetch(`/api/purchase/budgets/monitor?${params.toString()}`, {
        credentials: "include",
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      if (response.ok) {
        const data = await response.json();
        setBudgets(data.budgets || []);
        setStats(data.stats || null);
        setBudgetVsActualL1(data.budgetVsActualL1 || []);
        setMonthlyMonitorData(data.monthlyBreakdown ?? null);
        setYtdMetrics(data.ytdMetrics ?? null);
        setCashFlowForecast(data.cashFlowForecast ?? null);
        setAccrualActual(data.accrualActual ?? 0);
        setPmsForecastTotal(data.pmsForecastTotal ?? 0);
      } else {
        toast.error("Failed to load budget monitoring data");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      console.error("Error loading budget monitoring data:", error);
      toast.error("Error loading budget monitoring data");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [
    selectedVesselId,
    selectedYearStart,
    selectedYearEnd,
    selectedMonthStart,
    selectedMonthEnd,
    selectedRequisitionType,
    selectedMachineryInstanceIds,
    selectedL1BudgetTypeIds,
    actualsSource,
    postingBasis,
    fundTypeFilter,
    budgetVersionId,
    budgetScope,
    fixedBudgetScope,
    effectiveDryDockProjectId,
    canLoadBudgetData,
  ]);

  const loadBudgetVersions = useCallback(async () => {
    if (!selectedVesselId) {
      setBudgetVersions([]);
      return;
    }
    try {
      const params = new URLSearchParams({
        vesselId: selectedVesselId,
        budgetScope: fixedBudgetScope ?? budgetScope,
      });
      if (selectedDeclarationCode) params.set("budgetPeriodCode", selectedDeclarationCode);
      const res = await fetch(`/api/purchase/budgets/versions?${params}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setBudgetVersions(data.versions ?? []);
      }
    } catch (e) {
      console.error("Error loading budget versions:", e);
    }
  }, [selectedVesselId, selectedDeclarationCode, budgetScope, fixedBudgetScope]);

  const loadFleetMonitorData = useCallback(async () => {
    if (!canLoadBudgetData) return;

    budgetsFetchAbortRef.current?.abort();
    const controller = new AbortController();
    budgetsFetchAbortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedVesselId) params.append("vesselId", selectedVesselId);
      params.append("year", selectedYearStart.toString());
      params.append("yearEnd", selectedYearEnd.toString());
      params.append("monthFrom", selectedMonthStart.toString());
      params.append("monthTo", selectedMonthEnd.toString());
      params.append("budgetScope", fixedBudgetScope ?? budgetScope);
      params.append("actualsSource", actualsSource);
      params.append("postingBasis", postingBasis);
      params.append("displayCurrency", fleetDisplayCurrency);
      if (effectiveDryDockProjectId) {
        params.append("dryDockProjectId", effectiveDryDockProjectId);
      }
      if (selectedRequisitionType !== "all") {
        params.append("requisitionType", selectedRequisitionType);
      }
      if (selectedMachineryInstanceIds.length > 0) {
        params.append("machineryInstanceIds", selectedMachineryInstanceIds.join(","));
      }
      if (selectedL1BudgetTypeIds.length > 0) {
        params.append("l1BudgetTypeIds", selectedL1BudgetTypeIds.join(","));
      }

      const response = await fetch(`/api/purchase/budgets/monitor/fleet?${params.toString()}`, {
        credentials: "include",
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      if (response.ok) {
        setFleetMonitorData(await response.json());
      } else {
        toast.error("Failed to load fleet budget monitoring data");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      console.error("Error loading fleet monitor:", error);
      toast.error("Error loading fleet budget monitoring data");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [
    selectedVesselId,
    selectedYearStart,
    selectedYearEnd,
    selectedMonthStart,
    selectedMonthEnd,
    selectedRequisitionType,
    selectedMachineryInstanceIds,
    selectedL1BudgetTypeIds,
    actualsSource,
    postingBasis,
    fleetDisplayCurrency,
    budgetScope,
    fixedBudgetScope,
    effectiveDryDockProjectId,
    canLoadBudgetData,
  ]);

  const monitorQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.append("vesselId", selectedVesselId);
    params.append("year", selectedYearStart.toString());
    params.append("yearEnd", selectedYearEnd.toString());
    params.append("monthFrom", selectedMonthStart.toString());
    params.append("monthTo", selectedMonthEnd.toString());
    params.append("budgetScope", fixedBudgetScope ?? budgetScope);
    params.append("actualsSource", actualsSource);
    params.append("postingBasis", postingBasis);
    if (effectiveDryDockProjectId) {
      params.append("dryDockProjectId", effectiveDryDockProjectId);
    }
    if (selectedRequisitionType !== "all") {
      params.append("requisitionType", selectedRequisitionType);
    }
    if (selectedMachineryInstanceIds.length > 0) {
      params.append("machineryInstanceIds", selectedMachineryInstanceIds.join(","));
    }
    return params;
  }, [
    selectedVesselId,
    selectedYearStart,
    selectedYearEnd,
    selectedMonthStart,
    selectedMonthEnd,
    budgetScope,
    fixedBudgetScope,
    effectiveDryDockProjectId,
    actualsSource,
    postingBasis,
    selectedRequisitionType,
    selectedMachineryInstanceIds,
  ]);

  const monitorUtilizationOverview = useMemo(
    () =>
      stats
        ? {
            allocated: stats.allocatedBudget,
            consumed: stats.exposureBudget,
            remaining: stats.remainingBudget,
          }
        : { allocated: 0, consumed: 0, remaining: 0 },
    [stats]
  );

  const monitorUtilizationByL1 = useMemo(
    () =>
      budgetVsActualL1.map((row) => ({
        code: row.code,
        name: row.name,
        label: row.label,
        allocated: row.budget,
        consumed: row.exposure,
        remaining: row.remaining,
      })),
    [budgetVsActualL1]
  );

  const openDrilldown = useCallback((target: BudgetDrilldownTarget, monthKey?: string | null) => {
    setDrilldownTarget(target);
    setDrilldownMonthKey(monthKey ?? null);
    setDrilldownOpen(true);
  }, []);

  const loadDefineBudgetData = useCallback(async () => {
    if (!canLoadBudgetData) return;

    budgetsFetchAbortRef.current?.abort();
    const controller = new AbortController();
    budgetsFetchAbortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("vesselId", selectedVesselId);
      params.append("year", selectedYearStart.toString());
      params.append("yearEnd", selectedYearEnd.toString());
      params.append("monthFrom", selectedMonthStart.toString());
      params.append("monthTo", selectedMonthEnd.toString());
      params.append("budgetScope", fixedBudgetScope ?? budgetScope);
      if (effectiveDryDockProjectId) {
        params.append("dryDockProjectId", effectiveDryDockProjectId);
      }

      const response = await fetch(`/api/purchase/budgets/monitor?${params.toString()}`, {
        credentials: "include",
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      if (response.ok) {
        const data = await response.json();
        setBudgets(data.budgets || []);
        setStats(null);
      } else {
        toast.error("Failed to load budget data");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      console.error("Error loading define budget data:", error);
      toast.error("Error loading budget data");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [
    selectedVesselId,
    selectedYearStart,
    selectedYearEnd,
    selectedMonthStart,
    selectedMonthEnd,
    budgetScope,
    fixedBudgetScope,
    effectiveDryDockProjectId,
    canLoadBudgetData,
  ]);

  useEffect(() => {
    if (!canLoadBudgetData) return;
    if (activeTab === "monitor") {
      if (monitorViewMode === "fleet") {
        void loadFleetMonitorData();
      } else {
        void loadMonitorData();
      }
    } else if (activeTab === "define") {
      void loadDefineBudgetData();
    }
    return () => budgetsFetchAbortRef.current?.abort();
  }, [
    activeTab,
    selectedVesselId,
    selectedYearStart,
    selectedYearEnd,
    selectedMonthStart,
    selectedMonthEnd,
    budgetScope,
    canLoadBudgetData,
    monitorViewMode,
    loadDefineBudgetData,
    loadMonitorData,
    loadFleetMonitorData,
  ]);

  useEffect(() => {
    if (activeTab === "monitor") void loadBudgetVersions();
  }, [activeTab, loadBudgetVersions]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeTab,
    selectedVesselId,
    selectedYearStart,
    selectedYearEnd,
    selectedMonthStart,
    selectedMonthEnd,
    selectedRequisitionType,
    selectedMachineryInstanceIds,
    selectedL1BudgetTypeIds,
    monitorViewMode,
    actualsSource,
    postingBasis,
    fundTypeFilter,
    budgetVersionId,
    fleetDisplayCurrency,
    definePeriodContext,
    itemsPerPage,
  ]);

  const defineFilteredBudgets = useMemo(
    () =>
      budgets.filter((b) => {
        if (
          selectedDeclarationCode &&
          !matchesDeclarationFilter(b, selectedDeclarationCode, definePeriodContext.periodType)
        ) {
          return false;
        }
        return matchesBudgetPeriod(
          b.budgetMonth,
          b.budgetQuarter,
          definePeriodContext.periodType,
          definePeriodContext.month,
          definePeriodContext.quarter
        );
      }),
    [budgets, definePeriodContext, selectedDeclarationCode]
  );

  const defineChartPeriod = definePeriodContext.periodType;

  const defineUtilizationOverview = useMemo(
    () => rollupAllL1BudgetStatusTotals(defineFilteredBudgets, defineChartPeriod),
    [defineFilteredBudgets, defineChartPeriod]
  );

  const defineUtilizationByL1 = useMemo(
    () => rollupBudgetStatusByL1(defineFilteredBudgets, defineChartPeriod),
    [defineFilteredBudgets, defineChartPeriod]
  );

  const defineAllocatedHead = allocatedBudgetColumnLabel(defineChartPeriod);

  const listForPagination = activeTab === "define" ? defineFilteredBudgets : budgets;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBudgets = listForPagination.slice(startIndex, endIndex);

  const budgetsSummaryCurrency = useMemo(
    () =>
      (activeTab === "define" ? defineFilteredBudgets : budgets).find((b) => b.currency)
        ?.currency ?? "USD",
    [activeTab, defineFilteredBudgets, budgets]
  );

  const formatDerivedBudgetAmount = useCallback(
    (budget: BudgetEntry, kind: "monthly" | "quarterly" | "yearly") => {
      const derived = deriveBudgetAmountsFromMonthly(Number(budget.monthlyAmount) || 0);
      const amount =
        kind === "monthly"
          ? derived.monthlyAmount
          : kind === "quarterly"
            ? derived.quarterlyAmount
            : derived.yearlyAmount;
      return formatCurrency(amount, budget.currency);
    },
    []
  );

  const formatBudgetPeriod = (budget: BudgetEntry) => {
    return resolveBudgetPeriodCodeForRecord(budget);
  };

  const handleSaveBudget = async () => {
    if (!canEditBudget) {
      toast.error("Access level 40 or higher is required to define or edit budgets");
      return;
    }
    if (!selectedVesselId) {
      toast.error("Please select a vessel");
      return;
    }
    if (!formData.budgetTypeId) {
      toast.error("Please select a budget type");
      return;
    }
    if (formData.monthlyAmount <= 0) {
      toast.error("Monthly amount must be greater than 0");
      return;
    }

    setSaving(true);
    try {
      const periodType: BudgetPeriodType = isSingleMonthRange ? "monthly" : "yearly";
      const amount =
        periodType === "yearly"
          ? formData.monthlyAmount * 12
          : formData.monthlyAmount;

      const url = editingBudget
        ? `/api/purchase/budgets/${editingBudget}`
        : "/api/purchase/budgets";
      const method = editingBudget ? "PUT" : "POST";

      const payload = editingBudget
        ? { periodType, amount, currency: formData.currency, notes: formData.notes || null }
        : {
            vesselId: selectedVesselId,
            budgetTypeId: formData.budgetTypeId,
            budgetYear: selectedYearStart,
            budgetYearEnd: selectedYearEnd,
            budgetMonth: isSingleMonthRange ? selectedMonthStart : null,
            periodType,
            amount,
            currency: formData.currency,
            notes: formData.notes || null,
          };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(editingBudget ? "Budget updated successfully" : "Budget created successfully");
        resetForm();
        if (activeTab === "define") {
          void loadDefineBudgetData();
        } else {
          void loadBudgets();
        }
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save budget");
      }
    } catch (error) {
      console.error("Error saving budget:", error);
      toast.error("Error saving budget");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    if (!canEditBudget) {
      toast.error("Access level 40 or higher is required to delete budgets");
      return;
    }
    if (!confirm("Are you sure you want to delete this budget?")) return;

    try {
      const response = await fetch(`/api/purchase/budgets/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        toast.success("Budget deleted successfully");
        if (activeTab === "define") {
          void loadDefineBudgetData();
        } else {
          void loadBudgets();
        }
      } else {
        toast.error("Failed to delete budget");
      }
    } catch (error) {
      console.error("Error deleting budget:", error);
      toast.error("Error deleting budget");
    }
  };

  const handleEditBudget = (budget: BudgetEntry) => {
    setEditingBudget(budget.id);
    setFormData({
      budgetTypeId: budget.budgetTypeId,
      budgetYear: budget.budgetYear,
      budgetMonth: budget.budgetMonth,
      monthlyAmount: budget.monthlyAmount,
      currency: budget.currency,
      notes: budget.notes || "",
    });
    setSelectedYearStart(budget.budgetYear);
    setSelectedYearEnd(budget.budgetYearEnd ?? budget.budgetYear);
    setSelectedMonth(budget.budgetMonth?.toString() || "all");
  };

  const resetForm = () => {
    setFormData({
      budgetTypeId: "",
      budgetYear: new Date().getFullYear(),
      budgetMonth: null,
      monthlyAmount: 0,
      currency: "USD",
      notes: "",
    });
    setEditingBudget(null);
  };

  // Budget Type Management Functions
  const handleSaveBudgetType = async () => {
    if (!canEditBudget) {
      toast.error("Access level 40 or higher is required to manage budget categories");
      return;
    }
    if (!selectedVesselId) {
      toast.error("Please select a vessel first");
      return;
    }
    
    // Get companyId - try from state first, otherwise fetch from vessel
    let vesselCompanyId =
      companyId ??
      vesselDetails?.companyId ??
      vesselDetails?.company?.id ??
      (vessels.find((v) => v.id === selectedVesselId) as any)?.companyId ??
      (vessels.find((v) => v.id === selectedVesselId) as any)?.company?.id;
    if (vesselCompanyId) {
      setCompanyId(vesselCompanyId);
    }
    
    if (!vesselCompanyId) {
      toast.error("Unable to determine company. Please try selecting the vessel again.");
      return;
    }
    if (!budgetTypeForm.code || !budgetTypeForm.name) {
      toast.error("Code and name are required");
      return;
    }
    if (budgetTypeForm.level === 2 && !budgetTypeForm.parentId) {
      toast.error("Level 2 budget codes must belong to a Level 1 group");
      return;
    }

    try {
      const url = editingBudgetType
        ? `/api/purchase/budget-types/${editingBudgetType.id}`
        : "/api/purchase/budget-types";
      const method = editingBudgetType ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...budgetTypeForm,
          companyId: vesselCompanyId,
          budgetScope,
          parentId: budgetTypeForm.level === 2 && budgetTypeForm.parentId ? budgetTypeForm.parentId : null,
        }),
      });

      if (response.ok) {
        toast.success(editingBudgetType ? "Budget type updated" : "Budget type created");
        resetBudgetTypeForm();
        loadBudgetTypes(companyId, budgetScope);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save budget type");
      }
    } catch (error) {
      console.error("Error saving budget type:", error);
      toast.error("Error saving budget type");
    }
  };

  const handleDeleteBudgetType = async (id: string) => {
    if (!canEditBudget) {
      toast.error("Access level 40 or higher is required to delete budget categories");
      return;
    }
    if (!confirm("Are you sure you want to delete this budget type?")) return;

    try {
      const response = await fetch(`/api/purchase/budget-types/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        toast.success("Budget type deleted");
        if (companyId) loadBudgetTypes(companyId, budgetScope);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete budget type");
      }
    } catch (error) {
      console.error("Error deleting budget type:", error);
      toast.error("Error deleting budget type");
    }
  };

  const handleSyncFromMaster = async () => {
    if (!canEditBudget) {
      toast.error("Access level 40 or higher is required to sync budget categories");
      return;
    }
    if (!companyId) {
      toast.error("Please select a vessel first");
      return;
    }
    setSyncingFromMaster(true);
    try {
      const res = await fetch("/api/purchase/budget-types/sync-from-master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyId, budgetScope }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      await loadBudgetTypes(companyId, budgetScope);
      toast.success(
        `Synced from master: ${data.created} created, ${data.updated} updated (${data.total} categories).`
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to sync from master");
    } finally {
      setSyncingFromMaster(false);
    }
  };

  const handleDownloadBudgetTypeTemplate = async () => {
    try {
      const res = await fetch(
        `/api/purchase/budget-types/template?budgetScope=${budgetScope}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = isDryDockBudget
        ? "dry-dock-budget-categories-template.xlsx"
        : "purchase-budget-categories-template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Template downloaded");
    } catch (e) {
      toast.error("Failed to download template");
    }
  };

  const handleImportBudgetTypes = async (file: File) => {
    if (importingBudgetTypes) return;
    if (!canEditBudget) {
      toast.error("Access level 40 or higher is required to import budget categories");
      return;
    }
    if (!companyId) {
      toast.error("Please select a vessel first");
      return;
    }
    setImportingBudgetTypes(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("companyId", companyId);
      formData.append("budgetScope", budgetScope);
      const res = await fetch("/api/purchase/budget-types/import", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      loadBudgetTypes(companyId, budgetScope);
      const msg = `Import complete: ${data.created} created, ${data.updated} updated.`;
      if (data.errors?.length > 0) {
        toast.warning(`${msg} ${data.errors.length} row(s) had errors.`);
      } else {
        toast.success(msg);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to import budget types");
    } finally {
      setImportingBudgetTypes(false);
      if (budgetTypeFileInputRef.current) budgetTypeFileInputRef.current.value = "";
    }
  };

  const resetBudgetTypeForm = () => {
    setBudgetTypeForm({
      code: "",
      name: "",
      description: "",
      displayOrder: 0,
      isActive: true,
      level: 2,
      parentId: "",
    });
    setEditingBudgetType(null);
    setShowBudgetTypeForm(false);
  };

  const formatCurrency = (amount: number, currency: string = "USD") =>
    formatBudgetCurrency(amount, currency);

  const getStatusBadge = (entry: BudgetEntry) => {
    if (!entry.status) return null;
    
    if (entry.status === "EXCEEDED") {
      return <Badge className="bg-destructive">Exceeded</Badge>;
    } else if (entry.status === "WARNING") {
      return <Badge className="bg-warning">Warning</Badge>;
    } else {
      return <Badge className="bg-success">On Track</Badge>;
    }
  };

  const handleDownloadExcel = async () => {
    if (!selectedVesselId) {
      toast.error("Please select a vessel to export");
      return;
    }

    try {
      const params = new URLSearchParams();
      params.append("vesselId", selectedVesselId);
      params.append("year", selectedYearStart.toString());
      params.append("yearEnd", selectedYearEnd.toString());
      params.append("monthFrom", selectedMonthStart.toString());
      params.append("monthTo", selectedMonthEnd.toString());
      params.append("actualsSource", actualsSource);
      params.append("postingBasis", postingBasis);
      params.append("budgetScope", fixedBudgetScope ?? budgetScope);
      if (effectiveDryDockProjectId) {
        params.append("dryDockProjectId", effectiveDryDockProjectId);
      }
      if (selectedRequisitionType !== "all") {
        params.append("requisitionType", selectedRequisitionType);
      }
      if (selectedMachineryInstanceIds.length > 0) {
        params.append("machineryInstanceIds", selectedMachineryInstanceIds.join(","));
      }
      if (selectedL1BudgetTypeIds.length > 0) {
        params.append("l1BudgetTypeIds", selectedL1BudgetTypeIds.join(","));
      }

      const response = await fetch(`/api/purchase/budgets/monitor/export?${params.toString()}`, {
        credentials: "include",
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Budget_Monitor_${selectedRangeLabel.replace(/\s+/g, "_")}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("Excel exported successfully");
      } else {
        toast.error("Failed to export Excel");
      }
    } catch (error) {
      console.error("Error exporting Excel:", error);
      toast.error("Error exporting Excel");
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedVesselId) {
      toast.error("Please select a vessel to generate the report");
      return;
    }

    try {
      const params = new URLSearchParams();
      params.append("vesselId", selectedVesselId);
      params.append("year", selectedYearStart.toString());
      params.append("yearEnd", selectedYearEnd.toString());
      params.append("monthFrom", selectedMonthStart.toString());
      params.append("monthTo", selectedMonthEnd.toString());
      params.append("actualsSource", actualsSource);
      params.append("postingBasis", postingBasis);
      params.append("budgetScope", fixedBudgetScope ?? budgetScope);

      const response = await fetch(`/api/purchase/budgets/performance-report?${params}`, {
        credentials: "include",
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Budget_Performance_${selectedRangeLabel.replace(/\s+/g, "_")}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("PDF downloaded successfully");
      } else {
        toast.error("Failed to generate PDF");
      }
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error("Error downloading PDF");
    }
  };

  const handleSendPDF = async () => {
    if (!selectedVesselId) {
      toast.error("Please select a vessel");
      return;
    }
    if (!emailRecipient) {
      toast.error("Please enter recipient email");
      return;
    }

    setSendingEmail(true);
    try {
      const response = await fetch("/api/purchase/budgets/performance-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vesselId: selectedVesselId,
          year: selectedYearStart.toString(),
          yearEnd: selectedYearEnd.toString(),
          monthFrom: selectedMonthStart.toString(),
          monthTo: selectedMonthEnd.toString(),
          actualsSource,
          postingBasis,
          budgetScope: fixedBudgetScope ?? budgetScope,
          recipientEmail: emailRecipient,
          subject: emailSubject || undefined,
          message: emailMessage || undefined,
        }),
      });

      if (response.ok) {
        toast.success("PDF sent successfully");
        setShowEmailDialog(false);
        setEmailRecipient("");
        setEmailSubject("");
        setEmailMessage("");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to send PDF");
      }
    } catch (error) {
      console.error("Error sending PDF:", error);
      toast.error("Error sending PDF");
    } finally {
      setSendingEmail(false);
    }
  };

  return (<PageReadyGate ready={ready}>
    <div className="space-y-4">
      <main className="mx-auto w-[98%] max-w-[98vw] py-4">
        <div className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{pageTitle}</h1>
              <p className="text-foreground mt-1">
                {pageDescription ??
                  (isDryDockBudget
                    ? projectScoped
                      ? "Define and monitor DD-* budgets for the selected dry dock project. Amounts are stored per project and vessel."
                      : "Define and monitor dry dock budgets by DD-* Level 2 codes (e.g. DD-1010) under dry dock Level 1 groups (e.g. DD-1000)."
                    : "Define and monitor vessel budgets by Level 2 codes (e.g. 1100 Crew Wages) grouped under Level 1 categories (e.g. 1000 Crew Expenses).")}
              </p>
            </div>
            {!scopeLocked && (
            <div className="flex items-center gap-3 rounded-lg border px-4 py-3 bg-card">
              <span
                className={
                  !isDryDockBudget ? "text-sm font-medium text-foreground" : "text-sm text-muted-foreground"
                }
              >
                {PURCHASE_BUDGET_SCOPE_LABELS.NORMAL}
              </span>
              <Switch
                checked={isDryDockBudget}
                disabled={importingBudgetTypes}
                onCheckedChange={(checked) =>
                  setBudgetScope(
                    checked ? PURCHASE_BUDGET_SCOPE.DRY_DOCK : PURCHASE_BUDGET_SCOPE.NORMAL
                  )
                }
                aria-label="Toggle between normal and dry dock budget"
              />
              <span
                className={
                  isDryDockBudget ? "text-sm font-medium text-foreground" : "text-sm text-muted-foreground"
                }
              >
                {PURCHASE_BUDGET_SCOPE_LABELS.DRY_DOCK}
              </span>
            </div>
            )}
          </div>
          {!canEditBudget && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You have view-only access (level 28+). Defining or editing budgets and categories requires access level 40 or higher.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:gap-3">
              <div className="min-w-0 space-y-1.5 xl:w-[min(280px,100%)] xl:shrink-0">
                <Label>Vessel</Label>
                <Select
                  value={selectedVesselId || ""}
                  onValueChange={setSelectedVesselId}
                  disabled={vesselLoading}
                >
                  <SelectTrigger width="vessel">
                    <SelectValue placeholder="Select vessel" />
                  </SelectTrigger>
                  <SelectContent>
                    {vessels.map((vessel) => (
                      <SelectItem key={vessel.id} value={vessel.id}>
                        {vessel.name} ({vessel.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 xl:shrink-0">
                <Label>Year–Month (from)</Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedYearStart.toString()}
                    onValueChange={(v) => handleYearStartChange(parseInt(v, 10))}
                  >
                    <SelectTrigger width="sm" className="w-[96px]">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {budgetYearOptions.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={selectedMonthStart.toString()}
                    onValueChange={(v) => handleMonthStartChange(parseInt(v, 10))}
                  >
                    <SelectTrigger width="md" className="min-w-[140px]">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUDGET_MONTH_OPTIONS.map((month) => (
                        <SelectItem key={month.value} value={month.value.toString()}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5 xl:shrink-0">
                <Label>Year–Month (to)</Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedYearEnd.toString()}
                    onValueChange={(v) => handleYearEndChange(parseInt(v, 10))}
                  >
                    <SelectTrigger width="sm" className="w-[96px]">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {budgetYearOptions
                        .filter((year) => year >= selectedYearStart)
                        .map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={selectedMonthEnd.toString()}
                    onValueChange={(v) => handleMonthEndChange(parseInt(v, 10))}
                  >
                    <SelectTrigger width="md" className="min-w-[140px]">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUDGET_MONTH_OPTIONS.map((month) => (
                        <SelectItem key={month.value} value={month.value.toString()}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex shrink-0 flex-row flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  disabled={importingBudgetTypes}
                  onClick={() =>
                    activeTab === "define" ? loadDefineBudgetData() : loadMonitorData()
                  }
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  disabled={importingBudgetTypes}
                  onClick={handleResetFilters}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset Filter
                </Button>
                {budgetDeclarationNumber ? (
                  <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Budget No. </span>
                    <span className="font-mono font-semibold text-foreground">
                      {budgetDeclarationNumber}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">Selected period: {selectedRangeLabel}</p>

            {(isDryDockBudget || projectScoped) ? (
              <div className="flex flex-col gap-4 border-t border-border/60 pt-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
                {isDryDockBudget || projectScoped ? (
                  <div className="min-w-0 space-y-1.5 sm:min-w-[240px] sm:flex-1">
                    <Label>
                      Dry dock project
                      {!projectScoped ? " (optional)" : ""}
                    </Label>
                    <Select
                      value={
                        selectedDryDockProjectId
                          ? selectedDryDockProjectId
                          : projectScoped
                            ? ""
                            : "__vessel_level__"
                      }
                      onValueChange={(v) =>
                        setSelectedDryDockProjectId(v === "__vessel_level__" ? "" : v)
                      }
                      disabled={!selectedVesselId || loadingProjects}
                    >
                      <SelectTrigger width="md">
                        <SelectValue
                          placeholder={
                            loadingProjects ? "Loading projects…" : "Select project"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {!projectScoped ? (
                          <SelectItem value="__vessel_level__">
                            Vessel-level dry dock budget
                          </SelectItem>
                        ) : null}
                        {dryDockProjects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.projectNumber} — {p.projectName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            if (importingBudgetTypes) return;
            setActiveTab(v as "define" | "monitor" | "types");
          }}
        >
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="monitor" disabled={importingBudgetTypes}>
              Budget Monitoring
            </TabsTrigger>
            <TabsTrigger value="define" disabled={importingBudgetTypes}>
              Define Budget
            </TabsTrigger>
            <TabsTrigger value="types" disabled={importingBudgetTypes}>
              Budget Categories
            </TabsTrigger>
          </TabsList>

          {/* Define Budget Tab */}
          <TabsContent value="define" className="space-y-6">
            {!selectedVesselId ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Please select a vessel to define budgets</p>
                </CardContent>
              </Card>
            ) : projectScoped && !selectedDryDockProjectId ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Select a dry dock project to define project budgets</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Load or define budget</CardTitle>
                    <CardDescription>
                      Search and select a previously defined budget to edit, or define a new budget using
                      the period filters above.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                      <div className="space-y-1.5">
                        <Label>Budget</Label>
                        <SearchableOptionSelect
                          value={selectedDeclarationCode || "__new__"}
                          onValueChange={(v) => applyDeclarationFilter(v === "__new__" ? "" : v)}
                          options={[
                            {
                              value: "__new__",
                              label: "Define new budget (manual period)",
                              keywords: "new manual create",
                            },
                            ...declarationSelectOptions,
                          ]}
                          placeholder={
                            declarationSelectOptions.length === 0
                              ? "No saved budgets yet"
                              : "Search saved budgets…"
                          }
                          searchPlaceholder="Search by budget no., period, or year…"
                          disabled={!selectedVesselId}
                          triggerClassName="min-w-0 w-full"
                        />
                      </div>
                      {selectedDeclaration && canEditBudget ? (
                        <Button
                          variant="outline"
                          onClick={() => applyDeclarationFilter(selectedDeclarationCode)}
                        >
                          <Edit2 className="mr-2 h-4 w-4" />
                          Edit selected budget
                        </Button>
                      ) : null}
                    </div>
                    {selectedDeclaration ? (
                      <Alert>
                        <Edit2 className="h-4 w-4" />
                        <AlertDescription>
                          Editing budget{" "}
                          <span className="font-mono font-semibold">
                            {buildDeclarationLabel(selectedDeclaration)}
                          </span>
                          . Update amounts in the matrix below, then click{" "}
                          <strong>Save budget changes</strong>.
                        </AlertDescription>
                      </Alert>
                    ) : null}
                  </CardContent>
                </Card>

                <BudgetDefineMatrix
                  key={`define-matrix-${selectedDeclarationCode}|${isDryDockBudget}`}
                  vesselId={selectedVesselId}
                  budgetYear={selectedYearStart}
                  budgetYearEnd={selectedYearEnd}
                  rangeFromMonth={selectedMonthStart}
                  rangeToMonth={selectedMonthEnd}
                  budgetScope={fixedBudgetScope ?? budgetScope}
                  dryDockProjectId={effectiveDryDockProjectId}
                  level1Types={level1BudgetTypes}
                  level2Types={level2BudgetTypes}
                  canEdit={canEditBudget}
                  onSaved={() => {
                    void loadDefineBudgetData();
                    void refreshDeclarations();
                  }}
                  onPeriodContextChange={handleDefinePeriodContextChange}
                  initialPeriodContext={definePeriodContext}
                  selectedDeclarationCode={selectedDeclarationCode || undefined}
                  isEditingExisting={Boolean(selectedDeclarationCode)}
                />

                {/* Existing Budgets Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Existing Budgets</CardTitle>
                    <CardDescription>
                      Allocated, consumed, and remaining by L1 — aligned with the budget period above
                      {canEditBudget ? " — edit or delete from the table" : " (read-only)"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">Loading budgets...</p>
                      </div>
                    ) : defineFilteredBudgets.length === 0 ? (
                      <div className="text-center py-12">
                        <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          No budgets for the selected period — use the matrix above to define allocated
                          budget
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                        <div className="flex flex-col gap-4 lg:col-span-4 xl:col-span-3">
                          <BudgetL1UtilizationCharts
                            overviewTotals={defineUtilizationOverview}
                            l1Groups={defineUtilizationByL1}
                            currency={budgetsSummaryCurrency}
                            formatCurrency={formatCurrency}
                            loading={loading}
                          />
                        </div>
                        <div className="min-w-0 space-y-2 lg:col-span-8 xl:col-span-9">
                          <p className="text-sm font-medium text-foreground">Full budget (L1 / L2)</p>
                          <BudgetGroupedEntryTable
                            entries={defineFilteredBudgets}
                            compact
                            showDerivedPeriodAmounts
                            formatDerivedAmount={formatDerivedBudgetAmount}
                            allottedHead={defineAllocatedHead}
                            extraHeads={
                              <>
                                <TableHead className="border-r">Period</TableHead>
                                <TableHead className="border-r">Currency</TableHead>
                                {canEditBudget ? (
                                  <TableHead className="border-r w-[100px]">Actions</TableHead>
                                ) : null}
                              </>
                            }
                            renderExtraColumns={(budget) => (
                              <>
                                <TableCell className="border-r text-sm text-muted-foreground">
                                  {formatBudgetPeriod(budget)}
                                </TableCell>
                                <TableCell className="border-r">{budget.currency}</TableCell>
                                {canEditBudget ? (
                                  <TableCell className="border-r">
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditBudget(budget)}
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteBudget(budget.id)}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                ) : null}
                              </>
                            )}
                            renderAllotted={(budget) =>
                              formatCurrency(
                                getBudgetAllocatedAmount(budget, defineChartPeriod),
                                budget.currency
                              )
                            }
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Monitor Budget Tab */}
          <TabsContent value="monitor" className="space-y-6">
            {!selectedVesselId && monitorViewMode !== "fleet" ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Please select a vessel to monitor budgets</p>
                </CardContent>
              </Card>
            ) : projectScoped && !selectedDryDockProjectId && monitorViewMode !== "fleet" ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Select a dry dock project to monitor project budgets</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Filters and Actions */}
                <Card variant="filter">
                  <CardContent className="space-y-3 pt-6">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Filters</p>
                      <p className="text-xs text-muted-foreground">
                        Budget vs actual consumption — all figures from defined budgets and live procurement data
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                      <div className="min-w-0 space-y-1.5">
                        <Label>Monitoring view</Label>
                        <Select
                          value={monitorViewMode}
                          onValueChange={(v) =>
                            setMonitorViewMode(
                              v as "vs_actual" | "monthly" | "cash_flow" | "l2_detail" | "fleet"
                            )
                          }
                        >
                          <SelectTrigger className="h-9 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="vs_actual">Budget vs actual (L1)</SelectItem>
                            <SelectItem value="monthly">Monthly matrix (B/A/V)</SelectItem>
                            <SelectItem value="cash_flow">Cash-flow forecast</SelectItem>
                            <SelectItem value="l2_detail">Detail by L2</SelectItem>
                            <SelectItem value="fleet">Fleet comparison</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <Label>Fund type</Label>
                        <Select
                          value={fundTypeFilter}
                          onValueChange={(v) =>
                            setFundTypeFilter(v as PurchaseBudgetFundType | "all")
                          }
                        >
                          <SelectTrigger className="h-9 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All funds</SelectItem>
                            {PURCHASE_BUDGET_FUND_TYPES.map((f) => (
                              <SelectItem key={f} value={f}>
                                {PURCHASE_BUDGET_FUND_TYPE_LABELS[f]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <Label>Budget version</Label>
                        <Select
                          value={budgetVersionId || "__live__"}
                          onValueChange={(v) =>
                            setBudgetVersionId(v === "__live__" ? "" : v)
                          }
                        >
                          <SelectTrigger className="h-9 w-full">
                            <SelectValue placeholder="Live budget" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__live__">Live (current)</SelectItem>
                            {budgetVersions.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                v{v.versionNumber} {v.status} · {v.budgetPeriodCode}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <Label>Posting basis</Label>
                        <Select
                          value={postingBasis}
                          onValueChange={(v) => setPostingBasis(v as BudgetPostingBasis)}
                        >
                          <SelectTrigger className="h-9 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(BUDGET_POSTING_BASIS_LABELS) as BudgetPostingBasis[]).map(
                              (key) => (
                                <SelectItem key={key} value={key}>
                                  {BUDGET_POSTING_BASIS_LABELS[key]}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <Label>Actuals basis</Label>
                        <Select
                          value={actualsSource}
                          onValueChange={(v) => setActualsSource(v as "po" | "invoice")}
                        >
                          <SelectTrigger className="h-9 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="po">Purchase orders</SelectItem>
                            <SelectItem value="invoice">Invoices</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {monitorViewMode === "fleet" ? (
                        <div className="min-w-0 space-y-1.5">
                          <Label>Fleet currency</Label>
                          <Select
                            value={fleetDisplayCurrency}
                            onValueChange={setFleetDisplayCurrency}
                          >
                            <SelectTrigger className="h-9 w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {COMMON_MARINE_CURRENCIES.map((c) => (
                                <SelectItem key={c.code} value={c.code}>
                                  {c.code}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}
                      </div>
                      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
                      <div className="min-w-0 flex-1 space-y-1.5 lg:min-w-[200px]">
                        <Label>Requisition type</Label>
                        <SearchableOptionSelect
                          value={selectedRequisitionType}
                          onValueChange={setSelectedRequisitionType}
                          options={requisitionTypeOptions}
                          placeholder="All Types"
                          searchPlaceholder="Search requisition type…"
                          triggerClassName="h-9 min-w-0 w-full"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5 lg:min-w-[200px]">
                        <Label>Machinery (for Spare/Service)</Label>
                        <OptimizedMultiSelect
                          options={machinerySelectOptions}
                          selectedValues={selectedMachineryInstanceIds}
                          onSelectionChange={setSelectedMachineryInstanceIds}
                          placeholder={
                            loadingMachinery
                              ? "Loading machinery…"
                              : machineryInstances.length === 0
                                ? "No machinery found"
                                : "All machinery"
                          }
                          searchPlaceholder="Search machinery…"
                          disabled={loadingMachinery || machineryInstances.length === 0}
                          className="h-9 w-full py-0"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5 lg:min-w-[200px]">
                        <Label>L1 budget code</Label>
                        <OptimizedMultiSelect
                          options={l1BudgetSelectOptions}
                          selectedValues={selectedL1BudgetTypeIds}
                          onSelectionChange={setSelectedL1BudgetTypeIds}
                          placeholder={
                            level1BudgetTypes.length === 0
                              ? "No L1 codes loaded"
                              : "All L1 categories"
                          }
                          searchPlaceholder="Search L1 budget code…"
                          disabled={level1BudgetTypes.length === 0}
                          className="h-9 w-full py-0"
                        />
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          onClick={handleDownloadExcel}
                          variant="outline"
                          className="h-9"
                          disabled={!selectedVesselId}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Export Excel
                        </Button>
                        <Button
                          onClick={handleDownloadPDF}
                          variant="outline"
                          className="h-9"
                          disabled={!selectedVesselId}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download PDF
                        </Button>
                        <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="h-9" disabled={!selectedVesselId}>
                              <Send className="h-4 w-4 mr-2" />
                              Send PDF
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Send Budget Performance Report</DialogTitle>
                              <DialogDescription>
                                Send the budget performance PDF report via email
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-1.5">
                                <Label>Recipient Email *</Label>
                                <Input
                                  type="email"
                                  value={emailRecipient}
                                  onChange={(e) => setEmailRecipient(e.target.value)}
                                  placeholder="recipient@example.com"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Subject</Label>
                                <Input
                                  value={emailSubject}
                                  onChange={(e) => setEmailSubject(e.target.value)}
                                  placeholder="Budget Performance Report"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Message</Label>
                                <Textarea
                                  value={emailMessage}
                                  onChange={(e) => setEmailMessage(e.target.value)}
                                  placeholder="Optional message..."
                                  rows={4}
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
                                  Cancel
                                </Button>
                                <Button onClick={handleSendPDF} disabled={sendingEmail || !emailRecipient}>
                                  {sendingEmail ? "Sending..." : "Send"}
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {monitorViewMode !== "fleet" && stats ? (
                  <BudgetExposureKpiStrip
                    stats={stats}
                    ytdMetrics={ytdMetrics}
                    accrualActual={accrualActual}
                    pmsForecastTotal={pmsForecastTotal}
                    formatCurrency={formatCurrency}
                  />
                ) : null}

                {monitorViewMode === "fleet" ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Fleet budget comparison</CardTitle>
                      <CardDescription>
                        All active vessels ranked by utilization — amounts converted to selected
                        display currency
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <p className="py-12 text-center text-muted-foreground">Loading fleet data…</p>
                      ) : fleetMonitorData ? (
                        <BudgetFleetMonitorTable
                          data={fleetMonitorData}
                          formatCurrency={formatCurrency}
                        />
                      ) : (
                        <p className="py-12 text-center text-muted-foreground">
                          No fleet budget data for the selected period
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ) : monitorViewMode === "vs_actual" ? (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <div className="lg:col-span-8 space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>Budget vs actual by L1 category</CardTitle>
                          <CardDescription>
                            Click a row or amount to drill down into requisitions and purchase orders
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {loading ? (
                            <p className="py-12 text-center text-muted-foreground">Loading…</p>
                          ) : (
                            <BudgetVsActualSummaryTable
                              rows={budgetVsActualL1}
                              currency={stats?.currency ?? "USD"}
                              formatCurrency={formatCurrency}
                              onDrilldown={(target) => openDrilldown(target)}
                            />
                          )}
                        </CardContent>
                      </Card>
                    </div>
                    <div className="lg:col-span-4">
                      <BudgetL1UtilizationCharts
                        overviewTotals={monitorUtilizationOverview}
                        l1Groups={monitorUtilizationByL1}
                        currency={stats?.currency ?? "USD"}
                        formatCurrency={formatCurrency}
                        loading={loading}
                      />
                    </div>
                  </div>
                ) : monitorViewMode === "cash_flow" ? (
                  <div className="space-y-4">
                    {monthlyMonitorData && cashFlowForecast ? (
                      <BudgetCashFlowForecastChart
                        monthly={monthlyMonitorData}
                        cashFlow={cashFlowForecast}
                        formatCurrency={formatCurrency}
                        loading={loading}
                      />
                    ) : (
                      <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                          {loading
                            ? "Loading cash-flow forecast…"
                            : "No cash-flow forecast data for the selected period"}
                        </CardContent>
                      </Card>
                    )}
                    {selectedVesselId ? (
                      <BudgetAccrualPanel
                        vesselId={selectedVesselId}
                        year={selectedYearStart}
                        yearEnd={selectedYearEnd}
                        budgetScope={fixedBudgetScope ?? budgetScope}
                        dryDockProjectId={effectiveDryDockProjectId}
                        canEdit={canEditBudget}
                        onChanged={() => void loadMonitorData()}
                      />
                    ) : null}
                  </div>
                ) : monitorViewMode === "monthly" ? (
                  <div className="space-y-4">
                    {monthlyMonitorData ? (
                      <BudgetMonthlyTrendChart
                        data={monthlyMonitorData}
                        formatCurrency={formatCurrency}
                        loading={loading}
                      />
                    ) : null}
                    <Card>
                      <CardContent className="pt-6">
                        {loading ? (
                          <div className="py-12 text-center">
                            <p className="text-muted-foreground">Loading monthly budget vs actual…</p>
                          </div>
                        ) : monthlyMonitorData ? (
                          <BudgetMonthlyMonitorTable
                            data={monthlyMonitorData}
                            formatCurrency={formatCurrency}
                            title={
                              isDryDockBudget
                                ? "Dry dock — monthly budget vs actual"
                                : "Operating expenses — monthly budget vs actual"
                            }
                            onMonthDrilldown={(target, monthKey) => openDrilldown(target, monthKey)}
                          />
                        ) : (
                          <div className="py-12 text-center">
                            <DollarSign className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                            <p className="text-muted-foreground">No monthly data for this period</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>Detail by L2 budget code</CardTitle>
                      <CardDescription>
                        Allocated, committed, actual, and remaining per L2 line
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <div className="text-center py-12">
                          <p className="text-muted-foreground">Loading budget data…</p>
                        </div>
                      ) : budgets.length === 0 ? (
                        <div className="text-center py-12">
                          <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">
                            No defined budgets for this vessel and period
                          </p>
                        </div>
                      ) : (
                        <BudgetGroupedEntryTable
                          entries={paginatedBudgets}
                          allottedHead="Allocated"
                          extraHeads={
                            <>
                              <TableHead className="border-r">Period</TableHead>
                              <TableHead className="border-r text-right">Committed</TableHead>
                              <TableHead className="border-r text-right">Spent</TableHead>
                              <TableHead className="border-r text-right">Remaining</TableHead>
                              <TableHead className="border-r text-right">Usage %</TableHead>
                              <TableHead>Status</TableHead>
                            </>
                          }
                          renderExtraColumns={(budget) => (
                            <>
                              <TableCell className="border-r text-sm text-muted-foreground">
                                {budget.period}
                              </TableCell>
                              <TableCell className="border-r text-right tabular-nums">
                                {formatCurrency(budget.committedAmount || 0, budget.currency)}
                              </TableCell>
                              <TableCell className="border-r text-right tabular-nums">
                                {formatCurrency(budget.spentAmount || 0, budget.currency)}
                              </TableCell>
                              <TableCell className="border-r text-right tabular-nums">
                                {formatCurrency(budget.remainingAmount || 0, budget.currency)}
                              </TableCell>
                              <TableCell className="border-r text-right tabular-nums">
                                {budget.percentageUsed?.toFixed(1) || 0}%
                              </TableCell>
                              <TableCell>{getStatusBadge(budget)}</TableCell>
                            </>
                          )}
                          renderAllotted={(budget) =>
                            formatCurrency(budget.allocatedAmount || 0, budget.currency)
                          }
                        />
                      )}
                      {!loading && budgets.length > 0 ? (
                        <div className="mt-4">
                          <TablePagination
                            page={currentPage}
                            pageSize={itemsPerPage}
                            total={budgets.length}
                            onPageChange={setCurrentPage}
                            onPageSizeChange={(size) => {
                              setItemsPerPage(size);
                              setCurrentPage(1);
                            }}
                          />
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                )}

                <BudgetTransactionDrilldown
                  open={drilldownOpen}
                  onOpenChange={setDrilldownOpen}
                  target={drilldownTarget}
                  monthKey={drilldownMonthKey}
                  queryParams={monitorQueryParams}
                  formatCurrency={formatCurrency}
                />
              </>
            )}
          </TabsContent>

          {/* Budget Types Tab */}
          <TabsContent value="types" className="space-y-6">
            {!selectedVesselId ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Please select a vessel to manage budget types</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Budget Type Form */}
                {canEditBudget && (showBudgetTypeForm || editingBudgetType) && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{editingBudgetType ? "Edit Budget Category" : "Create Budget Category"}</CardTitle>
                      <CardDescription>
                        {isDryDockBudget
                          ? "Level 1 = dry dock group (e.g. DD-1000). Level 2 = DD line used on dry dock requisitions (e.g. DD-1010)."
                          : "Level 1 = group (e.g. 1000 Crew Expenses). Level 2 = budget line used on requisitions (e.g. 1100 Crew Wages)."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label>Level *</Label>
                          <Select
                            value={String(budgetTypeForm.level)}
                            onValueChange={(v) =>
                              setBudgetTypeForm({
                                ...budgetTypeForm,
                                level: parseInt(v, 10) as 1 | 2,
                                parentId: v === "1" ? "" : budgetTypeForm.parentId,
                              })
                            }
                            disabled={!!editingBudgetType}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Level 1 — Group (e.g. 1000)</SelectItem>
                              <SelectItem value="2">Level 2 — Budget line (e.g. 1100)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {budgetTypeForm.level === 2 && (
                          <div className="space-y-1.5">
                            <Label>Level 1 Group *</Label>
                            <Select
                              value={budgetTypeForm.parentId}
                              onValueChange={(v) => setBudgetTypeForm({ ...budgetTypeForm, parentId: v })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select Level 1 group" />
                              </SelectTrigger>
                              <SelectContent>
                                {level1BudgetTypes.map((group) => (
                                  <SelectItem key={group.id} value={group.id}>
                                    {group.code} — {group.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <Label>Code *</Label>
                          <Input
                            value={budgetTypeForm.code}
                            onChange={(e) => {
                              const raw = e.target.value.trim();
                              const code = /^\d*$/.test(raw) ? raw : raw.toUpperCase().replace(/\s+/g, "_");
                              setBudgetTypeForm({ ...budgetTypeForm, code });
                            }}
                            placeholder={
                              isDryDockBudget
                                ? budgetTypeForm.level === 1
                                  ? "DD-1000"
                                  : "DD-1010"
                                : budgetTypeForm.level === 1
                                  ? "1000"
                                  : "1100"
                            }
                            disabled={!!editingBudgetType}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Four-digit numeric code (recommended). Used as budget code on requisitions.
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Name *</Label>
                          <Input
                            value={budgetTypeForm.name}
                            onChange={(e) => setBudgetTypeForm({ ...budgetTypeForm, name: e.target.value })}
                            placeholder="Flag Documents"
                          />
                        </div>
                        <div className="md:col-span-2 space-y-1.5">
                          <Label>Description</Label>
                          <Textarea
                            value={budgetTypeForm.description}
                            onChange={(e) => setBudgetTypeForm({ ...budgetTypeForm, description: e.target.value })}
                            placeholder="Optional description..."
                            rows={3}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Display Order</Label>
                          <Input
                            type="number"
                            value={budgetTypeForm.displayOrder}
                            onChange={(e) => setBudgetTypeForm({ ...budgetTypeForm, displayOrder: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="flex items-center space-x-2 pt-6">
                          <input
                            type="checkbox"
                            id="isActive"
                            checked={budgetTypeForm.isActive}
                            onChange={(e) => setBudgetTypeForm({ ...budgetTypeForm, isActive: e.target.checked })}
                            className="rounded"
                          />
                          <Label htmlFor="isActive">Active</Label>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleSaveBudgetType} disabled={importingBudgetTypes}>
                          <Save className="h-4 w-4 mr-2" />
                          {editingBudgetType ? "Update" : "Create"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={resetBudgetTypeForm}
                          disabled={importingBudgetTypes}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Budget Types List */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Budget Categories</CardTitle>
                        <CardDescription>
                          {isDryDockBudget
                            ? "Dry dock DD-* codes for your company. Sync from global master, or download/upload the dry dock Excel template."
                            : "Two-level codes for your company. Download the Excel template, edit if needed, then upload."}
                        </CardDescription>
                      </div>
                      {!showBudgetTypeForm && !editingBudgetType && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={importingBudgetTypes || syncingFromMaster}
                            onClick={handleDownloadBudgetTypeTemplate}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download template
                          </Button>
                          {canEditBudget && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={importingBudgetTypes || syncingFromMaster}
                                onClick={handleSyncFromMaster}
                              >
                                {syncingFromMaster ? "Syncing…" : "Sync from master DB"}
                              </Button>
                              <input
                                ref={budgetTypeFileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                className="hidden"
                                disabled={importingBudgetTypes}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImportBudgetTypes(file);
                                }}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={importingBudgetTypes || syncingFromMaster}
                                onClick={() => budgetTypeFileInputRef.current?.click()}
                              >
                                {importingBudgetTypes ? (
                                  <span className="inline-flex items-center gap-2">
                                    <ActiniumLoader size="sm" showText={false} showDots />
                                    Importing…
                                  </span>
                                ) : (
                                  <>
                                    <Upload className="h-4 w-4 mr-2" />
                                    Upload Excel
                                  </>
                                )}
                              </Button>
                              <Button
                                disabled={importingBudgetTypes || syncingFromMaster}
                                onClick={() => setShowBudgetTypeForm(true)}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Budget Type
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="relative">
                    {importingBudgetTypes && (
                      <div
                        className="absolute inset-0 z-20 flex items-center justify-center rounded-md bg-background/85 backdrop-blur-[1px]"
                        aria-live="polite"
                        aria-busy="true"
                      >
                        <ActiniumLoader size="md" text="Importing budget categories…" showDots />
                      </div>
                    )}
                    {loadingTypes ? (
                      <div className="text-center py-12">
                        <ActiniumLoader size="md" text="Loading budget categories…" showDots />
                      </div>
                    ) : budgetTypes.length === 0 ? (
                      <div className="text-center py-12">
                        <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground mb-4">No budget types defined yet</p>
                        <div className="flex flex-wrap justify-center gap-2">
                          <Button
                            variant="outline"
                            disabled={importingBudgetTypes || syncingFromMaster}
                            onClick={handleDownloadBudgetTypeTemplate}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download template
                          </Button>
                          {canEditBudget && (
                            <>
                              <Button
                                variant="outline"
                                onClick={handleSyncFromMaster}
                                disabled={importingBudgetTypes || syncingFromMaster}
                              >
                                {syncingFromMaster ? "Syncing…" : "Sync from master DB"}
                              </Button>
                              <Button
                                variant="outline"
                                disabled={importingBudgetTypes || syncingFromMaster}
                                onClick={() => budgetTypeFileInputRef.current?.click()}
                              >
                                {importingBudgetTypes ? (
                                  <span className="inline-flex items-center gap-2">
                                    <ActiniumLoader size="sm" showText={false} showDots />
                                    Importing…
                                  </span>
                                ) : (
                                  <>
                                    <Upload className="h-4 w-4 mr-2" />
                                    Upload Excel
                                  </>
                                )}
                              </Button>
                              <Button
                                disabled={importingBudgetTypes || syncingFromMaster}
                                onClick={() => setShowBudgetTypeForm(true)}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Create First Budget Type
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                      <TableSerialHead />
                              <TableHead>Level</TableHead>
                              <TableHead>Code</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead>Group</TableHead>
                              <TableHead>Order</TableHead>
                              <TableHead>Status</TableHead>
                              {canEditBudget && <TableHead>Actions</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {budgetTypes.map((type, index) => (
                              <TableRow
                                key={type.id}
                                className={type.level === 1 ? "bg-muted/40 font-medium" : undefined}
                              >
                                <TableSerialCell serialNo={index + 1} />
                                <TableCell>
                                  <Badge variant={type.level === 1 ? "default" : "outline"}>
                                    L{type.level}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-sm">{type.code}</TableCell>
                                <TableCell className={type.level === 2 ? "pl-6" : ""}>{type.name}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {type.level === 2 && type.parent
                                    ? `${type.parent.code} ${type.parent.name}`
                                    : type.level === 1
                                      ? "—"
                                      : "-"}
                                </TableCell>
                                <TableCell>{type.displayOrder}</TableCell>
                                <TableCell>
                                  {type.isActive ? (
                                    <Badge className="bg-success">Active</Badge>
                                  ) : (
                                    <Badge variant="secondary">Inactive</Badge>
                                  )}
                                </TableCell>
                                {canEditBudget && (
                                  <TableCell>
                                    <div className="flex gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={importingBudgetTypes}
                                        onClick={() => {
                                          setEditingBudgetType(type);
                                          setBudgetTypeForm({
                                            code: type.code,
                                            name: type.name,
                                            description: type.description || "",
                                            displayOrder: type.displayOrder,
                                            isActive: type.isActive,
                                            level: (type.level === 1 ? 1 : 2) as 1 | 2,
                                            parentId: type.parentId || type.parent?.id || "",
                                          });
                                          setShowBudgetTypeForm(true);
                                        }}
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={importingBudgetTypes}
                                        onClick={() => handleDeleteBudgetType(type.id)}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
        </PageReadyGate>
  );
}
