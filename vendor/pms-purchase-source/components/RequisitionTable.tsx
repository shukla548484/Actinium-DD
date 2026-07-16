"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RequisitionStatusBadge } from "@/components/requisition/RequisitionStatusBadge";
import { RequisitionTypeBadge } from "@/components/requisition/RequisitionTypeBadge";
import { RequisitionGenerationStatusBadge } from "@/components/requisition/RequisitionGenerationStatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  Search,
  Filter,
  FileText,
  Calendar,
  User,
  Ship,
  Lock,
  Unlock,
  Send,
  TrendingUp,
  X,
  RotateCcw,
  Download,
  Users,
  Wrench,
  Paintbrush,
  ShoppingCart,
  UtensilsCrossed,
  Soup,
  Settings,
  Package,
  AlertCircle as AlertCircleIcon,
  Columns,
  Check,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import {
  Requisition,
  RequisitionType,
  GenerationStatus,
  RequisitionStatus,
  RequisitionFilters,
  REQUISITION_TYPE_LABELS,
  GENERATION_STATUS_LABELS,
  REQUISITION_STATUS_LABELS,
  canCreateRequisition,
  isMaster,
  canMasterApproveVesselRequisitionDraft,
  canOfficeApproveNotReadyRequisition,
  canCancelRequisition,
  canReturnRequisition,
} from "@/lib/types/requisition";
import ActiniumLoader from "@/components/ActiniumLoader";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import { isCrewOriginatedRequisitionNumber } from "@/lib/sync/record-origin-suffix";
import { TableSerialHead, TableSerialCell } from "@/components/ui/table-serial-column";
import { TABLE_SERIAL_COLUMN_STYLE, tableSerialNo } from "@/lib/table-serial-column";

type RequisitionTreeRow = {
  requisition: Requisition;
  depth: number;
  isChild: boolean;
  parentId?: string;
  hasChildren: boolean;
  childCount: number;
};

function buildRequisitionTreeRows(requisitions: Requisition[]): RequisitionTreeRow[] {
  const childIds = new Set<string>();
  const childrenByParent = new Map<string, Requisition[]>();

  for (const r of requisitions) {
    if (r.parentRequisitionId) {
      childIds.add(r.id);
      const list = childrenByParent.get(r.parentRequisitionId) ?? [];
      list.push(r);
      childrenByParent.set(r.parentRequisitionId, list);
    }
  }

  const roots = requisitions.filter((r) => !childIds.has(r.id));
  const rows: RequisitionTreeRow[] = [];

  for (const parent of roots) {
    const children = (childrenByParent.get(parent.id) ?? []).sort(
      (a, b) =>
        (a.splitIndex ?? 0) - (b.splitIndex ?? 0) ||
        a.requisitionNumber.localeCompare(b.requisitionNumber)
    );
    const childCount = Math.max(children.length, parent.childRequisitions?.length ?? 0);
    rows.push({
      requisition: parent,
      depth: 0,
      isChild: false,
      hasChildren: childCount > 0,
      childCount,
    });
    for (const child of children) {
      rows.push({
        requisition: child,
        depth: 1,
        isChild: true,
        parentId: parent.id,
        hasChildren: false,
        childCount: 0,
      });
    }
  }

  return rows;
}

/** Narrow serial column for requisition list (S.No. header). */
const REQUISITION_S_NO_COLUMN_STYLE = {
  ...TABLE_SERIAL_COLUMN_STYLE,
  width: 40,
  minWidth: 40,
  maxWidth: 44,
};

const REQUISITION_SCROLL_COLUMN_THRESHOLD = 15;
/** Weight share for S.No. and Actions when splitting table width (must sum to 100% with data cols). */
const REQUISITION_S_NO_WEIGHT = 3;
const REQUISITION_ACTIONS_WEIGHT = 3;

/** Relative weights — normalized against visible columns only so the table always fills 100% width. */
const REQUISITION_COLUMN_WEIGHTS: Record<RequisitionDataColumnId, number> = {
  reqNumber: 10,
  heading: 14,
  department: 11,
  type: 10,
  vessel: 5,
  poNumber: 9,
  supplier: 8,
  linkedReason: 8,
  priority: 6,
  generation: 7,
  status: 10,
  editable: 5,
  createdBy: 7,
  date: 7,
};

const REQUISITION_DATA_COLUMN_IDS = [
  "reqNumber",
  "heading",
  "department",
  "type",
  "vessel",
  "poNumber",
  "supplier",
  "linkedReason",
  "priority",
  "generation",
  "status",
  "editable",
  "createdBy",
  "date",
] as const;

type RequisitionDataColumnId = (typeof REQUISITION_DATA_COLUMN_IDS)[number];

type RequisitionColumnLayoutContext = {
  columnVisibility: Record<string, boolean>;
  showDraftsOnly: boolean;
  isSuperAdmin: boolean;
  canViewSupplierAndStatus: boolean;
  canViewStatus: boolean;
  canViewEditableColumn: boolean;
};

function isRequisitionDataColumnVisible(
  colId: string,
  ctx: RequisitionColumnLayoutContext
): boolean {
  const {
    columnVisibility,
    showDraftsOnly,
    isSuperAdmin,
    canViewSupplierAndStatus,
    canViewStatus,
    canViewEditableColumn,
  } = ctx;
  if (!columnVisibility[colId]) return false;
  if (colId === "department" && (showDraftsOnly || !isSuperAdmin)) return false;
  if (colId === "poNumber" && showDraftsOnly) return false;
  if (colId === "supplier" && (showDraftsOnly || !canViewSupplierAndStatus)) return false;
  if (["linkedReason", "priority", "generation"].includes(colId) && showDraftsOnly) return false;
  if (colId === "status" && !canViewStatus) return false;
  if (colId === "editable" && !canViewEditableColumn) return false;
  return true;
}

function countVisibleRequisitionColumns(ctx: RequisitionColumnLayoutContext): number {
  let count = 1; // S.No.
  for (const id of REQUISITION_DATA_COLUMN_IDS) {
    if (isRequisitionDataColumnVisible(id, ctx)) count++;
  }
  if (ctx.columnVisibility.actions) count++;
  return count;
}

function getVisibleRequisitionDataColumnIds(
  ctx: RequisitionColumnLayoutContext
): RequisitionDataColumnId[] {
  return REQUISITION_DATA_COLUMN_IDS.filter((id) =>
    isRequisitionDataColumnVisible(id, ctx)
  );
}

function buildRequisitionColumnWidths(
  ctx: RequisitionColumnLayoutContext
): Record<string, string> {
  const visibleIds = getVisibleRequisitionDataColumnIds(ctx);
  const dataWeightSum = visibleIds.reduce(
    (sum, id) => sum + REQUISITION_COLUMN_WEIGHTS[id],
    0
  );
  const actionsWeight = ctx.columnVisibility.actions ? REQUISITION_ACTIONS_WEIGHT : 0;
  const totalWeight = REQUISITION_S_NO_WEIGHT + dataWeightSum + actionsWeight;

  const pct = (weight: number) =>
    `${((weight / totalWeight) * 100).toFixed(4)}%`;

  const widths: Record<string, string> = {
    _sno: pct(REQUISITION_S_NO_WEIGHT),
  };
  for (const id of visibleIds) {
    widths[id] = pct(REQUISITION_COLUMN_WEIGHTS[id]);
  }
  if (ctx.columnVisibility.actions) {
    widths.actions = pct(REQUISITION_ACTIONS_WEIGHT);
  }
  return widths;
}

/** Text wrapping for long content columns. */
const REQUISITION_WRAP_CELL =
  "whitespace-normal break-words align-top [overflow-wrap:anywhere]";

function requisitionColumnHeadClass(colId: RequisitionDataColumnId | "actions"): string {
  if (colId === "actions") return "text-center whitespace-nowrap";
  if (colId === "reqNumber" || colId === "vessel" || colId === "date" || colId === "priority" || colId === "editable") {
    return "!whitespace-nowrap";
  }
  return "!whitespace-normal";
}

function requisitionColumnCellClass(colId: RequisitionDataColumnId | "actions"): string {
  if (colId === "reqNumber") return "font-medium !whitespace-nowrap align-top";
  if (colId === "actions") return "px-1 text-center align-top !whitespace-nowrap";
  if (colId === "vessel" || colId === "date" || colId === "priority" || colId === "editable") {
    return "!whitespace-nowrap align-top";
  }
  return `${REQUISITION_WRAP_CELL} !whitespace-normal`;
}
import { TablePagination, type TablePageSize } from "@/components/ui/table-pagination";

interface RequisitionTableProps {
  requisitions: Requisition[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Rows per page (shows selector when provided, same as other purchase tables). */
  onPageSizeChange?: (size: TablePageSize) => void;
  onEdit: (requisition: Requisition) => void;
  onDelete: (requisition: Requisition) => void;
  onView: (requisition: Requisition) => void;
  onApprove?: (requisition: Requisition) => void;
  onSendForQuote?: (requisition: Requisition) => void;
  onViewQuotes?: (requisition: Requisition) => void;
  onCancel?: (requisition: Requisition) => void;
  onCancelPurchaseOrder?: (requisition: Requisition) => void;
  onReturn?: (requisition: Requisition) => void;
  onConfirmQuote?: (requisition: Requisition) => void;
  onDownloadQuotes?: (requisition: Requisition) => void;
  onFiltersChange: (filters: RequisitionFilters) => void;
  isLoading?: boolean;
  currentUser?: {
    id: string;
    designation?: string;
    designationAccessLevel?: number;
  };
  showDraftsOnly?: boolean;
  showApprovalActions?: boolean;
  onRequisitionNumberClick?: (requisition: Requisition) => void;
  /** When set, the row with this requisition id gets a blinking highlight and scrolls into view (e.g. from defect report link). */
  highlightRequisitionId?: string | null;
}

export function RequisitionTable({
  requisitions,
  total,
  page,
  limit,
  totalPages: _totalPages,
  onPageChange,
  onPageSizeChange,
  onEdit,
  onDelete,
  onView,
  onApprove,
  onSendForQuote,
  onViewQuotes,
  onCancel,
  onCancelPurchaseOrder,
  onReturn,
  onConfirmQuote,
  onDownloadQuotes,
  onFiltersChange,
  isLoading = false,
  currentUser,
  showDraftsOnly = false,
  showApprovalActions = false,
  onRequisitionNumberClick,
  highlightRequisitionId = null,
}: RequisitionTableProps) {
  const highlightRowRef = useRef<HTMLTableRowElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<string>>(new Set());

  const treeRows = useMemo(() => buildRequisitionTreeRows(requisitions), [requisitions]);
  const visibleTreeRows = useMemo(
    () =>
      treeRows.filter((row) => {
        if (!row.isChild || !row.parentId) return true;
        return !collapsedParentIds.has(row.parentId);
      }),
    [treeRows, collapsedParentIds]
  );

  const toggleParentCollapse = (parentId: string) => {
    setCollapsedParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  useEffect(() => {
    if (highlightRequisitionId && highlightRowRef.current) {
      highlightRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightRequisitionId, requisitions]);

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [generationStatusFilter, setGenerationStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requisitionToDelete, setRequisitionToDelete] = useState<Requisition | null>(null);
  const [columnVisibilityDialogOpen, setColumnVisibilityDialogOpen] = useState(false);

  // Get user access level - always use database field
  const userAccessLevel = currentUser?.designationAccessLevel ?? 0;
  const isSuperAdmin = [50, 99, 100].includes(userAccessLevel);
  const canViewSupplierAndStatus = userAccessLevel > 25;
  const canViewStatus = userAccessLevel > 25; // Access level 25 or less cannot see requisition status
  const canViewQuoteComparison = userAccessLevel > 25;
  const canViewEditableColumn = userAccessLevel >= 49;

  // Define all available columns (Status visible only when canViewStatus)
  const allColumns = [
    { id: 'reqNumber', label: 'Req. Number', alwaysVisible: true },
    { id: 'heading', label: 'Heading', alwaysVisible: true },
    { id: 'department', label: 'Department', alwaysVisible: false, requiresAccess: [50, 99, 100] },
    { id: 'type', label: 'Type', alwaysVisible: false },
    { id: 'vessel', label: 'Vessel', alwaysVisible: true },
    { id: 'poNumber', label: 'PO Number', alwaysVisible: false },
    { id: 'supplier', label: 'Supplier', alwaysVisible: false },
    { id: 'linkedReason', label: 'Linked Reason', alwaysVisible: false },
    { id: 'priority', label: 'Priority', alwaysVisible: false },
    { id: 'generation', label: 'Generation', alwaysVisible: false },
    { id: 'status', label: 'Status', alwaysVisible: false },
    { id: 'editable', label: 'Editable', alwaysVisible: false },
    { id: 'createdBy', label: 'Created By', alwaysVisible: false },
    { id: 'date', label: 'Date', alwaysVisible: false },
    { id: 'actions', label: 'Actions', alwaysVisible: true },
  ];

  // Page key for DB-backed preferences (persists across logout, browser close, device change)
  const REQUISITION_COLUMNS_PAGE_KEY = 'purchase_view_requisitions_columns';

  // Storage key for column visibility (localStorage fallback/cache)
  const columnVisibilityStorageKey = currentUser?.id
    ? `requisitionTableColumnVisibility_${currentUser.id}`
    : 'requisitionTableColumnVisibility';

  // Get default column visibility
  const getDefaultColumnVisibility = (): Record<string, boolean> => {
    const defaults: Record<string, boolean> = {};
    allColumns.forEach(col => {
      if (col.alwaysVisible) {
        defaults[col.id] = true;
      } else if (col.id === 'department') {
        defaults[col.id] = isSuperAdmin;
      } else if (col.id === 'supplier' && !canViewSupplierAndStatus) {
        defaults[col.id] = false;
      } else if (col.id === 'editable' && !canViewEditableColumn) {
        defaults[col.id] = false;
      } else if (col.id === 'status') {
        defaults[col.id] = canViewStatus;
      } else if (!showDraftsOnly) {
        defaults[col.id] = true;
      } else {
        defaults[col.id] = false;
      }
    });
    return defaults;
  };

  // Load column visibility preferences from localStorage (per-user key)
  const loadColumnVisibility = (storageKey: string): Record<string, boolean> => {
    if (typeof window === 'undefined') return getDefaultColumnVisibility();
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const defaults = getDefaultColumnVisibility();
        return { ...defaults, ...parsed };
      }
    } catch (error) {
      console.error('Error loading column visibility preferences:', error);
    }
    return getDefaultColumnVisibility();
  };

  // Initialize column visibility state (defaults first; user-specific prefs applied in useEffect)
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    return getDefaultColumnVisibility();
  });

  // When currentUser becomes available, load column preferences from DB first, then localStorage, then defaults.
  // This runs every time the user visits the page so columns are shown according to saved preferences.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const defaults = getDefaultColumnVisibility();

    if (!currentUser?.id) {
      setColumnVisibility(loadColumnVisibility(columnVisibilityStorageKey));
      return;
    }

    let cancelled = false;
    fetch(`/api/user/preferences/page?pageKey=${encodeURIComponent(REQUISITION_COLUMNS_PAGE_KEY)}`, { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled) return;
        if (data?.value && typeof data.value === 'object') {
          const saved = data.value as Record<string, boolean>;
          const merged = { ...defaults };
          Object.keys(saved).forEach(key => {
            if (allColumns.some(c => c.id === key)) merged[key] = saved[key];
          });
          setColumnVisibility(merged);
        } else {
          setColumnVisibility(loadColumnVisibility(columnVisibilityStorageKey));
        }
      })
      .catch(() => {
        if (!cancelled) setColumnVisibility(loadColumnVisibility(columnVisibilityStorageKey));
      });

    return () => { cancelled = true; };
  }, [currentUser?.id]);

  // Save column visibility: persist to DB (so it survives logout/device change) and to localStorage (cache).
  // Save full visibility state so restore is accurate across sessions/devices.
  const saveColumnVisibility = useCallback((visibility: Record<string, boolean>) => {
    const toSave: Record<string, boolean> = {};
    allColumns.forEach(col => {
      if (visibility[col.id] !== undefined) {
        toSave[col.id] = visibility[col.id];
      }
    });

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(columnVisibilityStorageKey, JSON.stringify(toSave));
      } catch (e) {
        console.error('Error saving column visibility to localStorage:', e);
      }
    }

    if (currentUser?.id) {
      fetch('/api/user/preferences/page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pageKey: REQUISITION_COLUMNS_PAGE_KEY, value: toSave }),
      }).catch(err => console.error('Error saving column visibility to server:', err));
    }
  }, [currentUser?.id, columnVisibilityStorageKey]);

  // Handle column visibility change
  const handleColumnVisibilityChange = (columnId: string, visible: boolean) => {
    const newVisibility = { ...columnVisibility, [columnId]: visible };
    setColumnVisibility(newVisibility);
    saveColumnVisibility(newVisibility);
  };

  // Filter columns based on access level and draft mode (Status only when canViewStatus)
  const getAvailableColumns = () => {
    return allColumns.filter(col => {
      if (col.id === 'department' && !isSuperAdmin) return false;
      if (col.id === 'supplier' && !canViewSupplierAndStatus) return false;
      if (col.id === 'status' && !canViewStatus) return false;
      if (col.id === 'editable' && !canViewEditableColumn) return false;
      if (showDraftsOnly && ['poNumber', 'supplier', 'linkedReason', 'priority', 'generation'].includes(col.id)) {
        return false;
      }
      return true;
    });
  };

  // Get current user's access level - always use database field
  const currentUserAccessLevel = currentUser?.designationAccessLevel ?? 0;
  const canUserCreateRequisitions = canCreateRequisition(currentUserAccessLevel);
  const isUserMaster = isMaster(currentUserAccessLevel);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    onFiltersChange({
      search: value || undefined,
      requisitionType: typeFilter === "all" ? undefined : (typeFilter as RequisitionType),
      status: statusFilter === "all" ? undefined : (statusFilter as RequisitionStatus),
      generationStatus: generationStatusFilter === "all" ? undefined : (generationStatusFilter as GenerationStatus),
    });
  };

  const handleTypeFilter = (value: string) => {
    setTypeFilter(value);
    onFiltersChange({
      search: searchTerm || undefined,
      requisitionType: value === "all" ? undefined : (value as RequisitionType),
      status: statusFilter === "all" ? undefined : (statusFilter as RequisitionStatus),
      generationStatus: generationStatusFilter === "all" ? undefined : (generationStatusFilter as GenerationStatus),
    });
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    onFiltersChange({
      search: searchTerm || undefined,
      requisitionType: typeFilter === "all" ? undefined : (typeFilter as RequisitionType),
      status: value === "all" ? undefined : (value as RequisitionStatus),
      generationStatus: generationStatusFilter === "all" ? undefined : (generationStatusFilter as GenerationStatus),
    });
  };

  const handleGenerationStatusFilter = (value: string) => {
    setGenerationStatusFilter(value);
    onFiltersChange({
      search: searchTerm || undefined,
      requisitionType: typeFilter === "all" ? undefined : (typeFilter as RequisitionType),
      status: statusFilter === "all" ? undefined : (statusFilter as RequisitionStatus),
      generationStatus: value === "all" ? undefined : (value as GenerationStatus),
    });
  };

  const handleDeleteClick = (requisition: Requisition) => {
    setRequisitionToDelete(requisition);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (requisitionToDelete) {
      onDelete(requisitionToDelete);
      setDeleteDialogOpen(false);
      setRequisitionToDelete(null);
    }
  };

  const canEditRequisition = (requisition: Requisition): boolean => {
    // Once status is NEW_REQ, requisition items and details cannot be modified
    if (requisition.status === RequisitionStatus.NEW_REQ) {
      return false;
    }
    
    // Requisitions with QUOTE_CONFIRMED_PO_SENT status cannot be edited (PO has been sent)
    if (requisition.status === RequisitionStatus.QUOTE_CONFIRMED_PO_SENT) {
      return false;
    }
    
    // Requisitions that are received/delivered cannot be edited
    if (requisition.status === RequisitionStatus.REQ_RECEIVED_DELIVERED) {
      return false;
    }
    
    // Check if requisition is marked as editable
    if (!requisition.isEditable) {
      return false;
    }
    
    // NOT_READY + isEditable: drafts only (SAVED_AS_DRAFT). Submitted (CREATED) has isEditable false.
    if (requisition.status === RequisitionStatus.NOT_READY) {
      return (
        requisition.createdById === currentUser?.id ||
        isAdminEquivalentAccessLevel(currentUser?.designationAccessLevel)
      );
    }

    // For drafts (SAVED_AS_DRAFT), check generation status
    if (requisition.generationStatus === GenerationStatus.SAVED_AS_DRAFT) {
      return (
        requisition.createdById === currentUser?.id ||
        isAdminEquivalentAccessLevel(currentUser?.designationAccessLevel)
      );
    }
    
    return false;
  };

  const canDeleteRequisition = (requisition: Requisition): boolean => {
    // Only drafts can be deleted
    if (requisition.generationStatus !== GenerationStatus.SAVED_AS_DRAFT) {
      return false;
    }
    
    return (
      requisition.createdById === currentUser?.id ||
      isAdminEquivalentAccessLevel(currentUser?.designationAccessLevel)
    );
  };

  const canApproveRequisition = (requisition: Requisition): boolean => {
    if (requisition.parentRequisitionId) {
      return false;
    }

    const lvl = currentUserAccessLevel;
    const crewReq = isCrewOriginatedRequisitionNumber(requisition.requisitionNumber);

    // 1) NOT_READY + CREATED: V.*/T.* → Master (25); O.* → office 39 / 50 / admins (crew submits draft first)
    if (
      requisition.generationStatus === GenerationStatus.CREATED &&
      requisition.status === RequisitionStatus.NOT_READY
    ) {
      return crewReq
        ? !!canMasterApproveVesselRequisitionDraft(lvl)
        : !!canOfficeApproveNotReadyRequisition(lvl);
    }

    // 2) NEW_REQ → REQ_APPROVED: 37 (only this status), 39, 50, admins
    if (requisition.status === RequisitionStatus.NEW_REQ) {
      if (lvl === 37) return true;
      return [39, 50].includes(lvl) || isAdminEquivalentAccessLevel(lvl);
    }

    return false;
  };

  const canSendForQuote = (requisition: Requisition): boolean => {
    // Only users with access level 32, 33, or admin-equivalent can send for quote
    if (currentUserAccessLevel !== 32 && currentUserAccessLevel !== 33 && !isAdminEquivalentAccessLevel(currentUserAccessLevel)) {
      return false;
    }
    
    // Disable if a Purchase Order has been issued
    // Check if status is QUOTE_CONFIRMED_PO_SENT or if there are any purchase orders
    if (requisition.status === RequisitionStatus.QUOTE_CONFIRMED_PO_SENT) {
      return false;
    }
    
    // Check if there are any purchase orders (non-cancelled) for this requisition
    if (requisition.activePurchaseOrderCount != null) {
      if (requisition.activePurchaseOrderCount > 0) return false;
    } else if (requisition.purchaseOrders && requisition.purchaseOrders.length > 0) {
      const activePOs = requisition.purchaseOrders.filter((po: any) => po.status !== 'CANCELLED');
      if (activePOs.length > 0) return false; // PO has been issued, cannot send for quote
    }
    
    // Can send for quote if requisition is in any of these statuses:
    // - REQ_APPROVED: Initial approval
    // - SENT_FOR_QUOTE: Already sent, but can resend to more vendors
    // - QUOTE_RECEIVED: Quotes received, but can still send to more vendors
    // - PARTIAL_QUOTE_RECEIVED: Partial quotes, can send to more vendors
    // - QUOTE_APPROVED: Quote approved, but can still send to more vendors if needed
    // This allows resending to failed vendors or adding more vendors even if some quotes were already received
    return requisition.status === RequisitionStatus.REQ_APPROVED || 
           requisition.status === RequisitionStatus.SENT_FOR_QUOTE ||
           requisition.status === RequisitionStatus.QUOTE_RECEIVED ||
           requisition.status === RequisitionStatus.PARTIAL_QUOTE_RECEIVED ||
           requisition.status === RequisitionStatus.QUOTE_APPROVED;
  };

  const canCancel = (requisition: Requisition): boolean => {
    // Check access level
    if (!canCancelRequisition(currentUserAccessLevel)) {
      return false;
    }
    
    // Cannot cancel if already cancelled
    if (requisition.status === RequisitionStatus.CANCELLED) {
      return false;
    }
    
    // Cannot cancel requisition if purchase order has been issued
    // Once a PO is issued, the requisition cannot be cancelled directly
    // User must first cancel the purchase order
    if (
      requisition.status === RequisitionStatus.QUOTE_CONFIRMED_PO_SENT ||
      requisition.status === RequisitionStatus.REQ_RECEIVED_DELIVERED
    ) {
      return false;
    }
    
    return true;
  };

  const canCancelPurchaseOrder = (requisition: Requisition): boolean => {
    // Check access level - same as cancel requisition (32, 33, 39, 50)
    if (!canCancelRequisition(currentUserAccessLevel)) {
      return false;
    }
    
    // Can only cancel PO if requisition status indicates PO was sent
    // and requisition is not already cancelled
    if (requisition.status === RequisitionStatus.CANCELLED) {
      return false;
    }
    
    // Cannot cancel PO if requisition status is REQ_RECEIVED_DELIVERED (items already delivered)
    if (requisition.status === RequisitionStatus.REQ_RECEIVED_DELIVERED) {
      return false;
    }
    
    // Can cancel PO if status is QUOTE_CONFIRMED_PO_SENT (PO sent but not yet delivered)
    return requisition.status === RequisitionStatus.QUOTE_CONFIRMED_PO_SENT;
  };

  const canReturn = (requisition: Requisition): boolean => {
    // Check access level
    if (!canReturnRequisition(currentUserAccessLevel)) {
      return false;
    }
    
    // Cannot return if cancelled
    if (requisition.status === RequisitionStatus.CANCELLED) {
      return false;
    }
    
    // Can return if requisition is in approved or later status (but not cancelled)
    return requisition.status === RequisitionStatus.REQ_APPROVED || 
           requisition.status === RequisitionStatus.SENT_FOR_QUOTE ||
           requisition.status === RequisitionStatus.QUOTE_RECEIVED ||
           requisition.status === RequisitionStatus.PARTIAL_QUOTE_RECEIVED;
  };

  const canConfirmQuote = (requisition: Requisition): boolean => {
    // Only users with access level 32, 33, or 50 can confirm quotes
    const userLevel = currentUserAccessLevel ?? 0;
    if (userLevel !== 32 && userLevel !== 33 && !isAdminEquivalentAccessLevel(userLevel)) {
      return false;
    }
    
    // Can confirm if requisition status is QUOTE_APPROVED (quote has been approved by level 37/39)
    // Handle both enum and string comparison for robustness
    const status = requisition.status as string;
    return status === RequisitionStatus.QUOTE_APPROVED || status === 'QUOTE_APPROVED';
  };

  const canShowQuoteComparison = (requisition: Requisition): boolean => {
    const status = requisition.status as string;
    return (
      status === RequisitionStatus.SENT_FOR_QUOTE ||
      status === RequisitionStatus.QUOTE_RECEIVED ||
      status === RequisitionStatus.PARTIAL_QUOTE_RECEIVED ||
      status === RequisitionStatus.QUOTE_APPROVED ||
      status === RequisitionStatus.SPLIT ||
      status === RequisitionStatus.QUOTE_CONFIRMED_PO_SENT
    );
  };

  const canDownloadQuotes = (requisition: Requisition): boolean => {
    // Users with access level 32, 33, 37, 39, 41, 44, 47, 48, or admin-equivalent can download quotes
    const userLevel = currentUserAccessLevel ?? 0;
    const allowedLevels = [32, 33, 37, 39, 41, 44, 47, 48];
    if (!allowedLevels.includes(userLevel) && !isAdminEquivalentAccessLevel(userLevel)) {
      return false;
    }
    
    // Can download if requisition has quotes (status indicates quotes were received)
    const status = requisition.status as string;
    return status === RequisitionStatus.QUOTE_RECEIVED || 
           status === RequisitionStatus.PARTIAL_QUOTE_RECEIVED ||
           status === RequisitionStatus.QUOTE_APPROVED ||
           status === RequisitionStatus.QUOTE_CONFIRMED_PO_SENT ||
           status === RequisitionStatus.SENT_FOR_QUOTE;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Get icon for requisition type
  const getTypeIcon = (type: RequisitionType) => {
    switch (type) {
      case RequisitionType.SPR:
        return Wrench;
      case RequisitionType.PNT:
        return Paintbrush;
      case RequisitionType.GLY:
        return Soup;
      case RequisitionType.STR:
        return ShoppingCart;
      case RequisitionType.PRO:
        return UtensilsCrossed;
      case RequisitionType.REP:
      case RequisitionType.SER:
        return Settings;
      default:
        return Package;
    }
  };

  // Check if requisition needs alert indicator
  const needsAlert = (requisition: Requisition): boolean => {
    // Check for high urgency items
    const hasUrgentItems = requisition.items?.some((item: any) => 
      item.urgency === 'URGENT' || item.urgency === 'HIGH'
    );
    
    // Check for declined suppliers
    const hasDeclinedSuppliers = requisition.quoteStats?.declinedQuotes && requisition.quoteStats.declinedQuotes > 0;
    
    // Check for overdue (if closeBefore exists)
    // Note: closeBefore might not exist in Requisition model, so this is optional
    
    return hasUrgentItems || hasDeclinedSuppliers || false;
  };

  // Update column visibility when user access level or draft mode changes
  useEffect(() => {
    const current = loadColumnVisibility(columnVisibilityStorageKey);
    const defaults = getDefaultColumnVisibility();
    
    // Merge current preferences with defaults, ensuring always-visible columns are always true
    const merged: Record<string, boolean> = {};
    allColumns.forEach(col => {
      if (col.alwaysVisible) {
        merged[col.id] = true;
      } else if (col.id === 'department' && !isSuperAdmin) {
        merged[col.id] = false;
      } else {
        merged[col.id] = current[col.id] !== undefined ? current[col.id] : defaults[col.id];
      }
    });
    
    setColumnVisibility(merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, showDraftsOnly]);

  const availableColumns = getAvailableColumns();

  const columnLayoutContext = useMemo(
    (): RequisitionColumnLayoutContext => ({
      columnVisibility,
      showDraftsOnly,
      isSuperAdmin,
      canViewSupplierAndStatus,
      canViewStatus,
      canViewEditableColumn,
    }),
    [
      columnVisibility,
      showDraftsOnly,
      isSuperAdmin,
      canViewSupplierAndStatus,
      canViewStatus,
      canViewEditableColumn,
    ]
  );

  const visibleColumnCount = useMemo(
    () => countVisibleRequisitionColumns(columnLayoutContext),
    [columnLayoutContext]
  );
  const enableHorizontalScroll =
    visibleColumnCount > REQUISITION_SCROLL_COLUMN_THRESHOLD;
  const columnWidths = useMemo(
    () => buildRequisitionColumnWidths(columnLayoutContext),
    [columnLayoutContext]
  );
  const tableBodyColSpan = Math.max(visibleColumnCount - 1, 1);

  return (
    <div className="w-full min-w-0 space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search requisitions..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {/* Column Visibility Toggle */}
          <Dialog open={columnVisibilityDialogOpen} onOpenChange={setColumnVisibilityDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Columns className="h-4 w-4" />
                Columns
              </Button>
            </DialogTrigger>
            <DialogContent >
              <DialogHeader>
                <DialogTitle>Select Visible Columns</DialogTitle>
                <DialogDescription>
                  Choose which columns to display in the table. Your preferences will be saved.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 max-h-[400px] overflow-y-auto py-4">
                {availableColumns.map((col) => (
                  <div key={col.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={col.id}
                      checked={columnVisibility[col.id] ?? false}
                      onCheckedChange={(checked) => {
                        if (!col.alwaysVisible) {
                          handleColumnVisibilityChange(col.id, checked as boolean);
                        }
                      }}
                      disabled={col.alwaysVisible}
                    />
                    <Label
                      htmlFor={col.id}
                      className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                        col.alwaysVisible ? 'text-gray-400' : 'cursor-pointer'
                      }`}
                    >
                      {col.label}
                      {col.alwaysVisible && <span className="text-xs text-gray-400 ml-1">(Required)</span>}
                    </Label>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    const defaults = getDefaultColumnVisibility();
                    setColumnVisibility(defaults);
                    saveColumnVisibility(defaults);
                  }}
                >
                  Reset to Default
                </Button>
                <Button onClick={() => setColumnVisibilityDialogOpen(false)}>
                  Done
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Select value={typeFilter} onValueChange={handleTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(REQUISITION_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!showDraftsOnly && (
            <Select value={generationStatusFilter} onValueChange={handleGenerationStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Generation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {Object.entries(GENERATION_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {canViewStatus && (
            <Select value={statusFilter} onValueChange={handleStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(REQUISITION_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Table — fills card width; horizontal scroll only when >15 columns visible */}
      <div
        className={
          enableHorizontalScroll
            ? "rounded-md border overflow-x-auto"
            : "rounded-md border w-full min-w-0"
        }
      >
        <Table
          className={
            enableHorizontalScroll ? "w-full min-w-max table-auto" : "w-full table-fixed"
          }
        >
          {!enableHorizontalScroll && (
            <colgroup>
              <col style={{ width: columnWidths._sno }} />
              {getVisibleRequisitionDataColumnIds(columnLayoutContext).map((id) => (
                <col key={id} style={{ width: columnWidths[id] }} />
              ))}
              {columnVisibility.actions && (
                <col style={{ width: columnWidths.actions }} />
              )}
            </colgroup>
          )}
          <TableHeader>
            <TableRow className="[&>th:first-child]:pl-3 [&>th:last-child]:pr-3">
              <TableSerialHead label="S.No." style={REQUISITION_S_NO_COLUMN_STYLE} />
              {isRequisitionDataColumnVisible("reqNumber", columnLayoutContext) && (
                <TableHead className={requisitionColumnHeadClass("reqNumber")}>
                  Req. Number
                </TableHead>
              )}
              {isRequisitionDataColumnVisible("heading", columnLayoutContext) && (
                <TableHead className={requisitionColumnHeadClass("heading")}>
                  Heading
                </TableHead>
              )}
              {isRequisitionDataColumnVisible("department", columnLayoutContext) && (
                <TableHead className={requisitionColumnHeadClass("department")}>
                  Department
                </TableHead>
              )}
              {isRequisitionDataColumnVisible("type", columnLayoutContext) && (
                <TableHead className={requisitionColumnHeadClass("type")}>
                  Type
                </TableHead>
              )}
              {isRequisitionDataColumnVisible("vessel", columnLayoutContext) && (
                <TableHead className={requisitionColumnHeadClass("vessel")}>
                  Vessel
                </TableHead>
              )}
              {isRequisitionDataColumnVisible("poNumber", columnLayoutContext) && (
                <TableHead className={requisitionColumnHeadClass("poNumber")}>
                  PO Number
                </TableHead>
              )}
              {isRequisitionDataColumnVisible("supplier", columnLayoutContext) && (
                <TableHead className={requisitionColumnHeadClass("supplier")}>
                  Supplier
                </TableHead>
              )}
              {isRequisitionDataColumnVisible("linkedReason", columnLayoutContext) && (
                <TableHead className={requisitionColumnHeadClass("linkedReason")}>
                  Linked Reason
                </TableHead>
              )}
              {isRequisitionDataColumnVisible("priority", columnLayoutContext) && (
                <TableHead className={requisitionColumnHeadClass("priority")}>
                  Priority
                </TableHead>
              )}
              {isRequisitionDataColumnVisible("generation", columnLayoutContext) && (
                <TableHead className={requisitionColumnHeadClass("generation")}>
                  Generation
                </TableHead>
              )}
              {isRequisitionDataColumnVisible("status", columnLayoutContext) && (
                <TableHead className={requisitionColumnHeadClass("status")}>
                  Status
                </TableHead>
              )}
              {isRequisitionDataColumnVisible("editable", columnLayoutContext) && (
                <TableHead className={requisitionColumnHeadClass("editable")}>
                  Editable
                </TableHead>
              )}
              {isRequisitionDataColumnVisible("createdBy", columnLayoutContext) && (
                <TableHead className={requisitionColumnHeadClass("createdBy")}>
                  Created By
                </TableHead>
              )}
              {isRequisitionDataColumnVisible("date", columnLayoutContext) && (
                <TableHead className={requisitionColumnHeadClass("date")}>
                  Date
                </TableHead>
              )}
              {columnVisibility.actions && (
                <TableHead className={requisitionColumnHeadClass("actions")}>Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableSerialCell serialNo={1} style={REQUISITION_S_NO_COLUMN_STYLE} />
                <TableCell colSpan={tableBodyColSpan} className="text-center py-8">
                  <ActiniumLoader size="md" text="Loading requisitions..." />
                </TableCell>
              </TableRow>
            ) : requisitions.length === 0 ? (
              <TableRow>
                <TableSerialCell serialNo={1} style={REQUISITION_S_NO_COLUMN_STYLE} />
                <TableCell colSpan={tableBodyColSpan} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-8 w-8 text-gray-400" />
                    <p className="text-gray-500">No requisitions found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {visibleTreeRows.map((row, index) => {
                  const requisition = row.requisition;
                  const isDeleted = !!(requisition as any).deletedAt;
                  const urgency = (requisition as any).priority;
                  const rowBg = isDeleted
                    ? "bg-red-100 hover:bg-red-200/90"
                    : urgency === "URGENT"
                      ? "bg-yellow-100 hover:bg-yellow-200/90"
                      : urgency === "CRITICAL"
                        ? "bg-orange-100 hover:bg-orange-200/90"
                        : "";
                  const isHighlight = highlightRequisitionId === requisition.id;
                  const rowClassName = [
                    rowBg,
                    row.isChild ? "bg-muted/20" : "",
                    isHighlight ? "requisition-row-highlight" : "",
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined;
                  return (
                  <TableRow
                    key={requisition.id}
                    ref={isHighlight ? highlightRowRef : undefined}
                    className={[
                      rowClassName,
                      "[&>td:first-child]:pl-3 [&>td:last-child]:pr-3",
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined}
                    data-requisition-depth={row.depth}
                  >
                  <TableSerialCell
                    serialNo={tableSerialNo(page, limit, index)}
                    style={REQUISITION_S_NO_COLUMN_STYLE}
                  />
                  {isRequisitionDataColumnVisible("reqNumber", columnLayoutContext) && (
                    <TableCell className={requisitionColumnCellClass("reqNumber")}>
                      <div
                        className="flex items-center gap-1 min-w-0"
                        style={{ paddingLeft: row.depth * 16 }}
                      >
                        {row.hasChildren ? (
                          <button
                            type="button"
                            onClick={() => toggleParentCollapse(requisition.id)}
                            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-muted"
                            aria-label={collapsedParentIds.has(requisition.id) ? "Expand split requisitions" : "Collapse split requisitions"}
                          >
                            {collapsedParentIds.has(requisition.id) ? (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                        ) : row.isChild ? (
                          <span className="inline-block w-5 shrink-0 text-center text-xs text-muted-foreground" aria-hidden>
                            └
                          </span>
                        ) : (
                          <span className="inline-block w-5 shrink-0" aria-hidden />
                        )}
                        {onRequisitionNumberClick ? (
                          <button
                            onClick={() => onRequisitionNumberClick(requisition)}
                            className={
                              row.isChild
                                ? "truncate text-left font-medium text-violet-700 hover:text-violet-900 hover:underline cursor-pointer"
                                : "truncate text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
                            }
                          >
                            {requisition.requisitionNumber}
                          </button>
                        ) : (
                          <span
                            className={
                              row.isChild
                                ? "truncate font-medium text-violet-700"
                                : "truncate"
                            }
                          >
                            {requisition.requisitionNumber}
                          </span>
                        )}
                        {row.isChild && (
                          <Badge variant="outline" className="shrink-0 border-violet-300 px-1 py-0 text-[10px] text-violet-700">
                            Split
                          </Badge>
                        )}
                        {row.hasChildren && requisition.status === RequisitionStatus.SPLIT && (
                          <Badge variant="secondary" className="shrink-0 text-[10px] px-1 py-0">
                            Split · {row.childCount}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  )}
                  {isRequisitionDataColumnVisible("heading", columnLayoutContext) && (
                    <TableCell className={requisitionColumnCellClass("heading")}>
                      <div className="flex flex-wrap items-center gap-1">
                        <span>{requisition.heading}</span>
                        {(requisition.heading?.startsWith('Auto-Generated') || (requisition as any).reorderAlerts?.length > 0) && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300 shrink-0">
                            Auto
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  )}
                  {isRequisitionDataColumnVisible("department", columnLayoutContext) && (
                    <TableCell className={requisitionColumnCellClass("department")}>
                      <span className="text-sm text-slate-900">
                        {requisition.subCategoryName ?? "—"}
                      </span>
                    </TableCell>
                  )}
                  {isRequisitionDataColumnVisible("type", columnLayoutContext) && (
                    <TableCell className={requisitionColumnCellClass("type")}>
                      <div className="flex flex-wrap items-center gap-1">
                        {(() => {
                          const IconComponent = getTypeIcon(requisition.requisitionType);
                          return <IconComponent className="h-4 w-4 text-slate-600" />;
                        })()}
                        <RequisitionTypeBadge type={requisition.requisitionType} className="text-xs" />
                        {needsAlert(requisition) && (
                          <AlertCircleIcon className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </TableCell>
                  )}
                  {isRequisitionDataColumnVisible("vessel", columnLayoutContext) && (
                    <TableCell className={requisitionColumnCellClass("vessel")}>
                      <div className="flex items-center gap-1">
                        <Ship className="h-4 w-4 text-gray-400" />
                        <span>{requisition.vessel?.code || requisition.vessel?.name || '—'}</span>
                      </div>
                    </TableCell>
                  )}
                  {isRequisitionDataColumnVisible("poNumber", columnLayoutContext) && (
                    <TableCell className={requisitionColumnCellClass("poNumber")}>
                      {requisition.purchaseOrders && requisition.purchaseOrders.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {requisition.purchaseOrders.slice(0, 2).map((po, index) => (
                            <a
                              key={po.id}
                              href={`/purchase/view-pos?poId=${po.id}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                              onClick={(e) => {
                                e.preventDefault();
                                window.location.href = `/purchase/view-pos?poId=${po.id}`;
                              }}
                            >
                              {po.poNumber}
                            </a>
                          ))}
                          {(requisition.purchaseOrderCount ?? requisition.purchaseOrders.length) > 2 && (
                            <span className="text-xs text-gray-500">
                              +{(requisition.purchaseOrderCount ?? requisition.purchaseOrders.length) - 2} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </TableCell>
                  )}
                  {isRequisitionDataColumnVisible("supplier", columnLayoutContext) && (
                    <TableCell className={requisitionColumnCellClass("supplier")}>
                      {requisition.quoteStats && requisition.quoteStats.totalQuotesSent > 0 ? (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-gray-400" />
                          <div className="flex flex-col">
                            <span className={`text-sm ${
                              requisition.quoteStats.receivedQuotes + requisition.quoteStats.declinedQuotes === requisition.quoteStats.totalQuotesSent
                                ? 'text-green-600'
                                : requisition.quoteStats.receivedQuotes + requisition.quoteStats.declinedQuotes > 0
                                ? 'text-yellow-600'
                                : 'text-red-600'
                            }`}>
                              Received {requisition.quoteStats.receivedQuotes}/{requisition.quoteStats.totalQuotesSent}
                            </span>
                            {requisition.quoteStats.declinedQuotes > 0 && (
                              <button
                                type="button"
                                className="text-xs text-red-600 underline-offset-2 hover:underline text-left"
                                onClick={() => {
                                  const declinedVendors = (requisition.vendorQuotes || [])
                                    .filter((vq: any) => vq.status === 'REJECTED' || vq.status === 'DECLINED')
                                    .map((vq: any) => vq.vendor?.name || `Vendor ${vq.vendorId}`);
                                  const message = declinedVendors.length
                                    ? `Vendors declined to quote:\n\n${declinedVendors.join("\n")}`
                                    : "No vendors have declined to quote.";
                                  alert(message);
                                }}
                              >
                                Declined {requisition.quoteStats.declinedQuotes}/{requisition.quoteStats.totalQuotesSent}
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </TableCell>
                  )}
                  {isRequisitionDataColumnVisible("linkedReason", columnLayoutContext) && (
                    <TableCell className={requisitionColumnCellClass("linkedReason")}>
                      {requisition.linkedReason ? (
                        <div className="text-sm">
                          <div className="font-medium text-slate-900 break-words">
                            {requisition.linkedReasonType || 'Linked'}
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5 break-words">
                            {requisition.linkedReason}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </TableCell>
                  )}
                  {isRequisitionDataColumnVisible("priority", columnLayoutContext) && (
                    <TableCell className={requisitionColumnCellClass("priority")}>
                      <Badge
                        className={
                          requisition.priority === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                          requisition.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                          requisition.priority === 'LOW' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }
                      >
                        {requisition.priority || 'NORMAL'}
                      </Badge>
                    </TableCell>
                  )}
                  {isRequisitionDataColumnVisible("generation", columnLayoutContext) && (
                    <TableCell className={requisitionColumnCellClass("generation")}>
                      <RequisitionGenerationStatusBadge
                        status={requisition.generationStatus}
                        className="text-xs"
                      >
                        {GENERATION_STATUS_LABELS[requisition.generationStatus]}
                      </RequisitionGenerationStatusBadge>
                    </TableCell>
                  )}
                  {isRequisitionDataColumnVisible("status", columnLayoutContext) && (
                    <TableCell className={requisitionColumnCellClass("status")}>
                      {requisition.status === RequisitionStatus.PARTIAL_QUOTE_RECEIVED &&
                       requisition.quoteStats &&
                       requisition.quoteStats.totalQuotesSent > 0 ? (
                        <RequisitionStatusBadge status={requisition.status} className="text-xs">
                          {requisition.quoteStats.receivedQuotes}/{requisition.quoteStats.totalQuotesSent} Received
                          {requisition.quoteStats.declinedQuotes > 0 && (
                            <span className="ml-1">{requisition.quoteStats.declinedQuotes} Decline</span>
                          )}
                        </RequisitionStatusBadge>
                      ) : (
                        <RequisitionStatusBadge status={requisition.status} className="text-xs">
                          {requisition.status != null && REQUISITION_STATUS_LABELS[requisition.status] != null
                            ? REQUISITION_STATUS_LABELS[requisition.status]
                            : (requisition as any).status ?? "—"}
                        </RequisitionStatusBadge>
                      )}
                    </TableCell>
                  )}
                  {isRequisitionDataColumnVisible("editable", columnLayoutContext) && (
                    <TableCell className={requisitionColumnCellClass("editable")}>
                      <div className="flex items-center gap-1">
                        {requisition.isEditable ? (
                          <>
                            <Unlock className="h-4 w-4 text-green-500" />
                            <span className="text-green-600 text-sm">Yes</span>
                          </>
                        ) : (
                          <>
                            <Lock className="h-4 w-4 text-red-500" />
                            <span className="text-red-600 text-sm">No</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                  )}
                  {isRequisitionDataColumnVisible("createdBy", columnLayoutContext) && (
                    <TableCell className={requisitionColumnCellClass("createdBy")}>
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4 text-gray-400" />
                        <span>
                          {requisition.createdBy 
                            ? `${requisition.createdBy.firstName} ${requisition.createdBy.lastName}`
                            : 'Unknown'
                          }
                        </span>
                      </div>
                    </TableCell>
                  )}
                  {isRequisitionDataColumnVisible("date", columnLayoutContext) && (
                    <TableCell className={requisitionColumnCellClass("date")}>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span>{formatDate(requisition.dateOfCreation)}</span>
                      </div>
                    </TableCell>
                  )}
                  {columnVisibility.actions && (
                    <TableCell className={requisitionColumnCellClass("actions")}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onView(requisition)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          
                          {canEditRequisition(requisition) && (
                            <DropdownMenuItem onClick={() => onEdit(requisition)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Requisition
                            </DropdownMenuItem>
                          )}
                          
                          {showApprovalActions && canApproveRequisition(requisition) && onApprove && (
                            <DropdownMenuItem onClick={() => onApprove(requisition)}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Approve Requisition
                            </DropdownMenuItem>
                          )}
                          
                          {canSendForQuote(requisition) && onSendForQuote && (
                            <DropdownMenuItem onClick={() => onSendForQuote(requisition)}>
                              <Send className="mr-2 h-4 w-4" />
                              Send for Quote
                            </DropdownMenuItem>
                          )}
                          
                          {canViewQuoteComparison &&
                            canShowQuoteComparison(requisition) &&
                            onViewQuotes && (
                            <DropdownMenuItem onClick={() => onViewQuotes(requisition)}>
                              <TrendingUp className="mr-2 h-4 w-4" />
                              Quote Comparison
                            </DropdownMenuItem>
                          )}
                          
                          {canCancel(requisition) && onCancel && (
                            <DropdownMenuItem 
                              onClick={() => onCancel(requisition)}
                              className="text-orange-600"
                            >
                              <X className="mr-2 h-4 w-4" />
                              Cancel Requisition
                            </DropdownMenuItem>
                          )}
                          
                          {canCancelPurchaseOrder(requisition) && onCancelPurchaseOrder && (
                            <DropdownMenuItem 
                              onClick={() => onCancelPurchaseOrder(requisition)}
                              className="text-red-600"
                            >
                              <X className="mr-2 h-4 w-4" />
                              Cancel Purchase Order
                            </DropdownMenuItem>
                          )}
                          
                          {canConfirmQuote(requisition) && onConfirmQuote && (
                            <DropdownMenuItem 
                              onClick={() => onConfirmQuote(requisition)}
                              className="text-green-600"
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Confirm Quote to Vendor
                            </DropdownMenuItem>
                          )}
                          
                          {canDownloadQuotes(requisition) && onDownloadQuotes && (
                            <DropdownMenuItem 
                              onClick={() => onDownloadQuotes(requisition)}
                              className="text-purple-600"
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download Quotes PDF
                            </DropdownMenuItem>
                          )}
                          
                          {canReturn(requisition) && onReturn && (
                            <DropdownMenuItem 
                              onClick={() => onReturn(requisition)}
                              className="text-blue-600"
                            >
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Return for Editing
                            </DropdownMenuItem>
                          )}
                          
                          {canDeleteRequisition(requisition) && (
                            <DropdownMenuItem 
                              onClick={() => handleDeleteClick(requisition)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Requisition
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
                  );
                })}
                {/* Empty row for scrollbar spacing */}
                <TableRow>
                  <TableSerialCell serialNo={1} style={REQUISITION_S_NO_COLUMN_STYLE} />
                  <TableCell colSpan={tableBodyColSpan} className="h-4 p-0" />
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        page={page}
        pageSize={limit}
        total={total}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={[10, 15, 25, 30, 50, 100]}
        itemLabel="requisitions"
        disabled={isLoading}
        className="pt-4"
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Requisition</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete requisition "{requisitionToDelete?.requisitionNumber}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
