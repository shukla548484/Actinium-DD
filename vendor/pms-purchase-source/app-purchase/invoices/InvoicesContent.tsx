"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQueryClient, useQueries } from "@tanstack/react-query";
import ActiniumLoader from "@/components/ActiniumLoader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TablePagination } from "@/components/ui/table-pagination";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  Edit, 
  Download, 
  Search, 
  FileText, 
  Ship,
  Calendar,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useVessels } from "@/hooks/useStaticData";
import {
  invoicesByVesselQueryKey,
  fetchInvoicesByVessel,
} from "@/hooks/useInvoicesByVessel";
import {
  purchaseOrdersListByVesselQueryKey,
  fetchPurchaseOrdersList,
} from "@/hooks/usePurchaseOrdersListByVessel";
import {
  ClearableInput,
  FilterFieldShell,
  filterTriggerClearPadding,
  filterMultiSelectClearClass,
} from "@/components/ui/clearable-input";
import { VesselMultiSelect } from "@/components/examples/VesselMultiSelect";
import { TableSerialHead, TableSerialCell } from "@/components/ui/table-serial-column";
import { COMMON_MARINE_CURRENCIES, formatCurrency, getCurrencyMeta, type CurrencyMeta } from "@/lib/utils/currency-shared";
import { checkInvoiceNumberAvailable } from "@/lib/purchase/check-invoice-number";
import { INVOICE_FILE_ACCEPT } from "@/lib/invoice-file-upload";
import { formatPurchaseAttachmentMaxSizeMb } from "@/lib/purchase/purchase-file-limits";
import { uploadInvoice, uploadInvoiceFileToStorage, uploadOwnerApprovalFileToStorage } from "@/lib/purchase/upload-invoice-client";
import { resolveInvoiceDisplayAmounts } from "@/lib/purchase-invoice-currency";
import {
  InvoiceUploadPoComparisonPanel,
  type InvoiceUploadPoContext,
} from "@/components/purchase/InvoiceUploadPoComparisonPanel";
import { InvoiceWorkbenchActionsMenu } from "@/components/purchase/InvoiceWorkbenchActionsMenu";
import {
  InvoiceEmailDialog,
  type InvoiceEmailRecipientType,
} from "@/components/purchase/InvoiceEmailDialog";
import { InvoicePlatformMessagesDialog } from "@/components/purchase/InvoicePlatformMessagesDialog";
import {
  InvoiceVerificationDialog,
  type InvoiceVerificationMode,
} from "@/components/purchase/InvoiceVerificationDialog";
import {
  buildInvoiceWorkbenchRows,
  mapPoListRecordToWorkbenchPo,
  type InvoiceWorkbenchInvoice,
  type InvoiceWorkbenchRow,
} from "@/lib/purchase/invoice-workbench";
import { downloadFilteredTableExcel } from "@/lib/client/download-filtered-excel";
import {
  canUploadPurchaseInvoice,
  DEFAULT_INVOICE_APPROVAL_LEVELS,
} from "@/lib/purchase/invoice-access";
import { tableSerialNo } from "@/lib/table-serial-column";
import { canRequestPoBudgetChange } from "@/lib/purchase/po-budget-change-access";
import { BudgetClassificationBadge } from "@/components/purchase/BudgetClassificationBadge";
import { openInvoiceFileDownload } from "@/lib/purchase/invoice-file-download-client";
import { resolveEffectiveIsBudgeted } from "@/lib/purchase/po-budget-classification";

// Accounting codes from the image
const ACCOUNT_TYPES = [
  // 100xx Series
  { value: "10010", label: "Running Expenses" },
  { value: "10011", label: "Engine Spares" },
  { value: "10012", label: "Deck Spares" },
  { value: "10013", label: "Electrical Spares" },
  { value: "10014", label: "Miscellaneous Spares" },
  { value: "10015", label: "Engine Store" },
  { value: "10016", label: "Deck Store" },
  { value: "10017", label: "Electrical Store" },
  { value: "10018", label: "Galley Store" },
  { value: "10019", label: "Stationary Store" },
  { value: "10020", label: "Charts and Publications" },
  { value: "10021", label: "Cabin Store" },
  { value: "10022", label: "Paint" },
  { value: "10023", label: "Chemicals" },
  { value: "10024", label: "Lubes" },
  { value: "10025", label: "Bunker" },
  { value: "10026", label: "Sludge" },
  { value: "10027", label: "Fresh Water" },
  { value: "10028", label: "Communication" },
  { value: "10029", label: "Deck Repair" },
  { value: "10030", label: "Engine Repair" },
  { value: "10031", label: "Electrical Repair" },
  { value: "10032", label: "Engine Reconditioning" },
  { value: "10033", label: "Electrical Reconditioning" },
  { value: "10034", label: "Medicines" },
  { value: "10035", label: "Tank Cleaning" },
  { value: "10036", label: "Agency Charges" },
  { value: "10037", label: "Spare Transport and Delivery" },
  { value: "10038", label: "TSI Travel" },
  { value: "10039", label: "Fuel Sample Analysis" },
  { value: "10040", label: "Lube Sample Analysis" },
  { value: "10041", label: "Ballast Water Sample Analysis" },
  { value: "10042", label: "Bilge Water Sample Analysis" },
  { value: "10043", label: "Other Sample Analysis" },
  // 200xx Series
  { value: "20010", label: "Bank Charges" },
  { value: "20011", label: "Currency Conversion Charges" },
  // 300xx Series
  { value: "30010", label: "Crew Travel" },
  { value: "30011", label: "Crew Medical" },
  { value: "30012", label: "Crew Agency" },
  { value: "30013", label: "Crew Expenses / Crew Salary / Crew Miscellaneous" },
  // 400xx Series
  { value: "40010", label: "Management Fee" },
  // 500xx Series
  { value: "50010", label: "Class" },
  { value: "50011", label: "Flag" },
  // 600xx Series
  { value: "60010", label: "Flight Charges" },
  // 700xx Series
  { value: "70010", label: "Office Rent" },
  { value: "70011", label: "Office Expenses" },
  { value: "70012", label: "Office Electrical Bill" },
  { value: "70013", label: "Office Staff Salary" },
  // 800xx Series
  { value: "80010", label: "Shipyard Repair" },
  // 900xx Series
  { value: "90010", label: "Bonus" },
  { value: "90011", label: "Claims" },
];

interface Vessel {
  id: string;
  name: string;
  code: string;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  requisition: {
    id: string;
    requisitionNumber: string;
    heading: string;
  };
  quote: {
    id: string;
    vendor: {
      id: string;
      name: string;
    };
  };
}

interface InvoiceBasedContract {
  id: string;
  contractNumber: string;
  title: string;
  currency: string;
  vendor: { id: string; name: string };
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceAmount: number;
  originalInvoiceAmount?: number | null;
  fxRateToUsd?: number | null;
  fxRateSource?: string | null;
  currency: string;
  accountType: string | null;
  status: string;
  invoiceFileUrl: string | null;
  ownerApprovalFileUrl?: string | null;
  ownerApprovalFileName?: string | null;
  purchaseOrder: {
    id: string;
    poNumber: string;
  } | null;
  purchaseOrderId?: string | null;
  levelOneApprovedAt?: string | null;
  requisition: {
    id: string;
    requisitionNumber: string;
    vessel: {
      id: string;
      name: string;
      code: string;
    };
  };
  vendor: {
    id: string;
    name: string;
  };
  createdAt: string;
}

const EMPTY_WORKBENCH_ROWS: InvoiceWorkbenchRow[] = [];

function poIssuedCostUsdMapsEqual(
  a: Record<string, number>,
  b: Record<string, number>
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

export function InvoicesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: currentUser } = useCurrentUser();
  const userAccessLevel = currentUser?.designationAccessLevel ?? null;
  const canUploadInvoice = canUploadPurchaseInvoice(userAccessLevel);
  const canRequestBudgetChange = canRequestPoBudgetChange(
    currentUser?.designationAccessLevel
  );
  const { ready, markSuccess } = usePageBootstrap();
  const queryClient = useQueryClient();
  
  // Use optimized hooks for static data with caching
  const { data: vessels = [], isLoading: vesselsLoading } = useVessels({ limit: 100, isActive: true });
  
  const [selectedVesselIds, setSelectedVesselIds] = useState<string[]>([]);
  const singleVesselId = selectedVesselIds.length === 1 ? selectedVesselIds[0] : "";
  const hasVesselSelection = selectedVesselIds.length > 0;
  const [searchTerm, setSearchTerm] = useState("");
  const [extraCurrencyCodes, setExtraCurrencyCodes] = useState<string[]>([]);
  const [poIssuedCostUsdByPoId, setPoIssuedCostUsdByPoId] = useState<Record<string, number>>({});
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadAccountTypeOpen, setUploadAccountTypeOpen] = useState(false);
  const [uploadInvoiceCurrencyOpen, setUploadInvoiceCurrencyOpen] = useState(false);
  const [editAccountTypeOpen, setEditAccountTypeOpen] = useState(false);
  const [uploadLinkType, setUploadLinkType] = useState<"po" | "contract">("po");
  const [invoiceBasedContracts, setInvoiceBasedContracts] = useState<InvoiceBasedContract[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);

  const [editReloadMode, setEditReloadMode] = useState(false);
  const [editPoUnbudgeted, setEditPoUnbudgeted] = useState(false);
  const [budgetChangeRow, setBudgetChangeRow] = useState<InvoiceWorkbenchRow | null>(null);
  const [budgetChangeLoading, setBudgetChangeLoading] = useState(false);
  const [budgetChangeSubmitting, setBudgetChangeSubmitting] = useState(false);
  const [budgetChangeContext, setBudgetChangeContext] = useState<{
    effectiveIsBudgeted: boolean | null;
    pendingRequestId: string | null;
  } | null>(null);
  const [budgetChangeTarget, setBudgetChangeTarget] = useState<boolean | null>(null);
  const [budgetChangeReason, setBudgetChangeReason] = useState("");
  const [emailDialogRow, setEmailDialogRow] = useState<{
    row: InvoiceWorkbenchRow;
    recipientType: InvoiceEmailRecipientType;
  } | null>(null);
  const [platformMessagesRow, setPlatformMessagesRow] =
    useState<InvoiceWorkbenchRow | null>(null);
  const [verificationDialog, setVerificationDialog] = useState<{
    invoiceId: string;
    mode: InvoiceVerificationMode;
    fromNotification: boolean;
  } | null>(null);
  const handledInvoiceDeepLinkRef = useRef<string | null>(null);
  const [vendorReplyUnreadByPoId, setVendorReplyUnreadByPoId] = useState<
    Record<string, number>
  >({});

  const invoiceQueries = useQueries({
    queries: selectedVesselIds.map((vesselId) => ({
      queryKey: invoicesByVesselQueryKey(vesselId),
      queryFn: () => fetchInvoicesByVessel(vesselId),
      enabled: true,
      staleTime: 60_000,
      gcTime: 10 * 60_000,
    })),
  });

  const poQueries = useQueries({
    queries: selectedVesselIds.map((vesselId) => ({
      queryKey: purchaseOrdersListByVesselQueryKey(vesselId),
      queryFn: () => fetchPurchaseOrdersList(vesselId),
      enabled: true,
      staleTime: 60_000,
      gcTime: 10 * 60_000,
    })),
  });

  const invoicesByVesselRaw = useMemo(
    () =>
      invoiceQueries.flatMap(
        (query) => (query.data as Record<string, unknown>[] | undefined) ?? []
      ),
    [invoiceQueries]
  );

  const poListRaw = useMemo(
    () => poQueries.flatMap((query) => query.data ?? []),
    [poQueries]
  );

  const invoicesFetching = invoiceQueries.some((query) => query.isFetching);
  const poListFetching = poQueries.some((query) => query.isFetching);
  const invoicesError = invoiceQueries.some((query) => query.isError);

  const vesselInvoices = useMemo((): InvoiceWorkbenchInvoice[] => {
    return (invoicesByVesselRaw as Record<string, unknown>[]).map((inv) => {
      const purchaseOrder = inv.purchaseOrder as { id?: string } | null | undefined;
      const vendor = inv.vendor as { id?: string; name?: string } | undefined;
      return {
        id: String(inv.id),
        invoiceNumber: String(inv.invoiceNumber),
        invoiceDate: String(inv.invoiceDate),
        invoiceAmount: Number(inv.invoiceAmount),
        originalInvoiceAmount:
          inv.originalInvoiceAmount != null ? Number(inv.originalInvoiceAmount) : null,
        fxRateToUsd: inv.fxRateToUsd != null ? Number(inv.fxRateToUsd) : null,
        fxRateSource: (inv.fxRateSource as string) || null,
        currency: String(inv.currency ?? "USD"),
        accountType: (inv.accountType as string) || null,
        status: String(inv.status),
        invoiceFileUrl: (inv.invoiceFileUrl as string) || null,
        ownerApprovalFileUrl: (inv.ownerApprovalFileUrl as string) || null,
        ownerApprovalFileName: (inv.ownerApprovalFileName as string) || null,
        levelOneApprovedAt: (inv.levelOneApprovedAt as string) || null,
        levelTwoApprovedAt: (inv.levelTwoApprovedAt as string) || null,
        levelThreeApprovedAt: (inv.levelThreeApprovedAt as string) || null,
        levelFourApprovedAt: (inv.levelFourApprovedAt as string) || null,
        purchaseOrderId: purchaseOrder?.id
          ? String(purchaseOrder.id)
          : inv.purchaseOrderId
            ? String(inv.purchaseOrderId)
            : null,
        createdAt: String(inv.createdAt),
        vendor: {
          id: String(vendor?.id ?? ""),
          name: String(vendor?.name ?? ""),
        },
      };
    });
  }, [invoicesByVesselRaw]);

  const workbenchRows = useMemo((): InvoiceWorkbenchRow[] => {
    if (!hasVesselSelection) return EMPTY_WORKBENCH_ROWS;
    const pos = (poListRaw as Record<string, unknown>[]).map(mapPoListRecordToWorkbenchPo);
    return buildInvoiceWorkbenchRows(pos, vesselInvoices, {
      userAccessLevel,
      approvalLevels: DEFAULT_INVOICE_APPROVAL_LEVELS,
    });
  }, [poListRaw, vesselInvoices, hasVesselSelection, userAccessLevel]);

  const invoicePoIdsKey = useMemo(
    () =>
      workbenchRows
        .filter((row) => row.invoice)
        .map((row) => row.purchaseOrderId)
        .sort()
        .join(","),
    [workbenchRows]
  );

  const refreshVendorReplyUnreadCounts = useCallback(async (poIds: string[]) => {
    if (poIds.length === 0) {
      setVendorReplyUnreadByPoId((prev) =>
        Object.keys(prev).length === 0 ? prev : {}
      );
      return;
    }
    try {
      const res = await fetch(
        `/api/purchase-orders/chat/unread-counts?poIds=${encodeURIComponent(poIds.join(","))}`,
        { credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.counts && typeof data.counts === "object") {
        const next = data.counts as Record<string, number>;
        setVendorReplyUnreadByPoId((prev) => {
          const prevKeys = Object.keys(prev);
          const nextKeys = Object.keys(next);
          if (
            prevKeys.length === nextKeys.length &&
            nextKeys.every((key) => prev[key] === next[key])
          ) {
            return prev;
          }
          return next;
        });
      }
    } catch (error) {
      console.error("Failed to load vendor reply unread counts:", error);
    }
  }, []);

  const workbenchRowsWithUnread = useMemo((): InvoiceWorkbenchRow[] => {
    return workbenchRows.map((row) => ({
      ...row,
      unreadVendorReplyCount: vendorReplyUnreadByPoId[row.purchaseOrderId] ?? 0,
    }));
  }, [workbenchRows, vendorReplyUnreadByPoId]);

  useEffect(() => {
    const poIds = invoicePoIdsKey ? invoicePoIdsKey.split(",") : [];
    void refreshVendorReplyUnreadCounts(poIds);
    if (poIds.length === 0) return;
    const intervalId = window.setInterval(() => {
      void refreshVendorReplyUnreadCounts(poIds);
    }, 30_000);
    return () => window.clearInterval(intervalId);
  }, [invoicePoIdsKey, refreshVendorReplyUnreadCounts]);

  const handledOpenVendorReplyRef = useRef<string | null>(null);

  useEffect(() => {
    const openPoId = searchParams.get("openVendorReply");
    if (!openPoId || workbenchRows.length === 0) return;
    if (handledOpenVendorReplyRef.current === openPoId) return;
    const row = workbenchRows.find(
      (r) => r.purchaseOrderId === openPoId && r.invoice
    );
    if (!row) return;
    handledOpenVendorReplyRef.current = openPoId;
    setPlatformMessagesRow(row);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("openVendorReply");
    const qs = params.toString();
    router.replace(qs ? `/purchase/invoices?${qs}` : "/purchase/invoices", {
      scroll: false,
    });
  }, [searchParams, workbenchRows, router]);

  useEffect(() => {
    const invoiceId = searchParams.get("invoiceId")?.trim();
    if (!invoiceId) return;
    const deepLinkKey = `${invoiceId}|${searchParams.get("invoiceAction") ?? "verify"}|${searchParams.get("from") ?? ""}`;
    if (handledInvoiceDeepLinkRef.current === deepLinkKey) return;
    handledInvoiceDeepLinkRef.current = deepLinkKey;
    const action = searchParams.get("invoiceAction");
    setVerificationDialog({
      invoiceId,
      mode: action === "view" ? "view" : "approve",
      fromNotification: searchParams.get("from") === "notification",
    });
    const params = new URLSearchParams(searchParams.toString());
    params.delete("invoiceId");
    params.delete("invoiceAction");
    params.delete("from");
    const qs = params.toString();
    router.replace(qs ? `/purchase/invoices?${qs}` : "/purchase/invoices", {
      scroll: false,
    });
  }, [searchParams, router]);

  const openVerificationDialog = useCallback(
    (invoiceId: string, mode: InvoiceVerificationMode) => {
      setVerificationDialog({
        invoiceId,
        mode,
        fromNotification: false,
      });
    },
    []
  );

  const poIssuedCostUsdKey = useMemo(
    () =>
      workbenchRows
        .map(
          (row) =>
            `${row.purchaseOrderId}|${row.poIssuedAmount ?? ""}|${row.poIssuedCurrency}|${row.invoice?.invoiceDate ?? ""}`
        )
        .join(";;"),
    [workbenchRows]
  );
  const workbenchRowsRef = useRef(workbenchRows);
  workbenchRowsRef.current = workbenchRows;

  const filteredWorkbenchRows = useMemo(() => {
    if (!searchTerm.trim()) return workbenchRowsWithUnread;
    const term = searchTerm.toLowerCase();
    return workbenchRowsWithUnread.filter(
      (row) =>
        row.poNumber.toLowerCase().includes(term) ||
        row.requisitionNumber.toLowerCase().includes(term) ||
        row.poDetails.toLowerCase().includes(term) ||
        row.vendorName.toLowerCase().includes(term) ||
        row.invoice?.invoiceNumber.toLowerCase().includes(term)
    );
  }, [workbenchRowsWithUnread, searchTerm]);

  const filteredInvoiceTotals = useMemo(() => {
    let invoiceCount = 0;
    let invoiceAmountSum = 0;
    let poUsdSum = 0;
    for (const row of filteredWorkbenchRows) {
      const poUsd = poIssuedCostUsdByPoId[row.purchaseOrderId];
      if (poUsd != null && Number.isFinite(poUsd)) poUsdSum += poUsd;
      if (row.invoice) {
        invoiceCount += 1;
        invoiceAmountSum += Number(row.invoice.invoiceAmount) || 0;
      }
    }
    return { invoiceCount, invoiceAmountSum, poUsdSum, rowCount: filteredWorkbenchRows.length };
  }, [filteredWorkbenchRows, poIssuedCostUsdByPoId]);

  const [exportingExcel, setExportingExcel] = useState(false);

  const downloadWorkbenchExcel = async () => {
    if (filteredWorkbenchRows.length === 0) {
      toast.info("No filtered data to download");
      return;
    }
    setExportingExcel(true);
    try {
      await downloadFilteredTableExcel({
        title: "INVOICE WORKBENCH",
        subtitle: `Filtered rows: ${filteredWorkbenchRows.length}`,
        fileName: `invoice_workbench_${new Date().toISOString().slice(0, 10)}.xlsx`,
        columns: [
          { key: "poNumber", header: "PO Number", width: 20 },
          { key: "requisitionNumber", header: "Req. Number", width: 20 },
          { key: "vendorName", header: "Vendor", width: 22 },
          { key: "invoiceNumber", header: "Invoice #", width: 16 },
          { key: "invoiceDate", header: "Invoice Date", width: 14 },
          { key: "poUsd", header: "PO USD", width: 14, align: "right" },
          { key: "invoiceAmount", header: "Invoice Amount", width: 14, align: "right" },
          { key: "currency", header: "Currency", width: 10 },
          { key: "status", header: "Status", width: 16 },
        ],
        rows: filteredWorkbenchRows.map((row) => ({
          poNumber: row.poNumber,
          requisitionNumber: row.requisitionNumber,
          vendorName: row.vendorName,
          invoiceNumber: row.invoice?.invoiceNumber ?? "",
          invoiceDate: row.invoice?.invoiceDate
            ? new Date(row.invoice.invoiceDate).toLocaleDateString("en-GB")
            : "",
          poUsd: poIssuedCostUsdByPoId[row.purchaseOrderId] ?? "",
          invoiceAmount: row.invoice?.invoiceAmount ?? "",
          currency: row.invoice?.currency ?? row.poIssuedCurrency ?? "",
          status: row.invoice?.status ?? "No invoice",
        })),
        totals: [
          { label: "Filtered rows", value: filteredInvoiceTotals.rowCount },
          { label: "Invoices in filter", value: filteredInvoiceTotals.invoiceCount },
          {
            label: "Sum invoice amounts (as listed)",
            value: Number(filteredInvoiceTotals.invoiceAmountSum.toFixed(2)),
          },
          {
            label: "Sum PO USD",
            value: Number(filteredInvoiceTotals.poUsdSum.toFixed(2)),
          },
        ],
      });
    } finally {
      setExportingExcel(false);
    }
  };

  const paginatedWorkbenchRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredWorkbenchRows.slice(start, start + itemsPerPage);
  }, [filteredWorkbenchRows, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedVesselIds, searchTerm, itemsPerPage]);

  const purchaseOrders = poListRaw as PurchaseOrder[];
  const loading =
    (invoicesFetching && invoicesByVesselRaw.length === 0) ||
    (poListFetching && poListRaw.length === 0);

  const pendingDNCount = useMemo(() => {
    if (!purchaseOrders.length) return null;
    let pendingUpload = 0;
    purchaseOrders.forEach((po) => {
      const dn = po.deliveryNote as { status?: string } | null | undefined;
      if (!dn || (dn.status !== "UPLOADED" && dn.status !== "VERIFIED")) {
        pendingUpload++;
      }
    });
    if (pendingUpload > 0) {
      return { pendingUpload };
    }
    return null;
  }, [purchaseOrders]);

  const refreshInvoicesData = useCallback(async () => {
    if (!hasVesselSelection) return;
    await Promise.all(
      selectedVesselIds.flatMap((vesselId) => [
        queryClient.invalidateQueries({ queryKey: invoicesByVesselQueryKey(vesselId) }),
        queryClient.invalidateQueries({ queryKey: purchaseOrdersListByVesselQueryKey(vesselId) }),
      ])
    );
  }, [queryClient, hasVesselSelection, selectedVesselIds]);

  useEffect(() => {
    if (!poIssuedCostUsdKey) {
      setPoIssuedCostUsdByPoId((prev) =>
        Object.keys(prev).length === 0 ? prev : {}
      );
      return;
    }

    let cancelled = false;

    const loadPoUsdCosts = async () => {
      const rows = workbenchRowsRef.current;
      const entries = await Promise.all(
        rows.map(async (row) => {
          if (row.poIssuedAmount == null || Number.isNaN(row.poIssuedAmount)) {
            return [row.purchaseOrderId, null] as const;
          }

          const currency = (row.poIssuedCurrency || "USD").toUpperCase();
          if (currency === "USD") {
            return [row.purchaseOrderId, row.poIssuedAmount] as const;
          }

          const asOfDate = row.invoice?.invoiceDate
            ? new Date(row.invoice.invoiceDate).toISOString().slice(0, 10)
            : undefined;
          const params = new URLSearchParams({
            amount: String(row.poIssuedAmount),
            fromCurrency: currency,
            toCurrency: "USD",
          });
          if (asOfDate) params.set("asOfDate", asOfDate);

          try {
            const res = await fetch(`/api/exchange-rates/convert?${params.toString()}`, {
              credentials: "include",
            });
            if (!res.ok) return [row.purchaseOrderId, null] as const;
            const data = (await res.json()) as { convertedAmount?: number };
            if (data.convertedAmount == null) return [row.purchaseOrderId, null] as const;
            return [row.purchaseOrderId, data.convertedAmount] as const;
          } catch {
            return [row.purchaseOrderId, null] as const;
          }
        })
      );

      if (cancelled) return;

      const next: Record<string, number> = {};
      for (const [poId, usdAmount] of entries) {
        if (usdAmount != null) next[poId] = usdAmount;
      }
      setPoIssuedCostUsdByPoId((prev) =>
        poIssuedCostUsdMapsEqual(prev, next) ? prev : next
      );
    };

    void loadPoUsdCosts();

    return () => {
      cancelled = true;
    };
  }, [poIssuedCostUsdKey]);

  useEffect(() => {
    if (invoicesError) toast.error("Failed to load invoices");
  }, [invoicesError]);

  useEffect(() => {
    fetch("/api/currencies", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.currencies?.length) return;
        const known = new Set(COMMON_MARINE_CURRENCIES.map((c) => c.code));
        setExtraCurrencyCodes(
          data.currencies.filter((code: string) => !known.has(code))
        );
      })
      .catch(() => undefined);
  }, []);

  const uploadCurrencyOptions = useMemo((): CurrencyMeta[] => {
    const options = [...COMMON_MARINE_CURRENCIES];
    for (const code of extraCurrencyCodes) {
      options.push(getCurrencyMeta(code));
    }
    return options;
  }, [extraCurrencyCodes]);

  // Upload form state
  const [uploadFormData, setUploadFormData] = useState({
    purchaseOrderId: "",
    contractId: "",
    requisitionNumber: "",
    poNumber: "",
    vesselName: "",
    invoiceNumber: "",
    invoiceAmount: "",
    invoiceCurrency: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    accountType: "",
    remarks: "",
    invoiceFile: null as File | null,
    ownerApprovalFile: null as File | null,
  });
  const [lookupLoading, setLookupLoading] = useState(false);
  const [poUploadContext, setPoUploadContext] = useState<InvoiceUploadPoContext | null>(null);
  const [poContextLoading, setPoContextLoading] = useState(false);
  const lastPoCurrencyDefaultIdRef = useRef<string | null>(null);

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    invoiceNumber: "",
    invoiceAmount: "",
    invoiceDate: "",
    accountType: "",
    invoiceFile: null as File | null,
    ownerApprovalFile: null as File | null,
  });

  // Initialize page once static data is loaded
  useEffect(() => {
    if (!vesselsLoading) {
      markSuccess();
    }
  }, [vesselsLoading, markSuccess]);

  // Initialize vessel selection from URL params or localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && !vesselsLoading && selectedVesselIds.length === 0) {
      const params = new URLSearchParams(window.location.search);
      const urlVesselIds = params.getAll("vesselId");
      const urlVesselIdsCsv = params.get("vesselIds");

      let initialIds: string[] = [];
      if (urlVesselIdsCsv) {
        initialIds = urlVesselIdsCsv.split(",").map((id) => id.trim()).filter(Boolean);
      } else if (urlVesselIds.length > 0) {
        initialIds = urlVesselIds;
      } else {
        try {
          const storedMulti = localStorage.getItem("lastSelectedVesselIds");
          if (storedMulti) {
            const parsed = JSON.parse(storedMulti) as string[];
            if (Array.isArray(parsed)) initialIds = parsed.filter(Boolean);
          }
          if (initialIds.length === 0) {
            const lastVesselId =
              localStorage.getItem("lastSelectedVesselId") ||
              localStorage.getItem("selectedVesselId");
            if (lastVesselId) initialIds = [lastVesselId];
          }
        } catch (e) {
          console.error("Error accessing localStorage:", e);
        }
      }

      if (initialIds.length > 0) {
        setSelectedVesselIds(initialIds);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vesselsLoading]);

  // Save selected vessels to localStorage when they change
  useEffect(() => {
    if (selectedVesselIds.length > 0 && typeof window !== "undefined") {
      try {
        localStorage.setItem("lastSelectedVesselIds", JSON.stringify(selectedVesselIds));
        localStorage.setItem("lastSelectedVesselId", selectedVesselIds[0]);
        localStorage.setItem("selectedVesselId", selectedVesselIds[0]);
      } catch (e) {
        console.error("Error saving to localStorage:", e);
      }
    }
  }, [selectedVesselIds]);

  useEffect(() => {
    if (!singleVesselId) {
      setInvoiceBasedContracts([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoadingContracts(true);
      try {
        const res = await fetch(
          `/api/contracts/invoice-based?vesselId=${encodeURIComponent(singleVesselId)}`,
          { credentials: "include" }
        );
        if (!res.ok) {
          if (!cancelled) setInvoiceBasedContracts([]);
          return;
        }
        const data = await res.json();
        if (!cancelled) setInvoiceBasedContracts(data.contracts || []);
      } catch {
        if (!cancelled) setInvoiceBasedContracts([]);
      } finally {
        if (!cancelled) setLoadingContracts(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [singleVesselId]);

  const buildVesselQueryString = useCallback(() => {
    if (selectedVesselIds.length === 0) return "";
    if (selectedVesselIds.length === 1) {
      return `?vesselId=${encodeURIComponent(selectedVesselIds[0])}`;
    }
    return `?vesselIds=${selectedVesselIds.map((id) => encodeURIComponent(id)).join(",")}`;
  }, [selectedVesselIds]);

  // Handle auto-opening upload/edit dialog with pre-selected PO from URL
  useEffect(() => {
    if (typeof window !== "undefined" && purchaseOrders.length > 0 && hasVesselSelection) {
      const params = new URLSearchParams(window.location.search);
      const urlPOId = params.get('purchaseOrderId');
      const openUpload = params.get('openUpload') === 'true';
      const editMode = params.get('edit') === 'true';

      if (urlPOId && openUpload && canUploadInvoice && !isUploadDialogOpen) {
        const po = purchaseOrders.find(p => p.id === urlPOId);
        if (po) {
          setUploadFormData(prev => ({
            ...prev,
            purchaseOrderId: po.id,
          }));
          setIsUploadDialogOpen(true);
          // Clean up URL params but keep vesselId if present
          const newUrl = window.location.pathname + buildVesselQueryString();
          window.history.replaceState({}, "", newUrl);
        }
      } else if (urlPOId && editMode && !isEditDialogOpen && vesselInvoices.length > 0) {
        const invoice = vesselInvoices.find((inv) => inv.purchaseOrderId === urlPOId);
        if (invoice) {
          setSelectedInvoice({
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            invoiceDate: invoice.invoiceDate,
            invoiceAmount: invoice.invoiceAmount,
            originalInvoiceAmount: invoice.originalInvoiceAmount,
            fxRateToUsd: invoice.fxRateToUsd,
            fxRateSource: invoice.fxRateSource,
            currency: invoice.currency,
            accountType: invoice.accountType,
            status: invoice.status,
            invoiceFileUrl: invoice.invoiceFileUrl,
            purchaseOrderId: invoice.purchaseOrderId,
            levelOneApprovedAt: invoice.levelOneApprovedAt,
            purchaseOrder: invoice.purchaseOrderId
              ? { id: invoice.purchaseOrderId, poNumber: "" }
              : null,
            requisition: {
              id: "",
              requisitionNumber: "",
              vessel: { id: singleVesselId || selectedVesselIds[0] || "", name: "", code: "" },
            },
            vendor: invoice.vendor,
            createdAt: invoice.createdAt,
          });
          setEditFormData({
            invoiceNumber: invoice.invoiceNumber || '',
            invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString().split('T')[0] : '',
            invoiceAmount: invoice.invoiceAmount ? String(invoice.invoiceAmount) : '',
            accountType: invoice.accountType || '',
            invoiceFile: null,
          });
          setIsEditDialogOpen(true);
          const newUrl = window.location.pathname + buildVesselQueryString();
          window.history.replaceState({}, "", newUrl);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseOrders, vesselInvoices, hasVesselSelection, isUploadDialogOpen, isEditDialogOpen, buildVesselQueryString]);

  // Lookup purchase order by requisition number or PO number
  const lookupPurchaseOrder = async (requisitionNumber?: string, poNumber?: string) => {
    if (!requisitionNumber && !poNumber) {
      return;
    }

    try {
      setLookupLoading(true);
      const params = new URLSearchParams();
      if (requisitionNumber) params.append("requisitionNumber", requisitionNumber);
      if (poNumber) params.append("poNumber", poNumber);

      const response = await fetch(`/api/purchase-orders/lookup?${params.toString()}`, {
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Purchase order not found");
      }

      const data = await response.json();
      if (data.purchaseOrder) {
        const suggestedCode = data.purchaseOrder.suggestedFreightAccount?.accountCode as
          | string
          | undefined;
        const matchedAccountType =
          suggestedCode && ACCOUNT_TYPES.some((t) => t.value === suggestedCode)
            ? suggestedCode
            : undefined;
        setUploadFormData(prev => ({
          ...prev,
          purchaseOrderId: data.purchaseOrder.id,
          vesselName: data.purchaseOrder.vessel.name,
          requisitionNumber: data.purchaseOrder.requisitionNumber,
          poNumber: data.purchaseOrder.poNumber,
          ...(matchedAccountType ? { accountType: matchedAccountType } : {}),
        }));
        const vesselLabel = `${data.purchaseOrder.vessel.name} (${data.purchaseOrder.vessel.code})`;
        if (data.purchaseOrder.poType === "FREIGHT" && matchedAccountType) {
          toast.success(`Freight PO — default GL ${matchedAccountType} applied`, {
            description: vesselLabel,
          });
        } else if (data.purchaseOrder.poType === "FREIGHT") {
          toast.info(`Freight PO detected for ${vesselLabel}. Set account type or configure default freight GL.`);
        } else {
          toast.success(`Vessel: ${vesselLabel}`);
        }
      }
    } catch (error) {
      console.error("Error looking up purchase order:", error);
      toast.error(error instanceof Error ? error.message : "Failed to look up purchase order");
      setUploadFormData(prev => ({
        ...prev,
        purchaseOrderId: "",
        vesselName: "",
      }));
    } finally {
      setLookupLoading(false);
    }
  };

  // Debounced lookup for requisition number
  useEffect(() => {
    if (!uploadFormData.requisitionNumber || uploadFormData.requisitionNumber.trim().length === 0) {
      return;
    }

    const timeoutId = setTimeout(() => {
      if (uploadFormData.requisitionNumber && !uploadFormData.purchaseOrderId) {
        lookupPurchaseOrder(uploadFormData.requisitionNumber.trim(), undefined);
      }
    }, 800);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadFormData.requisitionNumber]);

  // Debounced lookup for PO number
  useEffect(() => {
    if (!uploadFormData.poNumber || uploadFormData.poNumber.trim().length === 0) {
      return;
    }

    const timeoutId = setTimeout(() => {
      if (uploadFormData.poNumber && !uploadFormData.purchaseOrderId) {
        lookupPurchaseOrder(undefined, uploadFormData.poNumber.trim());
      }
    }, 800);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadFormData.poNumber]);

  useEffect(() => {
    const poId = uploadFormData.purchaseOrderId;
    if (!isUploadDialogOpen || uploadLinkType !== "po" || !poId) {
      setPoUploadContext(null);
      setPoContextLoading(false);
      return;
    }

    let cancelled = false;
    setPoContextLoading(true);

    (async () => {
      try {
        const response = await fetch(
          `/api/purchase-orders/${poId}/invoice-upload-context`,
          { credentials: "include" }
        );
        if (!response.ok) {
          throw new Error("Failed to load PO details");
        }
        const data = (await response.json()) as InvoiceUploadPoContext;
        if (!cancelled) {
          setPoUploadContext(data);
        }
      } catch (error) {
        console.error("Error loading PO upload context:", error);
        if (!cancelled) {
          setPoUploadContext(null);
        }
      } finally {
        if (!cancelled) {
          setPoContextLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uploadFormData.purchaseOrderId, uploadLinkType, isUploadDialogOpen]);

  useEffect(() => {
    if (!poUploadContext) return;
    const poId = poUploadContext.purchaseOrder.id;
    if (lastPoCurrencyDefaultIdRef.current === poId) return;
    lastPoCurrencyDefaultIdRef.current = poId;
    const poCur =
      poUploadContext.purchaseOrder.currency ||
      poUploadContext.quote.currency ||
      "USD";
    setUploadFormData((prev) => ({
      ...prev,
      invoiceCurrency: poCur,
    }));
  }, [poUploadContext]);

  const resetUploadForm = () => {
    setUploadFormData({
      purchaseOrderId: "",
      contractId: "",
      requisitionNumber: "",
      poNumber: "",
      vesselName: "",
      invoiceNumber: "",
      invoiceAmount: "",
      invoiceCurrency: "",
      invoiceDate: new Date().toISOString().split("T")[0],
      accountType: "",
      remarks: "",
      invoiceFile: null,
      ownerApprovalFile: null,
    });
    setUploadLinkType("po");
    setPoUploadContext(null);
    setPoContextLoading(false);
    setUploadInvoiceCurrencyOpen(false);
    lastPoCurrencyDefaultIdRef.current = null;
  };

  const handleUploadInvoice = async () => {
    if (!canUploadInvoice) {
      toast.error("Invoice upload is limited to purchase officers (levels 32–33)");
      return;
    }
    const isContractUpload = uploadLinkType === "contract";
    const hasPurchaseOrderId = !!uploadFormData.purchaseOrderId;
    const hasContract = !!uploadFormData.contractId;
    const hasLookupInfo = !!(uploadFormData.requisitionNumber || uploadFormData.poNumber);

    if (
      (isContractUpload && (!hasContract || !singleVesselId)) ||
      (!isContractUpload && !hasPurchaseOrderId && !hasLookupInfo) ||
      !uploadFormData.invoiceNumber ||
      !uploadFormData.invoiceAmount ||
      !uploadFormData.invoiceCurrency ||
      !uploadFormData.invoiceDate ||
      !uploadFormData.accountType ||
      !uploadFormData.invoiceFile
    ) {
      toast.error(
        "Please fill in all required fields, including invoice currency and attachment"
      );
      return;
    }

    const requiresOwnerApproval =
      !isContractUpload && poUploadContext?.isUnbudgeted === true;
    if (requiresOwnerApproval && !uploadFormData.ownerApprovalFile) {
      toast.error("Owner's approval attachment is required for un-budgeted requisitions");
      return;
    }

    if (!isContractUpload && hasLookupInfo && !hasPurchaseOrderId) {
      await lookupPurchaseOrder(uploadFormData.requisitionNumber, uploadFormData.poNumber);
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (!uploadFormData.purchaseOrderId) {
        toast.error("Could not find purchase order. Please check requisition number or PO number.");
        return;
      }
    }

    try {
      setUploading(true);

      const invoiceNumberTrimmed = uploadFormData.invoiceNumber.trim();
      const numberAvailable = await checkInvoiceNumberAvailable(invoiceNumberTrimmed);
      if (!numberAvailable) {
        toast.error(`Invoice number "${invoiceNumberTrimmed}" is already in use. Please use a unique number.`);
        return;
      }

      const result = await uploadInvoice({
        file: uploadFormData.invoiceFile,
        ...(isContractUpload
          ? {
              contractId: uploadFormData.contractId,
              vesselId: singleVesselId,
            }
          : {
              purchaseOrderId: uploadFormData.purchaseOrderId,
              requisitionNumber: uploadFormData.requisitionNumber || undefined,
              poNumber: uploadFormData.poNumber || undefined,
            }),
        invoiceNumber: invoiceNumberTrimmed,
        invoiceAmount: uploadFormData.invoiceAmount,
        invoiceCurrency: uploadFormData.invoiceCurrency,
        invoiceDate: uploadFormData.invoiceDate,
        accountType: uploadFormData.accountType,
        remarks: uploadFormData.remarks.trim() || undefined,
        ownerApprovalFile: uploadFormData.ownerApprovalFile || undefined,
      });

      if (result.autoCreatedPurchaseOrder?.poNumber) {
        toast.success(
          `Invoice uploaded. PO ${result.autoCreatedPurchaseOrder.poNumber} created automatically (no PO approval required).`
        );
      } else {
        toast.success("Invoice uploaded successfully");
      }
      setIsUploadDialogOpen(false);
      resetUploadForm();
      await refreshInvoicesData();
    } catch (error) {
      console.error("Error uploading invoice:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload invoice");
    } finally {
      setUploading(false);
    }
  };

  const handleEditInvoice = (invoice: Invoice, reloadMode = false) => {
    setEditReloadMode(reloadMode);
    setSelectedInvoice(invoice);
    setEditFormData({
      invoiceNumber: invoice.invoiceNumber,
      invoiceAmount: invoice.invoiceAmount.toString(),
      invoiceDate: invoice.invoiceDate.split("T")[0],
      accountType: invoice.accountType || "",
      invoiceFile: null,
      ownerApprovalFile: null,
    });
    setEditPoUnbudgeted(false);
    setIsEditDialogOpen(true);
  };

  useEffect(() => {
    const poId = selectedInvoice?.purchaseOrderId;
    if (!isEditDialogOpen || !poId) {
      setEditPoUnbudgeted(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/purchase-orders/${poId}/invoice-upload-context`, {
          credentials: "include",
        });
        if (!response.ok) return;
        const data = (await response.json()) as InvoiceUploadPoContext;
        if (!cancelled) {
          setEditPoUnbudgeted(data.isUnbudgeted === true);
        }
      } catch {
        if (!cancelled) setEditPoUnbudgeted(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isEditDialogOpen, selectedInvoice?.purchaseOrderId]);

  const workbenchInvoiceToInvoice = (
    inv: InvoiceWorkbenchInvoice,
    row: InvoiceWorkbenchRow
  ): Invoice => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate,
    invoiceAmount: inv.invoiceAmount,
    originalInvoiceAmount: inv.originalInvoiceAmount,
    fxRateToUsd: inv.fxRateToUsd,
    fxRateSource: inv.fxRateSource,
    currency: inv.currency,
    accountType: inv.accountType,
    status: inv.status,
    invoiceFileUrl: inv.invoiceFileUrl,
    ownerApprovalFileUrl: inv.ownerApprovalFileUrl ?? null,
    ownerApprovalFileName: inv.ownerApprovalFileName ?? null,
    purchaseOrderId: row.purchaseOrderId,
    levelOneApprovedAt: inv.levelOneApprovedAt,
    purchaseOrder: { id: row.purchaseOrderId, poNumber: row.poNumber },
    requisition: {
      id: "",
      requisitionNumber: row.requisitionNumber,
      vessel: {
        id: row.vesselId || singleVesselId || selectedVesselIds[0] || "",
        name: row.vesselName,
        code: "",
      },
    },
    vendor: inv.vendor,
    createdAt: inv.createdAt,
  });

  const openUploadForRow = (row: InvoiceWorkbenchRow) => {
    setUploadLinkType("po");
    setUploadFormData((prev) => ({
      ...prev,
      purchaseOrderId: row.purchaseOrderId,
      poNumber: row.poNumber,
      requisitionNumber: row.requisitionNumber,
      contractId: "",
      vesselName: "",
    }));
    setIsUploadDialogOpen(true);
  };

  const openReuploadDnForRow = (row: InvoiceWorkbenchRow) => {
    router.push(
      `/purchase/dn-status?vesselId=${row.vesselId || singleVesselId || selectedVesselIds[0] || ""}&purchaseOrderId=${row.purchaseOrderId}&openUpload=true`
    );
  };

  const openBudgetChangeForRow = (row: InvoiceWorkbenchRow) => {
    if (!row.invoice) return;
    setBudgetChangeRow(row);
    setBudgetChangeTarget(null);
    setBudgetChangeReason("");
    setBudgetChangeContext(null);
  };

  useEffect(() => {
    const poId = budgetChangeRow?.purchaseOrderId;
    if (!poId) return;

    let cancelled = false;
    setBudgetChangeLoading(true);

    (async () => {
      try {
        const [contextRes, pendingRes] = await Promise.all([
          fetch(`/api/purchase-orders/${poId}/invoice-upload-context`, {
            credentials: "include",
          }),
          fetch(`/api/purchase/po-budget-change?purchaseOrderId=${poId}&status=PENDING`, {
            credentials: "include",
          }),
        ]);
        const contextData = contextRes.ok ? await contextRes.json() : null;
        const pendingData = pendingRes.ok ? await pendingRes.json() : null;
        const effective = resolveEffectiveIsBudgeted(
          contextData?.purchaseOrder?.isBudgeted,
          contextData?.requisition?.isBudgeted
        );
        const pending = (pendingData?.requests ?? [])[0] as { id?: string } | undefined;
        if (!cancelled) {
          setBudgetChangeContext({
            effectiveIsBudgeted: effective,
            pendingRequestId: pending?.id ?? null,
          });
          if (effective === true) setBudgetChangeTarget(false);
          else if (effective === false) setBudgetChangeTarget(true);
        }
      } catch {
        if (!cancelled) setBudgetChangeContext(null);
      } finally {
        if (!cancelled) setBudgetChangeLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [budgetChangeRow?.purchaseOrderId]);

  const handleSubmitBudgetChange = async () => {
    if (!budgetChangeRow || budgetChangeTarget == null) {
      toast.error("Select the target budget classification");
      return;
    }
    if (budgetChangeContext?.pendingRequestId) {
      toast.error("A budget change request is already pending for this PO");
      return;
    }

    try {
      setBudgetChangeSubmitting(true);
      const res = await fetch("/api/purchase/po-budget-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          purchaseOrderId: budgetChangeRow.purchaseOrderId,
          requestedIsBudgeted: budgetChangeTarget,
          reason: budgetChangeReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request");
      toast.success("Budget change request submitted for approval (levels 44–48)");
      setBudgetChangeRow(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit request");
    } finally {
      setBudgetChangeSubmitting(false);
    }
  };

  const handleDownloadInvoiceFile = async (fileUrl: string) => {
    try {
      if (fileUrl.includes("storage.googleapis.com") || fileUrl.startsWith("local://")) {
        await openInvoiceFileDownload(fileUrl);
      } else {
        window.open(fileUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download invoice");
    }
  };

  const workbenchBadgeClass =
    "text-[10px] font-normal px-1.5 py-0 leading-tight whitespace-nowrap max-w-full truncate";

  const workbenchApprovalBadgeClass =
    "text-[10px] font-normal px-1 py-0.5 leading-none whitespace-nowrap w-fit max-w-[4.75rem]";

  const getWorkbenchStatusBadge = (label: string) => {
    if (label === "Awaiting invoice upload") {
      return <Badge variant="outline" className={workbenchBadgeClass}>{label}</Badge>;
    }
    if (label === "Invoice uploaded" || label === "Returned — pending re-upload") {
      return <Badge className={cn("bg-info text-white", workbenchBadgeClass)}>{label}</Badge>;
    }
    if (label.endsWith(" Aprvl Pend.")) {
      return (
        <Badge className={cn("bg-warning text-warning-foreground", workbenchApprovalBadgeClass)}>
          {label}
        </Badge>
      );
    }
    return <Badge variant="secondary" className={workbenchBadgeClass}>{label}</Badge>;
  };

  const formatWorkbenchShortDate = (value: string | Date) =>
    new Date(value).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });

  const handleUpdateInvoice = async () => {
    if (!selectedInvoice) return;

    if (
      !editFormData.invoiceNumber ||
      !editFormData.invoiceAmount ||
      !editFormData.invoiceDate ||
      !editFormData.accountType
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (editReloadMode && !editFormData.invoiceFile) {
      toast.error("Please select a new invoice file to reload");
      return;
    }

    const requiresOwnerApproval = editPoUnbudgeted;
    const hasExistingOwnerApproval = Boolean(selectedInvoice.ownerApprovalFileUrl);
    if (
      requiresOwnerApproval &&
      !editFormData.ownerApprovalFile &&
      !hasExistingOwnerApproval
    ) {
      toast.error("Owner's approval attachment is required for un-budgeted requisitions");
      return;
    }

    try {
      setUploading(true);

      const invoiceNumberTrimmed = editFormData.invoiceNumber.trim();
      if (invoiceNumberTrimmed !== selectedInvoice.invoiceNumber) {
        const numberAvailable = await checkInvoiceNumberAvailable(
          invoiceNumberTrimmed,
          selectedInvoice.id
        );
        if (!numberAvailable) {
          toast.error(
            `Invoice number "${invoiceNumberTrimmed}" is already in use. Please use a unique number.`
          );
          return;
        }
      }

      const payload: Record<string, string> = {
        invoiceNumber: invoiceNumberTrimmed,
        invoiceAmount: editFormData.invoiceAmount,
        invoiceDate: editFormData.invoiceDate,
        accountType: editFormData.accountType,
      };

      if (editFormData.invoiceFile && selectedInvoice.purchaseOrderId) {
        try {
          const uploaded = await uploadInvoiceFileToStorage({
            file: editFormData.invoiceFile,
            purchaseOrderId: selectedInvoice.purchaseOrderId,
            invoiceNumber: invoiceNumberTrimmed,
          });
          payload.invoiceFileUrl = uploaded.fileUrl;
        } catch (uploadError) {
          const message =
            uploadError instanceof Error ? uploadError.message : "Failed to upload file";
          if (!message.includes("not available in this environment")) {
            throw uploadError;
          }

          const formData = new FormData();
          formData.append("invoiceNumber", invoiceNumberTrimmed);
          formData.append("invoiceAmount", editFormData.invoiceAmount);
          formData.append("invoiceDate", editFormData.invoiceDate);
          formData.append("accountType", editFormData.accountType);
          formData.append("invoiceFile", editFormData.invoiceFile);
          if (editFormData.ownerApprovalFile) {
            formData.append("ownerApprovalFile", editFormData.ownerApprovalFile);
          }

          const inlineResponse = await fetch(`/api/invoices/${selectedInvoice.id}`, {
            method: "PUT",
            body: formData,
            credentials: "include",
          });
          if (!inlineResponse.ok) {
            const errorData = await inlineResponse.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to update invoice");
          }

          toast.success(editReloadMode ? "Invoice reloaded successfully" : "Invoice updated successfully");
          setIsEditDialogOpen(false);
          setSelectedInvoice(null);
          setEditReloadMode(false);
          await refreshInvoicesData();
          return;
        }
      }

      if (editFormData.ownerApprovalFile && selectedInvoice.purchaseOrderId) {
        try {
          const ownerUploaded = await uploadOwnerApprovalFileToStorage({
            file: editFormData.ownerApprovalFile,
            purchaseOrderId: selectedInvoice.purchaseOrderId,
            invoiceNumber: invoiceNumberTrimmed,
          });
          payload.ownerApprovalFileUrl = ownerUploaded.fileUrl;
          payload.ownerApprovalFileName = editFormData.ownerApprovalFile.name;
        } catch (ownerUploadError) {
          const message =
            ownerUploadError instanceof Error
              ? ownerUploadError.message
              : "Failed to upload owner approval";
          if (!message.includes("not available in this environment")) {
            throw ownerUploadError;
          }

          const formData = new FormData();
          formData.append("invoiceNumber", invoiceNumberTrimmed);
          formData.append("invoiceAmount", editFormData.invoiceAmount);
          formData.append("invoiceDate", editFormData.invoiceDate);
          formData.append("accountType", editFormData.accountType);
          formData.append("ownerApprovalFile", editFormData.ownerApprovalFile);
          if (editFormData.invoiceFile) {
            formData.append("invoiceFile", editFormData.invoiceFile);
          }

          const inlineResponse = await fetch(`/api/invoices/${selectedInvoice.id}`, {
            method: "PUT",
            body: formData,
            credentials: "include",
          });
          if (!inlineResponse.ok) {
            const errorData = await inlineResponse.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to update invoice");
          }

          toast.success(editReloadMode ? "Invoice reloaded successfully" : "Invoice updated successfully");
          setIsEditDialogOpen(false);
          setSelectedInvoice(null);
          setEditReloadMode(false);
          await refreshInvoicesData();
          return;
        }
      }

      const response = await fetch(`/api/invoices/${selectedInvoice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update invoice");
      }

      toast.success(editReloadMode ? "Invoice reloaded successfully" : "Invoice updated successfully");
      setIsEditDialogOpen(false);
      setSelectedInvoice(null);
      setEditReloadMode(false);
      await refreshInvoicesData();
    } catch (error) {
      console.error("Error updating invoice:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update invoice");
    } finally {
      setUploading(false);
    }
  };

  const renderOwnerApprovalField = (options: {
    idPrefix: string;
    isUnbudgeted: boolean;
    file: File | null;
    onFileChange: (file: File | null) => void;
    existingFileUrl?: string | null;
    existingFileName?: string | null;
    replaceLabel?: string;
  }) => (
    <div>
      <Label htmlFor={`${options.idPrefix}-owner-approval`}>
        Owner&apos;s approval {options.isUnbudgeted ? "*" : "(optional)"}
      </Label>
      {options.isUnbudgeted ? (
        <p className="mt-1 text-xs text-amber-800">
          Required for un-budgeted requisitions.
        </p>
      ) : null}
      {options.existingFileUrl && !options.file ? (
        <div className="mt-2 text-sm">
          Current file:{" "}
          <button
            type="button"
            className="text-info underline hover:text-info/80"
            onClick={() => void handleDownloadInvoiceFile(options.existingFileUrl!)}
          >
            {options.existingFileName || "Download owner approval"}
          </button>
        </div>
      ) : null}
      <Input
        id={`${options.idPrefix}-owner-approval`}
        type="file"
        accept={INVOICE_FILE_ACCEPT}
        onChange={(e) => options.onFileChange(e.target.files?.[0] || null)}
        className="mt-2"
      />
      <p className="mt-1 text-xs text-muted-foreground">
        PDF, Word (.doc, .docx), Excel (.xls, .xlsx), or images (JPG, PNG, WEBP, GIF). Max{" "}
        {formatPurchaseAttachmentMaxSizeMb()}.
        {options.existingFileUrl
          ? ` ${options.replaceLabel || "Upload a new file to replace the current one."}`
          : ""}
      </p>
    </div>
  );

  const renderUploadInvoiceFields = () => (
    <>
      <div>
        <Label htmlFor="invoice-number">Invoice Number *</Label>
        <Input
          id="invoice-number"
          value={uploadFormData.invoiceNumber}
          onChange={(e) =>
            setUploadFormData({ ...uploadFormData, invoiceNumber: e.target.value })
          }
          className="mt-2"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="invoice-amount">Invoice Amount *</Label>
          <Input
            id="invoice-amount"
            type="number"
            step="0.01"
            min={0}
            value={uploadFormData.invoiceAmount}
            onChange={(e) =>
              setUploadFormData({ ...uploadFormData, invoiceAmount: e.target.value })
            }
            className="mt-2"
          />
        </div>
        <div>
          <Label htmlFor="invoice-currency">Invoice Currency *</Label>
          <Popover open={uploadInvoiceCurrencyOpen} onOpenChange={setUploadInvoiceCurrencyOpen}>
            <PopoverTrigger asChild>
              <Button
                id="invoice-currency"
                variant="outline"
                role="combobox"
                className={cn(
                  "w-full mt-2 justify-between",
                  !uploadFormData.invoiceCurrency && "text-muted-foreground"
                )}
              >
                {uploadFormData.invoiceCurrency
                  ? `${uploadFormData.invoiceCurrency} — ${getCurrencyMeta(uploadFormData.invoiceCurrency).name}`
                  : "Search currency…"}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search currency…" />
                <CommandList>
                  <CommandEmpty>No currency found.</CommandEmpty>
                  <CommandGroup>
                    {uploadCurrencyOptions.map((c) => (
                      <CommandItem
                        key={c.code}
                        value={`${c.code} ${c.name}`}
                        onSelect={() => {
                          setUploadFormData({
                            ...uploadFormData,
                            invoiceCurrency: c.code,
                          });
                          setUploadInvoiceCurrencyOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            uploadFormData.invoiceCurrency === c.code
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        {c.code} — {c.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div>
        <Label htmlFor="invoice-date">Invoice Date *</Label>
        <Input
          id="invoice-date"
          type="date"
          value={uploadFormData.invoiceDate}
          onChange={(e) =>
            setUploadFormData({ ...uploadFormData, invoiceDate: e.target.value })
          }
          className="mt-2 max-w-xs"
        />
      </div>
      <div>
        <Label htmlFor="account-type">Account Type *</Label>
        <Popover open={uploadAccountTypeOpen} onOpenChange={setUploadAccountTypeOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className={cn(
                "w-full mt-2 justify-between",
                !uploadFormData.accountType && "text-muted-foreground"
              )}
            >
              {uploadFormData.accountType
                ? `${ACCOUNT_TYPES.find((type) => type.value === uploadFormData.accountType)?.value} - ${ACCOUNT_TYPES.find((type) => type.value === uploadFormData.accountType)?.label}`
                : "Select account type"}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search account type..." />
              <CommandList>
                <CommandEmpty>No account type found.</CommandEmpty>
                <CommandGroup>
                  {ACCOUNT_TYPES.map((type) => (
                    <CommandItem
                      key={type.value}
                      value={`${type.value} ${type.label}`}
                      onSelect={() => {
                        setUploadFormData({ ...uploadFormData, accountType: type.value });
                        setUploadAccountTypeOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          uploadFormData.accountType === type.value
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      {type.value} - {type.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      <div>
        <Label htmlFor="upload-remarks">Remarks</Label>
        <Textarea
          id="upload-remarks"
          value={uploadFormData.remarks}
          onChange={(e) =>
            setUploadFormData({ ...uploadFormData, remarks: e.target.value })
          }
          placeholder="Optional comments for approvers (e.g. variance reason, partial delivery)"
          className="mt-2 min-h-[80px] resize-y"
        />
      </div>
      <div>
        <Label htmlFor="invoice-file">Invoice File *</Label>
        <Input
          id="invoice-file"
          type="file"
          accept={INVOICE_FILE_ACCEPT}
          onChange={(e) =>
            setUploadFormData({
              ...uploadFormData,
              invoiceFile: e.target.files?.[0] || null,
            })
          }
          className="mt-2"
        />
        <p className="text-xs text-muted-foreground mt-1">
          PDF, Word (.doc, .docx), Excel (.xls, .xlsx), or images (JPG, PNG, WEBP, GIF). Max{" "}
          {formatPurchaseAttachmentMaxSizeMb()}.
        </p>
      </div>
      {uploadLinkType === "po"
        ? renderOwnerApprovalField({
            idPrefix: "upload",
            isUnbudgeted: poUploadContext?.isUnbudgeted === true,
            file: uploadFormData.ownerApprovalFile,
            onFileChange: (file) =>
              setUploadFormData({ ...uploadFormData, ownerApprovalFile: file }),
          })
        : null}
    </>
  );

  return (<PageReadyGate ready={ready}>
    <div className="space-y-4">
      <main className="mx-auto py-4" style={{ width: "95%", maxWidth: "95vw" }}>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Invoices</h1>
          <p className="text-foreground">
            Purchase orders with delivery note uploaded — upload or manage invoices before
            approval.
          </p>
        </div>

        {/* Filters + DN alert */}
        <Card className="mb-6">
          <CardContent className="pt-6 space-y-4">
            {pendingDNCount && pendingDNCount.pendingUpload > 0 ? (
              <div className="flex flex-col gap-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                  <p className="text-sm leading-snug text-warning">
                    <strong>{pendingDNCount.pendingUpload}</strong> PO(s) need delivery note upload
                    before invoicing.
                  </p>
                </div>
                <Button
                  onClick={() => router.push("/purchase/dn-status")}
                  size="sm"
                  className="w-full shrink-0 bg-warning text-white hover:bg-warning sm:w-auto"
                >
                  Go to DN Status
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ) : null}
            <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[minmax(0,24rem)_minmax(0,16rem)_auto]">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="vessel">Select Vessel(s)</Label>
                <FilterFieldShell
                  showClear={selectedVesselIds.length > 0}
                  onClear={() => setSelectedVesselIds([])}
                  hasDropdownChevron
                  className="max-w-none"
                >
                  <VesselMultiSelect
                    vessels={vessels}
                    selectedVessels={selectedVesselIds}
                    onSelectionChange={setSelectedVesselIds}
                    placeholder={vesselsLoading ? "Loading vessels…" : "Search and select vessels…"}
                    className={cn(
                      "w-full",
                      filterMultiSelectClearClass(selectedVesselIds.length > 0)
                    )}
                  />
                </FilterFieldShell>
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="search">Search</Label>
                <FilterFieldShell
                  showClear={searchTerm.length > 0}
                  onClear={() => setSearchTerm("")}
                  className="max-w-none"
                >
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 z-0 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search by invoice number, vendor, PO..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={cn("w-full pl-10", searchTerm && "pr-7")}
                    />
                  </div>
                </FilterFieldShell>
              </div>
              {canUploadInvoice ? (
                <Button
                  onClick={() => setIsUploadDialogOpen(true)}
                  disabled={!singleVesselId}
                  title={
                    !singleVesselId
                      ? selectedVesselIds.length > 1
                        ? "Select exactly one vessel to upload a new invoice"
                        : "Select a vessel first"
                      : undefined
                  }
                  className="w-full sm:w-auto"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Invoice
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Invoice workbench */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <CardTitle>Invoice workbench</CardTitle>
            {filteredWorkbenchRows.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void downloadWorkbenchExcel()}
                disabled={exportingExcel}
              >
                {exportingExcel ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download Excel
              </Button>
            )}
          </CardHeader>
          <CardContent className="min-w-0">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <ActiniumLoader size="md" text="Loading purchase orders…" />
              </div>
            ) : !hasVesselSelection ? (
              <div className="text-center py-4 text-muted-foreground">
                Please select at least one vessel to view POs ready for invoicing
              </div>
            ) : filteredWorkbenchRows.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                {canUploadInvoice
                  ? "No purchase orders with delivery note uploaded are ready for invoicing"
                  : "No invoices pending your review for the selected vessel(s)"}
              </div>
            ) : (
              <div className="min-w-0 [&_[data-slot=table-wrapper]]:overflow-x-visible">
                <Table variant="dense" className="table-fixed w-full min-w-0">
                  <colgroup>
                    <col style={{ width: 36 }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: 32 }} />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableSerialHead />
                      <TableHead>PO</TableHead>
                      <TableHead>Req</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Inv #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">PO USD</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Diff</TableHead>
                      <TableHead className="w-[8%]">Status</TableHead>
                      <TableHead className="text-right px-1" aria-label="Row menu" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedWorkbenchRows.map((row, index) => (
                      <TableRow key={row.purchaseOrderId}>
                        <TableSerialCell
                          serialNo={tableSerialNo(currentPage, itemsPerPage, index)}
                        />
                        <TableCell
                          className="max-w-0 truncate font-medium"
                          title={[row.poNumber, row.poDetails].filter(Boolean).join(" — ")}
                        >
                          {row.poNumber}
                        </TableCell>
                        <TableCell className="max-w-0 truncate" title={row.requisitionNumber}>
                          {row.requisitionNumber}
                        </TableCell>
                        <TableCell className="max-w-0 truncate" title={row.vendorName}>
                          {row.vendorName}
                        </TableCell>
                        <TableCell className="max-w-0 truncate" title={row.invoice?.invoiceNumber}>
                          {row.invoice?.invoiceNumber ?? "—"}
                        </TableCell>
                        <TableCell>
                          {row.invoice ? formatWorkbenchShortDate(row.invoice.invoiceDate) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.poIssuedAmount != null &&
                          poIssuedCostUsdByPoId[row.purchaseOrderId] != null
                            ? formatCurrency(poIssuedCostUsdByPoId[row.purchaseOrderId], "USD")
                            : row.poIssuedAmount != null
                              ? "…"
                              : "—"}
                        </TableCell>
                        <TableCell className="max-w-0 truncate text-right tabular-nums">
                          {row.invoice ? (
                            (() => {
                              const amt = resolveInvoiceDisplayAmounts(row.invoice);
                              const usdLabel = formatCurrency(amt.usdAmount, "USD");
                              const title =
                                amt.originalCurrency !== "USD"
                                  ? `${formatCurrency(amt.originalAmount, amt.originalCurrency)} (${usdLabel})`
                                  : usdLabel;
                              return (
                                <span title={title}>{usdLabel}</span>
                              );
                            })()
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.invoice && poIssuedCostUsdByPoId[row.purchaseOrderId] != null ? (
                            (() => {
                              const invoiceUsd = resolveInvoiceDisplayAmounts(row.invoice).usdAmount;
                              const poUsd = poIssuedCostUsdByPoId[row.purchaseOrderId];
                              const diff = invoiceUsd - poUsd;
                              const diffClass =
                                diff > 0
                                  ? "text-warning"
                                  : diff < 0
                                    ? "text-success"
                                    : "text-muted-foreground";
                              return (
                                <span className={cn("font-medium", diffClass)}>
                                  {diff > 0 ? "+" : ""}
                                  {formatCurrency(diff, "USD")}
                                </span>
                              );
                            })()
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="max-w-0 w-[8%]">
                          {getWorkbenchStatusBadge(row.displayStatus)}
                        </TableCell>
                        <TableCell className="text-right px-1">
                          <InvoiceWorkbenchActionsMenu
                            row={row}
                            onUploadInvoice={() => openUploadForRow(row)}
                            onEditInvoice={() => {
                              if (!row.invoice) return;
                              handleEditInvoice(workbenchInvoiceToInvoice(row.invoice, row));
                            }}
                            onReloadEditInvoice={() => {
                              if (!row.invoice) return;
                              handleEditInvoice(
                                workbenchInvoiceToInvoice(row.invoice, row),
                                true
                              );
                            }}
                            onReuploadDn={() => openReuploadDnForRow(row)}
                            canRequestBudgetChange={canRequestBudgetChange}
                            onRequestBudgetChange={() => openBudgetChangeForRow(row)}
                            onViewDownload={() => {
                              if (row.invoice?.invoiceFileUrl) {
                                void handleDownloadInvoiceFile(row.invoice.invoiceFileUrl);
                              }
                            }}
                            onViewDetails={() => {
                              if (row.invoice?.id) {
                                openVerificationDialog(row.invoice.id, "view");
                              }
                            }}
                            onApproveReject={() => {
                              if (row.invoice?.id) {
                                openVerificationDialog(row.invoice.id, "approve");
                              }
                            }}
                            onEmailSupplier={() =>
                              setEmailDialogRow({ row, recipientType: "supplier" })
                            }
                            onEmailVessel={() =>
                              setEmailDialogRow({ row, recipientType: "vessel" })
                            }
                            onViewVendorReply={() =>
                              setPlatformMessagesRow(row)
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  {filteredWorkbenchRows.length > 0 ? (
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={6} className="font-semibold">
                          Total ({filteredInvoiceTotals.rowCount} filtered row
                          {filteredInvoiceTotals.rowCount === 1 ? "" : "s"}
                          {filteredInvoiceTotals.invoiceCount > 0
                            ? ` · ${filteredInvoiceTotals.invoiceCount} invoice${filteredInvoiceTotals.invoiceCount === 1 ? "" : "s"}`
                            : ""}
                          )
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatCurrency(filteredInvoiceTotals.poUsdSum, "USD")}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {filteredInvoiceTotals.invoiceCount > 0
                            ? filteredInvoiceTotals.invoiceAmountSum.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : "—"}
                        </TableCell>
                        <TableCell colSpan={3} className="text-xs text-muted-foreground">
                          PO USD sum · invoice amounts as listed
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  ) : null}
                </Table>
              </div>
            )}

            {!loading &&
              hasVesselSelection &&
              filteredWorkbenchRows.length > 0 && (
                <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows per page:</span>
                    <Select
                      value={itemsPerPage.toString()}
                      onValueChange={(value) => {
                        setItemsPerPage(parseInt(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="15">15</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {Math.ceil(filteredWorkbenchRows.length / itemsPerPage) > 1 && (
                  <TablePagination
                    page={currentPage}
                    pageSize={itemsPerPage}
                    total={filteredWorkbenchRows.length}
                    onPageChange={setCurrentPage}
                    itemLabel="rows"
                    className="mt-0 sm:flex-1 sm:justify-end"
                    disabled={loading}
                  />
                  )}
                </div>
              )}
          </CardContent>
        </Card>

        {/* Upload Invoice Dialog */}
        {canUploadInvoice ? (
        <Dialog 
          open={isUploadDialogOpen} 
          onOpenChange={(open) => {
            setIsUploadDialogOpen(open);
            if (!open) {
              resetUploadForm();
            }
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upload Invoice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label>Link invoice to</Label>
                <Select
                  value={uploadLinkType}
                  onValueChange={(v) => {
                    setUploadLinkType(v as "po" | "contract");
                    setUploadFormData((prev) => ({
                      ...prev,
                      purchaseOrderId: "",
                      contractId: "",
                      requisitionNumber: "",
                      poNumber: "",
                      vesselName: "",
                    }));
                    setPoUploadContext(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="po">Existing purchase order</SelectItem>
                    <SelectItem value="contract">Invoice-based contract</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {uploadLinkType === "contract" ? (
                <>
                  <div>
                    <Label htmlFor="contract-select">Invoice-based contract *</Label>
                    <Select
                      value={uploadFormData.contractId}
                      onValueChange={(value) =>
                        setUploadFormData({ ...uploadFormData, contractId: value })
                      }
                      disabled={!singleVesselId || loadingContracts}
                    >
                      <SelectTrigger id="contract-select" className="mt-2">
                        <SelectValue
                          placeholder={
                            !singleVesselId
                              ? "Select exactly one vessel in the page filter"
                              : loadingContracts
                                ? "Loading contracts…"
                                : invoiceBasedContracts.length === 0
                                  ? "No active invoice-based contracts"
                                  : "Select contract"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {invoiceBasedContracts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.contractNumber} — {c.title} ({c.vendor.name})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-2">
                      A PO number will be created automatically when you upload. PO approval is not
                      required; approvers with access level 37+ will be notified to approve this
                      invoice only.
                    </p>
                  </div>
                  {renderUploadInvoiceFields()}
                </>
              ) : (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="po-select">Purchase Order (Select from list)</Label>
                      <Select
                        value={uploadFormData.purchaseOrderId}
                        onValueChange={(value) => {
                          const selectedPO = purchaseOrders.find((po) => po.id === value);
                          setUploadFormData({
                            ...uploadFormData,
                            purchaseOrderId: value,
                            requisitionNumber: selectedPO?.requisition.requisitionNumber || "",
                            poNumber: selectedPO?.poNumber || "",
                          });
                        }}
                      >
                        <SelectTrigger id="po-select" className="mt-2">
                          <SelectValue placeholder="Select purchase order" />
                        </SelectTrigger>
                        <SelectContent>
                          {purchaseOrders.map((po) => (
                            <SelectItem key={po.id} value={po.id}>
                              {po.poNumber} - {po.requisition.heading} ({po.quote.vendor.name})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">Or</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="requisition-number">Requisition Number</Label>
                        <Input
                          id="requisition-number"
                          value={uploadFormData.requisitionNumber}
                          onChange={(e) => {
                            const value = e.target.value;
                            setUploadFormData({
                              ...uploadFormData,
                              requisitionNumber: value,
                              purchaseOrderId: "",
                              vesselName: "",
                              poNumber: "",
                            });
                          }}
                          placeholder="Enter requisition number"
                          className="mt-2"
                          disabled={lookupLoading}
                        />
                        {lookupLoading && uploadFormData.requisitionNumber && (
                          <p className="text-xs text-muted-foreground mt-1">Looking up...</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="po-number">PO Number</Label>
                        <Input
                          id="po-number"
                          value={uploadFormData.poNumber}
                          onChange={(e) => {
                            const value = e.target.value;
                            setUploadFormData({
                              ...uploadFormData,
                              poNumber: value,
                              purchaseOrderId: "",
                              vesselName: "",
                              requisitionNumber: "",
                            });
                          }}
                          placeholder="Enter PO number"
                          className="mt-2"
                          disabled={lookupLoading}
                        />
                        {lookupLoading && uploadFormData.poNumber && (
                          <p className="text-xs text-muted-foreground mt-1">Looking up...</p>
                        )}
                      </div>
                    </div>

                    {uploadFormData.vesselName && (
                      <div className="bg-success border border-border rounded-md p-3">
                        <div className="flex items-center gap-2">
                          <Ship className="h-4 w-4 text-success" />
                          <span className="text-sm font-medium text-success">
                            Vessel: {uploadFormData.vesselName}
                          </span>
                        </div>
                      </div>
                    )}

                    {renderUploadInvoiceFields()}
                  </div>

                  <div className="lg:sticky lg:top-0 lg:self-start">
                    <InvoiceUploadPoComparisonPanel
                      context={poUploadContext}
                      loading={poContextLoading}
                      invoiceAmount={uploadFormData.invoiceAmount}
                      invoiceCurrency={uploadFormData.invoiceCurrency}
                      invoiceDate={uploadFormData.invoiceDate}
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsUploadDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleUploadInvoice} disabled={uploading}>
                {uploading ? (
                  <>
                    <ActiniumLoader size="sm" className="mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        ) : null}

        {/* Edit Invoice Dialog */}
        <Dialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) {
              setSelectedInvoice(null);
              setEditReloadMode(false);
            }
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editReloadMode ? "Reload / edit invoice" : "Edit invoice"}
              </DialogTitle>
              <DialogDescription>
                {editReloadMode
                  ? "Replace the invoice file and update details. The previous file will be discarded."
                  : "Update invoice details before approval."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-invoice-number">Invoice Number *</Label>
                <Input
                  id="edit-invoice-number"
                  value={editFormData.invoiceNumber}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, invoiceNumber: e.target.value })
                  }
                  className="mt-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-invoice-amount">Invoice Amount *</Label>
                  <Input
                    id="edit-invoice-amount"
                    type="number"
                    step="0.01"
                    value={editFormData.invoiceAmount}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, invoiceAmount: e.target.value })
                    }
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-invoice-date">Invoice Date *</Label>
                  <Input
                    id="edit-invoice-date"
                    type="date"
                    value={editFormData.invoiceDate}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, invoiceDate: e.target.value })
                    }
                    className="mt-2"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-account-type">Account Type *</Label>
                <Popover open={editAccountTypeOpen} onOpenChange={setEditAccountTypeOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full mt-2 justify-between",
                        !editFormData.accountType && "text-muted-foreground"
                      )}
                    >
                      {editFormData.accountType
                        ? `${ACCOUNT_TYPES.find((type) => type.value === editFormData.accountType)?.value} - ${ACCOUNT_TYPES.find((type) => type.value === editFormData.accountType)?.label}`
                        : "Select account type"}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search account type..." />
                      <CommandList>
                        <CommandEmpty>No account type found.</CommandEmpty>
                        <CommandGroup>
                          {ACCOUNT_TYPES.map((type) => (
                            <CommandItem
                              key={type.value}
                              value={`${type.value} ${type.label}`}
                              onSelect={() => {
                                setEditFormData({ ...editFormData, accountType: type.value });
                                setEditAccountTypeOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  editFormData.accountType === type.value
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              {type.value} - {type.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="edit-invoice-file">
                  {editReloadMode ? "New invoice file *" : "Replace invoice file (optional)"}
                </Label>
                <Input
                  id="edit-invoice-file"
                  type="file"
                  accept={INVOICE_FILE_ACCEPT}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      invoiceFile: e.target.files?.[0] || null,
                    })
                  }
                  className="mt-2"
                />
              </div>
              {selectedInvoice?.purchaseOrderId
                ? renderOwnerApprovalField({
                    idPrefix: "edit",
                    isUnbudgeted: editPoUnbudgeted,
                    file: editFormData.ownerApprovalFile,
                    onFileChange: (file) =>
                      setEditFormData({ ...editFormData, ownerApprovalFile: file }),
                    existingFileUrl: selectedInvoice.ownerApprovalFileUrl,
                    existingFileName: selectedInvoice.ownerApprovalFileName,
                    replaceLabel:
                      "Upload a new file to change or reload owner approval.",
                  })
                : null}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateInvoice} disabled={uploading}>
                {uploading ? (
                  <>
                    <ActiniumLoader size="sm" className="mr-2" />
                    {editReloadMode ? "Reloading..." : "Updating..."}
                  </>
                ) : (
                  <>
                    <Edit className="h-4 w-4 mr-2" />
                    {editReloadMode ? "Reload invoice" : "Update"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={budgetChangeRow != null}
          onOpenChange={(open) => {
            if (!open) setBudgetChangeRow(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request PO budget classification change</DialogTitle>
              <DialogDescription>
                PO {budgetChangeRow?.poNumber} — change applies only after approval by access
                levels 44–48. PO, requisition, and invoice will align on approval.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {budgetChangeLoading ? (
                <div className="flex items-center text-sm text-muted-foreground">
                  <ActiniumLoader size="sm" className="mr-2" />
                  Loading current classification…
                </div>
              ) : (
                <>
                  <div>
                    <Label>Current classification</Label>
                    <div className="mt-2">
                      <BudgetClassificationBadge
                        isBudgeted={budgetChangeContext?.effectiveIsBudgeted}
                        size="lg"
                      />
                    </div>
                  </div>
                  {budgetChangeContext?.pendingRequestId ? (
                    <p className="text-sm text-amber-800">
                      A change request is already pending.{" "}
                      <Link
                        href="/purchase/po-budget-change"
                        className="text-info underline"
                      >
                        View approval queue
                      </Link>
                    </p>
                  ) : (
                    <>
                      <div>
                        <Label>Change to *</Label>
                        <div className="mt-2 flex flex-wrap gap-3">
                          <Button
                            type="button"
                            variant={budgetChangeTarget === true ? "default" : "outline"}
                            size="sm"
                            onClick={() => setBudgetChangeTarget(true)}
                          >
                            Budgeted
                          </Button>
                          <Button
                            type="button"
                            variant={budgetChangeTarget === false ? "default" : "outline"}
                            size="sm"
                            onClick={() => setBudgetChangeTarget(false)}
                          >
                            Un-Budgeted
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="budget-change-reason">Reason</Label>
                        <Textarea
                          id="budget-change-reason"
                          value={budgetChangeReason}
                          onChange={(e) => setBudgetChangeReason(e.target.value)}
                          className="mt-2 min-h-[80px]"
                          placeholder="Why should this PO be reclassified?"
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBudgetChangeRow(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleSubmitBudgetChange()}
                disabled={
                  budgetChangeSubmitting ||
                  budgetChangeLoading ||
                  Boolean(budgetChangeContext?.pendingRequestId) ||
                  budgetChangeTarget == null
                }
              >
                {budgetChangeSubmitting ? (
                  <>
                    <ActiniumLoader size="sm" className="mr-2" />
                    Submitting…
                  </>
                ) : (
                  "Submit for approval"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {emailDialogRow?.row.invoice ? (
          <InvoiceEmailDialog
            open={Boolean(emailDialogRow)}
            onOpenChange={(open) => {
              if (!open) setEmailDialogRow(null);
            }}
            invoiceId={emailDialogRow.row.invoice!.id}
            recipientType={emailDialogRow.recipientType}
            poNumber={emailDialogRow.row.poNumber}
            invoiceNumber={emailDialogRow.row.invoice.invoiceNumber}
            supplierName={emailDialogRow.row.vendorName}
            vesselName={emailDialogRow.row.vesselName}
          />
        ) : null}

        {platformMessagesRow?.invoice ? (
          <InvoicePlatformMessagesDialog
            open={Boolean(platformMessagesRow)}
            onOpenChange={(open) => {
              if (!open) setPlatformMessagesRow(null);
            }}
            purchaseOrderId={platformMessagesRow.purchaseOrderId}
            poNumber={platformMessagesRow.poNumber}
            invoiceNumber={platformMessagesRow.invoice.invoiceNumber}
            onMessagesRead={() => {
              const poIds = workbenchRows
                .filter((r) => r.invoice)
                .map((r) => r.purchaseOrderId);
              void refreshVendorReplyUnreadCounts(poIds);
            }}
          />
        ) : null}

        <InvoiceVerificationDialog
          open={Boolean(verificationDialog)}
          onOpenChange={(open) => {
            if (!open) setVerificationDialog(null);
          }}
          invoiceId={verificationDialog?.invoiceId ?? null}
          mode={verificationDialog?.mode ?? "view"}
          fromNotification={verificationDialog?.fromNotification ?? false}
          onSuccess={() => void refreshInvoicesData()}
        />
      </main>
    </div>
        </PageReadyGate>
  );
}

