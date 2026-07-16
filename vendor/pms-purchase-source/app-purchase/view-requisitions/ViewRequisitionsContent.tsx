"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { persistLastVesselId, readLastVesselId } from "@/lib/performance/last-vessel-preference";
import { useRequisitionsPaginated } from "@/hooks/useRequisitionsPaginated";
import { useRequisitionStats } from "@/hooks/useRequisitionStats";
import { quoteCreatePoPath, quoteSendPoPath } from "@/lib/procurement/quote-po-navigation";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RequisitionStatusBadge } from "@/components/requisition/RequisitionStatusBadge";
import { RequisitionTypeBadge } from "@/components/requisition/RequisitionTypeBadge";
import { MultiSelectDropdown, MultiSelectOption } from "@/components/ui/multi-select-dropdown";
import {
  ClearableInput,
  FilterFieldShell,
  filterMultiSelectClearClass,
  filterTriggerClearPadding,
} from "@/components/ui/clearable-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequisitionTable } from "@/components/RequisitionTable";
import { RequisitionDetailsModal } from "@/components/RequisitionDetailsModal";
import ActiniumLoader from "@/components/ActiniumLoader";
import { useVesselRestriction } from "@/hooks/useVesselRestriction";
import { useVessels } from "@/hooks/useStaticData";
import { getCachedUserData, cacheUserData } from "@/lib/cookie-cache";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { 
  FileText, 
  BarChart3, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  Package,
  TrendingUp,
  Ship,
  Plus,
  Filter,
  X,
  Search,
  Eye,
  List,
  Grid3x3,
  Calendar as CalendarIcon,
} from "lucide-react";
import {
  Requisition,
  RequisitionStatus,
  GenerationStatus,
  REQUISITION_STATUS_LABELS,
  REQUISITION_TYPE_LABELS,
  canCreateRequisition,
} from "@/lib/types/requisition";
import { isRequisitionPendingApproval } from "@/lib/procurement/requisition-status-reconcile";
import type { PaginatedRequisitions } from "@/lib/requisitions-list-query";
import { toast } from "sonner";
import { TablePagination, type TablePageSize } from "@/components/ui/table-pagination";
import { DEFAULT_TABLE_PAGE_SIZE } from "@/lib/table-page-size";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import { subscribePendingTasksChanged } from "@/lib/pending-tasks-coordinator";
import { invalidateRequisitionsListQueries } from "@/lib/requisitions-list-invalidation";
import {
  buildMasterApprovalHref,
  buildViewRequisitionsRestorePath,
  loadViewRequisitionsFiltersSnapshot,
  saveViewRequisitionsFiltersSnapshot,
  clearViewRequisitionsFiltersSnapshot,
  VIEW_REQUISITIONS_RESTORE_QUERY,
} from "@/lib/purchase/view-requisitions-filter-snapshot";

export function ViewRequisitionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const fromNotification = searchParams.get("from") === "notification";
  const highlightRequisitionId = searchParams.get("highlightRequisitionId");
  const requisitionFromUrl = searchParams.get("req");
  const vesselIdFromUrl = searchParams.get("vesselId");
  const headingFromUrl = searchParams.get("heading") ?? searchParams.get("headerFilter");
  const { markSuccess } = usePageBootstrap();
  const { isRestricted, restrictedVessel, loading: restrictionLoading } = useVesselRestriction();
  
  // Use optimized hooks for static data with caching
  const { data: vesselsData, isLoading: vesselsLoading } = useVessels({ limit: 100, isActive: true });
  const allVessels = useMemo(() => (Array.isArray(vesselsData) ? vesselsData : []), [vesselsData]);
  
  const [selectedVessel, setSelectedVessel] = useState<string>("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<TablePageSize>(DEFAULT_TABLE_PAGE_SIZE);
  const [userReady, setUserReady] = useState(() => !!getCachedUserData());
  const [isPageReady, setIsPageReady] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [reqNumberFilter, setReqNumberFilter] = useState("");
  const [headerFilter, setHeaderFilter] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [hasDeclinedSuppliers, setHasDeclinedSuppliers] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [reasonForRequisitionFilter, setReasonForRequisitionFilter] = useState<string>("all");
  const [poIssuedFilter, setPoIssuedFilter] = useState<string>("all");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userAccessLevel, setUserAccessLevel] = useState<number | undefined>(undefined);
  const [pendingApprovalRequisitions, setPendingApprovalRequisitions] = useState<Requisition[]>([]);
  const [isPendingApprovalLoading, setIsPendingApprovalLoading] = useState(false);
  const [hasLoadedPendingApprovals, setHasLoadedPendingApprovals] = useState(false);
  // Pending approvals section is hidden by default; only shown when user clicks "Approval (N)" in header
  const [showApprovalSection, setShowApprovalSection] = useState<boolean>(() => false);
  const [selectedRequisitionId, setSelectedRequisitionId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const vesselInitializedRef = useRef(false);
  const approvalSectionRef = useRef<HTMLDivElement>(null);
  const bootstrapCompleteRef = useRef(false);
  const taskDeepLinkAppliedRef = useRef(false);

  useEffect(() => {
    if (taskDeepLinkAppliedRef.current) return;
    if (requisitionFromUrl) {
      setReqNumberFilter(requisitionFromUrl);
      setShowFilters(true);
      taskDeepLinkAppliedRef.current = true;
      return;
    }
    if (highlightRequisitionId) {
      setSearchTerm(highlightRequisitionId);
      taskDeepLinkAppliedRef.current = true;
    }
  }, [requisitionFromUrl, highlightRequisitionId]);
  const bootstrapStartedRef = useRef(false);

  const listFilters = useMemo(
    () => ({
      vesselIds: selectedVessels.slice(0, 50),
      page,
      limit,
      searchTerm,
      reqNumberFilter,
      headerFilter,
      selectedTypes,
      selectedStatuses,
      dateFrom,
      dateTo,
      hasDeclinedSuppliers,
      priorityFilter,
      reasonForRequisitionFilter,
      poIssuedFilter,
    }),
    [
      selectedVessels,
      page,
      limit,
      searchTerm,
      reqNumberFilter,
      headerFilter,
      selectedTypes,
      selectedStatuses,
      dateFrom,
      dateTo,
      hasDeclinedSuppliers,
      priorityFilter,
      reasonForRequisitionFilter,
      poIssuedFilter,
    ]
  );

  const listQueryEnabled = isPageReady && selectedVessels.length > 0;
  const {
    data: listData,
    isFetching: isListFetching,
    isError: isListError,
  } = useRequisitionsPaginated(listFilters, listQueryEnabled);
  const { data: statsData } = useRequisitionStats(
    selectedVessels.slice(0, 50),
    listQueryEnabled
  );

  const requisitions = listData?.requisitions ?? [];
  const total = listData?.total ?? 0;
  const totalPages = listData?.totalPages ?? 0;
  const isTableLoading = isListFetching && requisitions.length === 0 && selectedVessels.length > 0;
  const statistics = statsData ?? {
    total: 0,
    drafts: 0,
    created: 0,
    approved: 0,
    inProcess: 0,
    completed: 0,
    pendingApproval: 0,
  };
  const approvalButtonCount = hasLoadedPendingApprovals
    ? pendingApprovalRequisitions.length
    : statistics.pendingApproval;

  const invalidateRequisitions = useCallback(() => {
    void invalidateRequisitionsListQueries(queryClient);
  }, [queryClient]);

  // When arriving from defect report (or any link with vesselId), set vessel immediately to avoid "vessel not selected" flash
  useEffect(() => {
    if (vesselIdFromUrl) {
      setSelectedVessel(vesselIdFromUrl);
      setSelectedVessels([vesselIdFromUrl]);
    }
  }, [vesselIdFromUrl]);

  useEffect(() => {
    if (headingFromUrl != null && headingFromUrl !== "") {
      setHeaderFilter(headingFromUrl);
    }
  }, [headingFromUrl]);

  // Multi-select options - defined after state initialization
  const statusOptions: MultiSelectOption[] = Object.entries(REQUISITION_STATUS_LABELS).map(([status, label]) => ({
    value: status,
    label: label,
    description: `Filter by ${label.toLowerCase()}`
  }));

  const typeOptions: MultiSelectOption[] = Object.entries(REQUISITION_TYPE_LABELS).map(([type, label]) => ({
    value: type,
    label: label,
    description: `Filter by ${label.toLowerCase()}`
  }));

  // Filter vessels list if user is restricted
  const availableVessels = useMemo(() => {
    if (isRestricted && restrictedVessel) {
      return [restrictedVessel];
    }
    return allVessels;
  }, [allVessels, isRestricted, restrictedVessel]);

  const vesselOptions: MultiSelectOption[] = availableVessels.map((vessel: any) => ({
    value: vessel.id,
    label: vessel.name,
  }));

  // Fetch current user from API with cookie caching
  useEffect(() => {
    let cancelled = false;
    let refreshController: AbortController | null = null;

    const fetchUser = async () => {
      try {
        const cachedUser = getCachedUserData();

        if (cachedUser) {
          if (!cancelled) {
            setCurrentUser(cachedUser);
            setUserAccessLevel(cachedUser.designationAccessLevel);
            setUserReady(true);
          }
          refreshController = new AbortController();
          fetch("/api/profile/basic", {
            credentials: "include",
            signal: refreshController.signal,
          })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (cancelled || !data?.user) return;
              cacheUserData(data.user);
              if (JSON.stringify(cachedUser) !== JSON.stringify(data.user)) {
                setCurrentUser(data.user);
              }
            })
            .catch(() => {});
          return;
        }

        const response = await fetch("/api/profile/basic", {
          credentials: "include",
        });
        if (cancelled) return;

        if (response.ok) {
          const data = await response.json();
          const user = data.user;
          setCurrentUser(user);
          setUserAccessLevel(user.designationAccessLevel);
          cacheUserData(user);
        } else {
          console.error("Failed to fetch user");
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching user:", error);
        }
      } finally {
        if (!cancelled) {
          setUserReady(true);
        }
      }
    };

    fetchUser();
    return () => {
      cancelled = true;
      refreshController?.abort();
    };
  }, []);

  const canUserCreate = canCreateRequisition(userAccessLevel);
  const showAdminOnlyUi = isAdminEquivalentAccessLevel(userAccessLevel);
  const accessLevelForChecks = userAccessLevel ?? 0;
  const canApprove = [37, 39].includes(accessLevelForChecks) || [50, 99, 100].includes(accessLevelForChecks);
  const canSendForQuote = userAccessLevel === 32 || userAccessLevel === 33 || [50, 99, 100].includes(accessLevelForChecks);
  const canCancel = userAccessLevel === 32 || userAccessLevel === 33 || userAccessLevel === 39 || [50, 99, 100].includes(accessLevelForChecks);
  const canReturn = userAccessLevel === 39 || [50, 99, 100].includes(accessLevelForChecks);

  // Vessels are now loaded via useVessels hook - no need for fetchVessels

  // Load saved vessel preference from localStorage
  const loadSavedVesselPreference = (): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('requisitionPageSelectedVessel');
      return saved || null;
    } catch (error) {
      console.error('Error loading saved vessel preference:', error);
      return null;
    }
  };

  // Save vessel preference to localStorage
  const saveVesselPreference = (vesselId: string) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('requisitionPageSelectedVessel', vesselId);
      persistLastVesselId(vesselId);
    } catch (error) {
      console.error('Error saving vessel preference:', error);
    }
  };

  // Fetch requisitions pending approval: level 37 sees NEW_REQ (approve to send for quote); level 39/50 see NOT_READY+CREATED and NEW_REQ
  const fetchPendingApprovalRequisitions = useCallback(async () => {
    if (!canApprove || userAccessLevel === undefined) return;

    try {
      setIsPendingApprovalLoading(true);
      const { fetchJsonWithTimeout } = await import('@/lib/utils/fetch-with-timeout');
      let allPending: Requisition[] = [];

      if (userAccessLevel === 37) {
        // Access level 37: only approve NEW_REQ -> REQ_APPROVED (before send for quote)
        const params = new URLSearchParams({
          status: RequisitionStatus.NEW_REQ,
          limit: '100',
        });
        const data = await fetchJsonWithTimeout<PaginatedRequisitions>(`/api/requisitions?${params}`, {
          timeout: 10000,
          credentials: 'include',
        });
        allPending = data.requisitions || [];
        allPending = allPending.filter((r) => !r.parentRequisitionId);
      } else {
        // Access level 39 or 50: see both NOT_READY (CREATED) and NEW_REQ
        const [notReadyRes, newReqRes] = await Promise.all([
          fetchJsonWithTimeout<PaginatedRequisitions>(
            `/api/requisitions?${new URLSearchParams({
              status: RequisitionStatus.NOT_READY,
              generationStatus: GenerationStatus.CREATED,
              limit: '100',
            })}`,
            { timeout: 10000, credentials: 'include' }
          ),
          fetchJsonWithTimeout<PaginatedRequisitions>(
            `/api/requisitions?${new URLSearchParams({
              status: RequisitionStatus.NEW_REQ,
              limit: '100',
            })}`,
            { timeout: 10000, credentials: 'include' }
          ),
        ]);
        const notReady = notReadyRes.requisitions || [];
        const newReq = newReqRes.requisitions || [];
        const seen = new Set<string>();
        allPending = [...notReady, ...newReq].filter((r) => {
          if (seen.has(r.id)) return false;
          seen.add(r.id);
          return !r.parentRequisitionId;
        });
      }

      // Drop requisitions that already progressed (quotes sent, PO issued, shore-approved per data)
      allPending = allPending.filter((r) =>
        isRequisitionPendingApproval({
          id: r.id,
          requisitionNumber: r.requisitionNumber,
          status: r.status,
          vendorQuotes: (r.vendorQuotes ?? []).map((q) => ({
            status: q.status,
            quotedItems: q.quotedItems,
          })),
          purchaseOrders: r.purchaseOrders,
        })
      );

      setPendingApprovalRequisitions(allPending);
      setHasLoadedPendingApprovals(true);
    } catch (error: any) {
      console.error("Error fetching pending approval requisitions:", error);
    } finally {
      setIsPendingApprovalLoading(false);
    }
  }, [canApprove, userAccessLevel]);

  const resolveInitialVesselId = useCallback((): string => {
    if (isRestricted && restrictedVessel) {
      return restrictedVessel.id;
    }
    if (vesselIdFromUrl && availableVessels.some((v: { id: string }) => v.id === vesselIdFromUrl)) {
      return vesselIdFromUrl;
    }
    const savedVesselId = loadSavedVesselPreference() || readLastVesselId();
    const savedVessel = savedVesselId
      ? availableVessels.find((v: { id: string }) => v.id === savedVesselId)
      : null;
    if (savedVessel) return savedVessel.id;
    return availableVessels[0]?.id ?? "";
  }, [availableVessels, isRestricted, restrictedVessel, vesselIdFromUrl]);

  // Initial bootstrap: resolve vessel selection; list/stats load via React Query
  useEffect(() => {
    if (bootstrapCompleteRef.current || bootstrapStartedRef.current) return;
    if (!userReady || vesselsLoading || restrictionLoading) return;

    bootstrapStartedRef.current = true;
    const shouldRestoreFilters =
      searchParams.get(VIEW_REQUISITIONS_RESTORE_QUERY) === "1";
    const filtersSnapshot = shouldRestoreFilters
      ? loadViewRequisitionsFiltersSnapshot()
      : null;

    if (filtersSnapshot) {
      clearViewRequisitionsFiltersSnapshot();

      const validVesselIds = filtersSnapshot.selectedVessels.filter((id) =>
        availableVessels.some((v: { id: string }) => v.id === id)
      );

      if (validVesselIds.length > 0) {
        const primaryVessel =
          filtersSnapshot.selectedVessel &&
          validVesselIds.includes(filtersSnapshot.selectedVessel)
            ? filtersSnapshot.selectedVessel
            : validVesselIds[0];
        setSelectedVessels(validVesselIds);
        setSelectedVessel(primaryVessel);
        saveVesselPreference(primaryVessel);
        vesselInitializedRef.current = true;
      } else {
        const vesselId = resolveInitialVesselId();
        if (vesselId) {
          setSelectedVessel(vesselId);
          setSelectedVessels([vesselId]);
          saveVesselPreference(vesselId);
          vesselInitializedRef.current = true;
        }
      }

      setPage(filtersSnapshot.page || 1);
      setLimit(filtersSnapshot.limit || DEFAULT_TABLE_PAGE_SIZE);
      setSearchTerm(filtersSnapshot.searchTerm || "");
      setReqNumberFilter(filtersSnapshot.reqNumberFilter || "");
      setHeaderFilter(filtersSnapshot.headerFilter || "");
      setSelectedStatuses(filtersSnapshot.selectedStatuses || []);
      setSelectedTypes(filtersSnapshot.selectedTypes || []);
      setDateFrom(
        filtersSnapshot.dateFrom ? new Date(filtersSnapshot.dateFrom) : undefined
      );
      setDateTo(
        filtersSnapshot.dateTo ? new Date(filtersSnapshot.dateTo) : undefined
      );
      setHasDeclinedSuppliers(Boolean(filtersSnapshot.hasDeclinedSuppliers));
      setPriorityFilter(filtersSnapshot.priorityFilter || "all");
      setReasonForRequisitionFilter(
        filtersSnapshot.reasonForRequisitionFilter || "all"
      );
      setPoIssuedFilter(filtersSnapshot.poIssuedFilter || "all");
      setShowFilters(Boolean(filtersSnapshot.showFilters));
      if (
        filtersSnapshot.viewMode === "list" ||
        filtersSnapshot.viewMode === "grid"
      ) {
        setViewMode(filtersSnapshot.viewMode);
        localStorage.setItem("requisitionViewMode", filtersSnapshot.viewMode);
      }

      router.replace("/purchase/view-requisitions", { scroll: false });
    } else {
      const vesselId = resolveInitialVesselId();

      if (vesselId) {
        setSelectedVessel(vesselId);
        setSelectedVessels([vesselId]);
        saveVesselPreference(vesselId);
        vesselInitializedRef.current = true;
      }
    }

    bootstrapCompleteRef.current = true;
    setIsPageReady(true);
    markSuccess();
  }, [
    userReady,
    vesselsLoading,
    restrictionLoading,
    resolveInitialVesselId,
    markSuccess,
    searchParams,
    availableVessels,
    router,
  ]);

  const listFiltersWithoutPage = useMemo(
    () => ({
      vesselIds: selectedVessels.slice(0, 50).join(","),
      searchTerm,
      reqNumberFilter,
      headerFilter,
      selectedTypes: selectedTypes.join(","),
      selectedStatuses: selectedStatuses.join(","),
      dateFrom: dateFrom?.toISOString().split("T")[0] ?? "",
      dateTo: dateTo?.toISOString().split("T")[0] ?? "",
      hasDeclinedSuppliers,
      priorityFilter,
      reasonForRequisitionFilter,
      poIssuedFilter,
    }),
    [
      selectedVessels,
      searchTerm,
      reqNumberFilter,
      headerFilter,
      selectedTypes,
      selectedStatuses,
      dateFrom,
      dateTo,
      hasDeclinedSuppliers,
      priorityFilter,
      reasonForRequisitionFilter,
      poIssuedFilter,
    ]
  );

  const prevListFiltersWithoutPageRef = useRef(listFiltersWithoutPage);
  useEffect(() => {
    if (!isPageReady) return;
    const prev = prevListFiltersWithoutPageRef.current;
    prevListFiltersWithoutPageRef.current = listFiltersWithoutPage;
    if (JSON.stringify(prev) !== JSON.stringify(listFiltersWithoutPage)) {
      setPage(1);
    }
  }, [isPageReady, listFiltersWithoutPage]);

  useEffect(() => {
    if (!isListError) return;
    toast.error("Failed to fetch requisitions. Please check your connection and try again.");
  }, [isListError]);

  // Fetch approval rows only when the user opens that section.
  useEffect(() => {
    if (!isPageReady || !canApprove || !showApprovalSection) return;
    fetchPendingApprovalRequisitions();
  }, [isPageReady, canApprove, showApprovalSection, fetchPendingApprovalRequisitions]);

  useEffect(() => {
    return subscribePendingTasksChanged(() => {
      void invalidateRequisitionsListQueries(queryClient);
      if (canApprove && showApprovalSection) {
        void fetchPendingApprovalRequisitions();
      }
    });
  }, [queryClient, canApprove, showApprovalSection, fetchPendingApprovalRequisitions]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (size: TablePageSize) => {
    setLimit(size);
    setPage(1);
  };


  const clearVesselFilter = () => {
    if (isRestricted) return;
    setSelectedVessels([]);
    setSelectedVessel("");
    if (typeof window !== "undefined") {
      localStorage.removeItem("requisitionPageSelectedVessel");
    }
    setPage(1);
  };

  const clearDateFilter = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setPage(1);
  };

  const clearReqNumberFilter = () => {
    setReqNumberFilter("");
    setPage(1);
  };

  const clearHeaderFilter = () => {
    setHeaderFilter("");
    setPage(1);
  };

  const clearStatusFilter = () => {
    setSelectedStatuses([]);
    setPage(1);
  };

  const clearTypeFilter = () => {
    setSelectedTypes([]);
    setPage(1);
  };

  const clearPriorityFilter = () => {
    setPriorityFilter("all");
    setPage(1);
  };

  const clearReasonFilter = () => {
    setReasonForRequisitionFilter("all");
    setPage(1);
  };

  const clearPoIssuedFilter = () => {
    setPoIssuedFilter("all");
    setPage(1);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setReqNumberFilter("");
    setHeaderFilter("");
    setSelectedStatuses([]);
    setSelectedTypes([]);
    setSelectedVessels([]);
    setDateFrom(undefined);
    setDateTo(undefined);
    setHasDeclinedSuppliers(false);
    setPriorityFilter("all");
    setReasonForRequisitionFilter("all");
    setPoIssuedFilter("all");
    setPage(1);
  };


  const handleGoToMasterApproval = () => {
    saveViewRequisitionsFiltersSnapshot({
      selectedVessel,
      selectedVessels,
      page,
      limit,
      searchTerm,
      reqNumberFilter,
      headerFilter,
      selectedStatuses,
      selectedTypes,
      dateFrom: dateFrom?.toISOString() ?? null,
      dateTo: dateTo?.toISOString() ?? null,
      hasDeclinedSuppliers,
      priorityFilter,
      reasonForRequisitionFilter,
      poIssuedFilter,
      showFilters,
      viewMode,
    });
    router.push(buildMasterApprovalHref(buildViewRequisitionsRestorePath()));
  };

  // Handle view requisition - Navigate to view page
  const handleViewRequisition = (requisition: Requisition) => {
    window.location.href = `/purchase/requisitions/${requisition.id}/view`;
  };

  // Handle requisition number click - Open details modal
  const handleRequisitionNumberClick = (requisition: Requisition) => {
    setSelectedRequisitionId(requisition.id);
    setIsDetailsModalOpen(true);
  };

  // Handle edit requisition (only for drafts, not for NEW_REQ status)
  const handleEditRequisition = (requisition: Requisition) => {
    if (requisition.status === RequisitionStatus.NEW_REQ) {
      toast.error("Requisitions with status 'New Requisition' cannot be edited");
      return;
    }
    if (requisition.generationStatus === GenerationStatus.SAVED_AS_DRAFT) {
      window.location.href = `/purchase/draft-requisitions`;
    } else {
      toast.error("Only draft requisitions can be edited");
    }
  };

  // Handle delete requisition (only for drafts)
  const handleDeleteRequisition = async (requisition: Requisition) => {
    if (!currentUser?.id) {
      toast.error("User not authenticated");
      return;
    }
    
    try {
      const response = await fetch(`/api/requisitions/${requisition.id}?deletedById=${currentUser.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Requisition deleted successfully");
        invalidateRequisitions();
        if (canApprove) {
          fetchPendingApprovalRequisitions();
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to delete requisition");
      }
    } catch (error) {
      console.error("Error deleting requisition:", error);
      toast.error("Failed to delete requisition");
    }
  };

  // Handle approve requisition - redirect to approval page
  const handleApproveRequisition = (requisition: Requisition) => {
    window.location.href = `/purchase/requisitions/${requisition.id}/approve`;
  };

  // Handle send for quote
  const handleSendForQuote = (requisition: Requisition) => {
    window.location.href = `/purchase/send-quote-request/${requisition.id}`;
  };

  // Handle view/compare quotes
  const handleViewQuotes = (requisition: Requisition) => {
    window.location.href = `/purchase/requisitions/${requisition.id}/quotes`;
  };

  // Handle cancel requisition
  const handleCancelRequisition = async (requisition: Requisition) => {
    if (!currentUser?.id) {
      toast.error("User not authenticated");
      return;
    }

    // Check if purchase order exists for this requisition
    try {
      const poResponse = await fetch(`/api/purchase-orders/list?requisitionId=${requisition.id}`, {
        credentials: "include",
      });

      if (poResponse.ok) {
        const poData = await poResponse.json();
        const purchaseOrders = poData.purchaseOrders || [];
        
        // Check if there's an active (non-cancelled) purchase order
        const activePO = purchaseOrders.find((po: any) => po.status !== 'CANCELLED');
        
        if (activePO) {
          toast.error("Cannot cancel requisition. A purchase order has been issued for this requisition. Please cancel the purchase order first.");
          return;
        }
      }
    } catch (error) {
      console.error("Error checking purchase orders:", error);
      // Continue with cancellation attempt if check fails
    }

    // Check if requisition status indicates PO was issued
    if (
      requisition.status === RequisitionStatus.QUOTE_CONFIRMED_PO_SENT ||
      requisition.status === RequisitionStatus.REQ_RECEIVED_DELIVERED
    ) {
      toast.error("Cannot cancel requisition. A purchase order has been issued for this requisition. Please cancel the purchase order first.");
      return;
    }

    const reason = prompt("Please provide a reason for cancelling this requisition:");
    if (reason === null) return; // User cancelled

    try {
      const response = await fetch(`/api/requisitions/${requisition.id}/cancel`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          cancelledById: currentUser.id,
          reason: reason || undefined,
        }),
      });

      if (response.ok) {
        toast.success(`Requisition ${requisition.requisitionNumber} cancelled successfully!`);
        invalidateRequisitions();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to cancel requisition");
      }
    } catch (error) {
      console.error("Error cancelling requisition:", error);
      toast.error("Failed to cancel requisition");
    }
  };

  // Handle cancel purchase order
  const handleCancelPurchaseOrder = async (requisition: Requisition) => {
    if (!currentUser?.id) {
      toast.error("User not authenticated");
      return;
    }

    // Check if requisition status indicates items are already delivered
    if (requisition.status === RequisitionStatus.REQ_RECEIVED_DELIVERED) {
      toast.error("Purchase order cannot be cancelled as items have already been delivered.");
      return;
    }

    // First, get the purchase order for this requisition
    try {
      const poResponse = await fetch(`/api/purchase-orders/list?requisitionId=${requisition.id}`, {
        credentials: "include",
      });

      if (!poResponse.ok) {
        toast.error("Failed to fetch purchase order");
        return;
      }

      const poData = await poResponse.json();
      const purchaseOrders = poData.purchaseOrders || [];
      
      if (purchaseOrders.length === 0) {
        toast.error("No purchase order found for this requisition");
        return;
      }

      // Use the first active purchase order
      const purchaseOrder = purchaseOrders.find((po: any) => po.status !== 'CANCELLED') || purchaseOrders[0];
      
      if (!purchaseOrder) {
        toast.error("No active purchase order found");
        return;
      }

      // Additional check: if requisition status is REQ_RECEIVED_DELIVERED, cannot cancel
      if (purchaseOrder.requisition?.status === RequisitionStatus.REQ_RECEIVED_DELIVERED) {
        toast.error("Purchase order cannot be cancelled as items have already been delivered.");
        return;
      }

      const reason = prompt("Please provide a reason for cancelling this purchase order:");
      if (reason === null) return; // User cancelled

      // Request cancellation (creates a cancellation request that needs vendor acceptance)
      const response = await fetch(`/api/purchase-orders/${purchaseOrder.id}/request-cancellation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          reason: reason || undefined,
        }),
      });

      if (response.ok) {
        toast.success(`Purchase order cancellation request sent. Waiting for vendor acceptance.`);
        invalidateRequisitions();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to request purchase order cancellation");
      }
    } catch (error) {
      console.error("Error cancelling purchase order:", error);
      toast.error("Failed to request purchase order cancellation");
    }
  };

  // Handle return requisition
  const handleReturnRequisition = async (requisition: Requisition) => {
    if (!currentUser?.id) {
      toast.error("User not authenticated");
      return;
    }

    const reason = prompt("Please provide a reason for returning this requisition for editing:");
    if (reason === null) return; // User cancelled

    try {
      const response = await fetch(`/api/requisitions/${requisition.id}/return`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          returnedById: currentUser.id,
          reason: reason || undefined,
        }),
      });

      if (response.ok) {
        toast.success(`Requisition ${requisition.requisitionNumber} returned for editing!`);
        invalidateRequisitions();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to return requisition");
      }
    } catch (error) {
      console.error("Error returning requisition:", error);
      toast.error("Failed to return requisition");
    }
  };

  // Handle download quotes PDF
  const handleDownloadQuotes = async (requisition: Requisition) => {
    try {
      const response = await fetch(`/api/requisitions/${requisition.id}/download-quotes`, {
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || "Failed to download quotes PDF");
        return;
      }

      // Get PDF blob
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Quotes_${requisition.requisitionNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success("Quotes PDF downloaded successfully");
    } catch (error) {
      console.error("Error downloading quotes PDF:", error);
      toast.error("Failed to download quotes PDF");
    }
  };

  // Handle confirm quote to vendor - Navigate to confirmation page
  const handleConfirmQuote = async (requisition: Requisition) => {
    if (!currentUser?.id) {
      toast.error("User not authenticated");
      return;
    }

    try {
      const resolvedResponse = await fetch(
        `/api/requisitions/${requisition.id}/approved-quote-for-confirm`,
        { credentials: "include" }
      );

      if (!resolvedResponse.ok) {
        const errorData = await resolvedResponse.json().catch(() => ({}));
        toast.error(errorData.error || "No approved quote found for this requisition");
        return;
      }

      const resolved = await resolvedResponse.json();
      const quoteId = resolved.quoteId as string | undefined;
      if (!quoteId) {
        toast.error("No approved quote found for this requisition");
        return;
      }

      const childQuery =
        resolved.isSplitChild && resolved.childRequisitionId
          ? resolved.childRequisitionId
          : "";

      if (resolved.hasPurchaseOrder) {
        router.push(
          quoteSendPoPath(quoteId, {
            childRequisitionId: childQuery || undefined,
          })
        );
        return;
      }

      router.push(
        quoteCreatePoPath(quoteId, {
          childRequisitionId: childQuery || undefined,
        })
      );
    } catch (error) {
      console.error("Error confirming quote:", error);
      toast.error("Failed to confirm quote");
    }
  };

  // Handle filters change from table component
  const handleFiltersChange = useCallback((filters: {
    search?: string;
    requisitionType?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    if (filters.search !== undefined) setSearchTerm(filters.search);
    if (filters.status !== undefined) {
      setSelectedStatuses(filters.status ? [filters.status] : []);
    }
    if (filters.requisitionType !== undefined) {
      setSelectedTypes(filters.requisitionType ? [filters.requisitionType] : []);
    }
    if (filters.dateFrom !== undefined) {
      setDateFrom(filters.dateFrom ? new Date(filters.dateFrom) : undefined);
    }
    if (filters.dateTo !== undefined) {
      setDateTo(filters.dateTo ? new Date(filters.dateTo) : undefined);
    }
    setPage(1); // Reset to first page when filters change
  }, []);

  // Get selected vessel name
  const selectedVesselName = allVessels.find((v: any) => v.id === selectedVessel)?.name || 'Select Vessel';
  const activeFiltersCount = [reqNumberFilter, headerFilter, selectedStatuses.length > 0, selectedTypes.length > 0, selectedVessels.length > 0, dateFrom, dateTo, hasDeclinedSuppliers, priorityFilter !== "all", reasonForRequisitionFilter !== "all", poIssuedFilter !== "all"].filter(Boolean).length;

  // Load view mode preference from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('requisitionViewMode') as 'list' | 'grid' | null;
    if (savedViewMode && (savedViewMode === 'list' || savedViewMode === 'grid')) {
      setViewMode(savedViewMode);
    }
  }, []);

  return (
    <div className="w-full space-y-4">
      <main className="w-full py-4">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              {fromNotification && (
                <Link
                  href="/notifications"
                  className="text-sm text-primary hover:underline font-medium inline-flex mb-2"
                >
                  ← Return to Notifications
                </Link>
              )}
              <h1 className="text-3xl font-bold text-foreground mb-2">Requisitions</h1>
              {showAdminOnlyUi && (
                <p className="text-foreground">
                  {selectedVessel 
                    ? `Requisitions for ${selectedVesselName} with advanced filtering and status tracking.`
                    : 'Select a vessel to view requisitions with advanced filtering and status tracking.'
                  }
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {canApprove && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowApprovalSection(true);
                    setTimeout(
                      () =>
                        approvalSectionRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        }),
                      100
                    );
                  }}
                  className="flex items-center gap-1.5 bg-destructive hover:bg-destructive text-white border-border"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approval ({approvalButtonCount})
                </Button>
              )}
              {canUserCreate && (
                <Button
                  onClick={() => (window.location.href = "/purchase/create-requisition")}
                  size="lg"
                  className="flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  New Requisition
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Approval Section - Hidden by default; only visible when user clicks "Approval (N)" in header */}
        {showApprovalSection && (
          <div ref={approvalSectionRef} className="scroll-mt-4">
            {isPendingApprovalLoading ? (
              <Card className="mb-8 border-border">
                <CardContent className="py-8">
                  <div className="flex justify-center">
                    <ActiniumLoader size="md" />
                  </div>
                </CardContent>
              </Card>
            ) : pendingApprovalRequisitions.length > 0 ? (
              <Card className="mb-8 border-border bg-warning">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-warning" />
                      Requisitions Ready for Approval
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-warning text-warning">
                        {pendingApprovalRequisitions.length} pending
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowApprovalSection(false)}
                        className="text-warning hover:text-warning hover:bg-warning"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Hide
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    These requisitions are waiting for your approval. Once approved, they will be available to all users with access level 26-48.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {pendingApprovalRequisitions.map((req) => (
                      <div
                        key={req.id}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-border hover:border-border transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{req.requisitionNumber}</span>
                            <RequisitionTypeBadge type={req.requisitionType} className="text-xs" />
                          </div>
                          <p className="text-sm text-foreground mt-1">{req.heading}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Created by {req.createdBy?.firstName} {req.createdBy?.lastName} • {new Date(req.dateOfCreation).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewRequisition(req)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApproveRequisition(req)}
                            className="bg-success hover:bg-success"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="mb-8 border-border bg-warning">
                <CardContent className="py-6 flex flex-col items-center gap-2">
                  <p className="text-sm text-foreground text-center">No requisitions pending approval.</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowApprovalSection(false)}
                    className="text-warning"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Hide
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Filters — compact single-row toolbar */}
        <Card variant="filter" className="mb-4">
          <CardContent className="py-2 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 items-end">
              <div className="min-w-0">
                <Label htmlFor="vessel-filter" className="mb-0.5 block text-xs text-foreground">
                  Vessel
                </Label>
                <FilterFieldShell
                  showClear={selectedVessels.length > 0 && !isRestricted}
                  onClear={clearVesselFilter}
                  hasDropdownChevron
                >
                  <MultiSelectDropdown
                    options={vesselOptions}
                    selectedValues={selectedVessels}
                    onSelectionChange={(values) => {
                      if (!isRestricted) {
                        setSelectedVessels(values);
                        if (values.length > 0 && values[0] !== selectedVessel) {
                          const newVesselId = values[0];
                          setSelectedVessel(newVesselId);
                          saveVesselPreference(newVesselId);
                        } else if (values.length === 0) {
                          setSelectedVessel("");
                          if (typeof window !== "undefined") {
                            localStorage.removeItem("requisitionPageSelectedVessel");
                          }
                        }
                      }
                    }}
                    placeholder="Vessels…"
                    searchPlaceholder="Search vessels…"
                    className={cn(
                      "min-w-0 [&>button]:h-8 [&>button]:text-xs",
                      selectedVessels.length > 0 &&
                        !isRestricted &&
                        filterMultiSelectClearClass(true)
                    )}
                    showSelectedCount={true}
                    disabled={isRestricted}
                  />
                </FilterFieldShell>
              </div>

              <div className="min-w-0">
                <Label htmlFor="requisitions-date-range" className="mb-0.5 block text-xs text-foreground">
                  Date range
                </Label>
                <FilterFieldShell
                  showClear={Boolean(dateFrom || dateTo)}
                  onClear={clearDateFilter}
                >
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="requisitions-date-range"
                        variant="outline"
                        className={cn(
                          "h-8 w-full min-w-0 justify-start px-2 text-left text-xs font-normal",
                          !dateFrom && !dateTo && "text-muted-foreground",
                          filterTriggerClearPadding(Boolean(dateFrom || dateTo))
                        )}
                      >
                        <CalendarIcon className="mr-1.5 h-3.5 w-3.5 shrink-0 opacity-70" />
                        <span className="truncate">
                          {dateFrom
                            ? dateTo
                              ? `${format(dateFrom, "dd MMM y")} – ${format(dateTo, "dd MMM y")}`
                              : format(dateFrom, "dd MMM y")
                            : "Pick range"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="range"
                        defaultMonth={dateFrom ?? dateTo ?? new Date()}
                        selected={{ from: dateFrom, to: dateTo }}
                        onSelect={(range: DateRange | undefined) => {
                          setDateFrom(range?.from);
                          setDateTo(range?.to);
                        }}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                </FilterFieldShell>
              </div>

              <div className="min-w-0">
                <Label htmlFor="req-number-filter" className="mb-0.5 block text-xs text-foreground">
                  Req number
                </Label>
                <ClearableInput
                  id="req-number-filter"
                  placeholder="Req #…"
                  value={reqNumberFilter}
                  onChange={(e) => setReqNumberFilter(e.target.value)}
                  onClear={clearReqNumberFilter}
                />
              </div>

              <div className="min-w-0">
                <Label htmlFor="header-filter" className="mb-0.5 block text-xs text-foreground">
                  Header
                </Label>
                <ClearableInput
                  id="header-filter"
                  placeholder="Header…"
                  value={headerFilter}
                  onChange={(e) => setHeaderFilter(e.target.value)}
                  onClear={clearHeaderFilter}
                />
              </div>

              <div className="flex items-end gap-1.5 col-span-2 sm:col-span-1 lg:col-span-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="h-8 flex-1 sm:flex-none text-xs px-2.5 gap-1"
                >
                  <Filter className="h-3.5 w-3.5" />
                  More
                  {activeFiltersCount > 0 && (
                    <span className="bg-info text-info text-[10px] leading-none px-1.5 py-0.5 rounded-full">
                      {activeFiltersCount}
                    </span>
                  )}
                </Button>
                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-8 text-xs px-2 gap-1 shrink-0"
                    title="Clear filters"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {showFilters && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-border/60 items-end">
                <div className="min-w-0">
                  <Label htmlFor="status-filter" className="mb-0.5 block text-xs">Status</Label>
                  <FilterFieldShell
                    showClear={selectedStatuses.length > 0}
                    onClear={clearStatusFilter}
                    hasDropdownChevron
                  >
                    <MultiSelectDropdown
                      options={statusOptions}
                      selectedValues={selectedStatuses}
                      onSelectionChange={setSelectedStatuses}
                      placeholder="All statuses"
                      searchPlaceholder="Search…"
                      className={cn(
                        "min-w-0 [&>button]:h-8 [&>button]:text-xs",
                        filterMultiSelectClearClass(selectedStatuses.length > 0)
                      )}
                      showSelectedCount={true}
                    />
                  </FilterFieldShell>
                </div>

                <div className="min-w-0">
                  <Label htmlFor="type-filter" className="mb-0.5 block text-xs">Type</Label>
                  <FilterFieldShell
                    showClear={selectedTypes.length > 0}
                    onClear={clearTypeFilter}
                    hasDropdownChevron
                  >
                    <MultiSelectDropdown
                      options={typeOptions}
                      selectedValues={selectedTypes}
                      onSelectionChange={setSelectedTypes}
                      placeholder="All types"
                      searchPlaceholder="Search…"
                      className={cn(
                        "min-w-0 [&>button]:h-8 [&>button]:text-xs",
                        filterMultiSelectClearClass(selectedTypes.length > 0)
                      )}
                      showSelectedCount={true}
                    />
                  </FilterFieldShell>
                </div>

                <div className="min-w-0">
                  <Label htmlFor="priority-filter" className="mb-0.5 block text-xs">Priority</Label>
                  <FilterFieldShell
                    showClear={priorityFilter !== "all"}
                    onClear={clearPriorityFilter}
                    hasDropdownChevron
                  >
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger
                        className={cn(
                          "h-8 text-xs w-full min-w-0",
                          filterTriggerClearPadding(priorityFilter !== "all", true)
                        )}
                      >
                        <SelectValue placeholder="All priorities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priorities</SelectItem>
                        <SelectItem value="CRITICAL">Critical</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="NORMAL">Normal</SelectItem>
                        <SelectItem value="LOW">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </FilterFieldShell>
                </div>

                <div className="min-w-0">
                  <Label htmlFor="reason-filter" className="mb-0.5 block text-xs">Reason</Label>
                  <FilterFieldShell
                    showClear={reasonForRequisitionFilter !== "all"}
                    onClear={clearReasonFilter}
                    hasDropdownChevron
                  >
                    <Select value={reasonForRequisitionFilter} onValueChange={setReasonForRequisitionFilter}>
                      <SelectTrigger
                        className={cn(
                          "h-8 text-xs w-full min-w-0",
                          filterTriggerClearPadding(reasonForRequisitionFilter !== "all", true)
                        )}
                      >
                        <SelectValue placeholder="All reasons" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Reasons</SelectItem>
                        <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                        <SelectItem value="REPAIR">Repair</SelectItem>
                        <SelectItem value="REPLACEMENT">Replacement</SelectItem>
                        <SelectItem value="STOCK_REPLENISHMENT">Stock Replenishment</SelectItem>
                        <SelectItem value="PROJECT">Project</SelectItem>
                        <SelectItem value="EMERGENCY">Emergency</SelectItem>
                        <SelectItem value="ROUTINE">Routine</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </FilterFieldShell>
                </div>

                <div className="min-w-0">
                  <Label htmlFor="po-issued-filter" className="mb-0.5 block text-xs">PO Issued</Label>
                  <FilterFieldShell
                    showClear={poIssuedFilter !== "all"}
                    onClear={clearPoIssuedFilter}
                    hasDropdownChevron
                  >
                    <Select
                      value={poIssuedFilter}
                      onValueChange={(value) => {
                        setPoIssuedFilter(value);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger
                        className={cn(
                          "h-8 text-xs w-full min-w-0",
                          filterTriggerClearPadding(poIssuedFilter !== "all", true)
                        )}
                      >
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="yes">PO Issued</SelectItem>
                        <SelectItem value="no">PO Not Issued</SelectItem>
                      </SelectContent>
                    </Select>
                  </FilterFieldShell>
                </div>

                <div className="flex items-center h-8 gap-2 min-w-0 col-span-2 sm:col-span-1">
                  <input
                    type="checkbox"
                    id="declined-suppliers-filter"
                    checked={hasDeclinedSuppliers}
                    onChange={(e) => setHasDeclinedSuppliers(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border text-info focus:ring-ring shrink-0"
                  />
                  <Label htmlFor="declined-suppliers-filter" className="text-xs cursor-pointer leading-tight">
                    Declined by supplier
                  </Label>
                </div>
              </div>
            )}

            {isRestricted && (
              <p className="text-[11px] text-muted-foreground leading-tight">
                Vessel locked to your login assignment.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Statistics Cards - Removed */}

        {/* Status Workflow Overview - Removed */}

        {/* Quick Actions - Compact Links */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          {canUserCreate && (
            <button
              onClick={() => window.location.href = '/purchase/create-requisition'}
              className="flex items-center gap-1.5 text-sm text-info hover:text-info hover:underline transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Requisition</span>
            </button>
          )}

          {showAdminOnlyUi && (
            <button
              onClick={() => window.location.href = '/purchase/draft-requisitions'}
              className="flex items-center gap-1.5 text-sm text-foreground hover:text-foreground hover:underline transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Draft Requisitions</span>
              {statistics.drafts > 0 && (
                <span className="text-xs bg-warning text-warning px-1.5 py-0.5 rounded-full">
                  {statistics.drafts}
                </span>
              )}
            </button>
          )}

          {showAdminOnlyUi && (
            <button
              onClick={handleGoToMasterApproval}
              className="flex items-center gap-1.5 text-sm text-foreground hover:text-foreground hover:underline transition-colors"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Master Approval</span>
              {statistics.pendingApproval > 0 && (
                <span className="text-xs bg-success text-success px-1.5 py-0.5 rounded-full">
                  {statistics.pendingApproval}
                </span>
              )}
            </button>
          )}

          {showAdminOnlyUi && (
            <button
              type="button"
              onClick={() => { window.location.href = "/analytics/reports"; }}
              className="flex items-center gap-1.5 text-sm text-foreground hover:text-foreground hover:underline transition-colors"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Reports & Analytics</span>
            </button>
          )}
        </div>

        {/* Requisitions Table */}
        {selectedVessel ? (
          <div className="w-full min-w-0">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Requisitions for {selectedVesselName}
                </h2>
                <p className="text-sm text-foreground mt-1">
                  {total > 0 
                    ? `Showing ${requisitions.length} of ${total} requisitions for the selected vessel and filters.`
                    : `No requisitions found for the selected vessel and filters.`
                  }
                </p>
              </div>
              {/* View Toggle */}
              <div className="flex items-center gap-2 border rounded-lg p-1">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setViewMode('list');
                    localStorage.setItem('requisitionViewMode', 'list');
                  }}
                  className="h-8"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setViewMode('grid');
                    localStorage.setItem('requisitionViewMode', 'grid');
                  }}
                  className="h-8"
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {viewMode === 'list' ? (
              <RequisitionTable
                requisitions={requisitions}
                total={total}
                page={page}
                limit={limit}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                onEdit={handleEditRequisition}
                onDelete={handleDeleteRequisition}
                onView={handleViewRequisition}
                onApprove={canApprove ? handleApproveRequisition : undefined}
                onSendForQuote={canSendForQuote ? handleSendForQuote : undefined}
                onViewQuotes={handleViewQuotes}
                onCancel={canCancel ? handleCancelRequisition : undefined}
                onCancelPurchaseOrder={canCancel ? handleCancelPurchaseOrder : undefined}
                onReturn={canReturn ? handleReturnRequisition : undefined}
                onConfirmQuote={handleConfirmQuote}
                onDownloadQuotes={handleDownloadQuotes}
                onFiltersChange={handleFiltersChange}
                isLoading={isTableLoading}
                currentUser={{
                  id: currentUser?.id || "",
                  designation: currentUser?.designation,
                  designationAccessLevel: currentUser?.designationAccessLevel,
                }}
                showDraftsOnly={false}
                showApprovalActions={canApprove}
                onRequisitionNumberClick={handleRequisitionNumberClick}
                highlightRequisitionId={highlightRequisitionId}
              />
            ) : (
              /* Grid View */
              <div className="space-y-4">
                {isTableLoading ? (
                  <div className="text-center py-12">
                    <ActiniumLoader size="lg" text="Loading requisitions..." />
                  </div>
                ) : requisitions.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">No Requisitions Found</h3>
                      <p className="text-foreground">No requisitions match your filters.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {requisitions.map((requisition) => (
                        <Card key={requisition.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleRequisitionNumberClick(requisition)}>
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-base font-semibold text-info hover:underline">
                                  {requisition.requisitionNumber}
                                </CardTitle>
                                <CardDescription className="mt-1 line-clamp-2">
                                  {requisition.heading}
                                </CardDescription>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <RequisitionTypeBadge type={requisition.requisitionType} className="text-xs" />
                              <RequisitionStatusBadge status={requisition.status} className="text-xs">
                                {requisition.status === RequisitionStatus.PARTIAL_QUOTE_RECEIVED &&
                                 requisition.quoteStats &&
                                 requisition.quoteStats.totalQuotesSent > 0 ? (
                                  <>
                                    {requisition.quoteStats.receivedQuotes}/{requisition.quoteStats.totalQuotesSent} Received
                                    {requisition.quoteStats.declinedQuotes > 0 && (
                                      <span className="ml-1">{requisition.quoteStats.declinedQuotes} Decline</span>
                                    )}
                                  </>
                                ) : (
                                  REQUISITION_STATUS_LABELS[requisition.status]
                                )}
                              </RequisitionStatusBadge>
                            </div>
                            {requisition.purchaseOrders && requisition.purchaseOrders.length > 0 && (
                              <div className="text-sm text-foreground">
                                <span className="font-medium">PO: </span>
                                {requisition.purchaseOrders.slice(0, 2).map((po: any, idx: number) => (
                                  <a
                                    key={po.id}
                                    href={`/purchase/view-pos?poId=${po.id}`}
                                    className="text-info hover:underline mr-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {po.poNumber}
                                  </a>
                                ))}
                                {(requisition.purchaseOrderCount ?? requisition.purchaseOrders.length) > 2 && (
                                  <span className="text-xs text-muted-foreground">+{(requisition.purchaseOrderCount ?? requisition.purchaseOrders.length) - 2}</span>
                                )}
                              </div>
                            )}
                            {requisition.quoteStats && requisition.quoteStats.totalQuotesSent > 0 && (
                              <div className="text-sm text-foreground">
                                <span className="font-medium">Suppliers: </span>
                                Received {requisition.quoteStats.receivedQuotes}/{requisition.quoteStats.totalQuotesSent}
                                {requisition.quoteStats.declinedQuotes > 0 && (
                                  <span className="text-destructive ml-1">({requisition.quoteStats.declinedQuotes} declined)</span>
                                )}
                              </div>
                            )}
                            <div className="flex items-center justify-between pt-2 border-t">
                              <span className="text-xs text-muted-foreground">
                                {new Date(requisition.dateOfCreation).toLocaleDateString()}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewRequisition(requisition);
                                }}
                                className="text-xs"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <TablePagination
                      page={page}
                      pageSize={limit}
                      total={total}
                      onPageChange={handlePageChange}
                      onPageSizeChange={handlePageSizeChange}
                      pageSizeOptions={[10, 15, 25, 30, 50, 100]}
                      itemLabel="requisitions"
                      className="pt-4"
                      disabled={isTableLoading}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-12">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <Ship className="h-16 w-16 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">Select a Vessel</h3>
              <p className="text-foreground max-w-md mx-auto">
                Please select a vessel from the dropdown above to view its requisitions.
              </p>
            </div>
          </div>
        )}

        {/* Empty State for Selected Vessel */}
        {selectedVessel && !isTableLoading && requisitions.length === 0 && (
          <div className="mt-8 p-12">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <FileText className="h-16 w-16 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">No Requisitions Found</h3>
              <p className="text-foreground max-w-md mx-auto">
                {activeFiltersCount > 0 
                  ? `No requisitions found for ${selectedVesselName} with the current filters. Try adjusting your search criteria.`
                  : `No requisitions have been created for ${selectedVesselName} yet. Create the first requisition to get started.`
                }
              </p>
              <div className="flex justify-center gap-4 mt-6">
                {activeFiltersCount > 0 && (
                  <Button 
                    variant="outline"
                    onClick={clearFilters}
                  >
                    Clear Filters
                  </Button>
                )}
                {canUserCreate && (
                  <Button 
                    onClick={() => window.location.href = '/purchase/create-requisition'}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Requisition
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Requisition Details Modal */}
        <RequisitionDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedRequisitionId(null);
          }}
          requisitionId={selectedRequisitionId}
          currentUserAccessLevel={userAccessLevel}
        />
      </main>
    </div>
  );
}
