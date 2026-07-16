"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, FileText, DollarSign, TrendingUp, AlertCircle, Trophy, Download, Search, Wrench, CheckCircle2, Star, MessageSquare, MapPin, Calendar, Clock, Edit, Loader2, Paperclip } from "lucide-react";
import ActiniumLoader from "@/components/ActiniumLoader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StarRating } from "@/components/StarRating";
import { formatDualCurrencySync, formatCurrency as formatCurrencyUtil, BASE_CURRENCY, convertCurrencySync, convertQuoteAmountToUsd, convertQuoteAmountToCurrency, formatTripleCurrencySync, COMMON_MARINE_CURRENCIES } from "@/lib/utils/currency-shared";
import type { RateSource } from "@/lib/utils/currency-shared";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { TablePagination } from "@/components/ui/table-pagination";
import { toast } from "sonner";
import { NetworkErrorHandler } from "@/components/NetworkErrorHandler";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildComparisonKpis, countQuotedItems, computeVendorTotalsSummary } from "@/lib/procurement/quote-comparison-metrics";
import { canManageFreight } from "@/lib/freight/constants";
import { ComparisonKpiCards } from "./components/ComparisonKpiCards";
import { VendorRankingTable } from "./components/VendorRankingTable";
import { ComparisonOverviewTab } from "./components/ComparisonOverviewTab";
import { ComparisonBudgetBar } from "./components/ComparisonBudgetBar";
import { ComparisonCommercialTab } from "./components/ComparisonCommercialTab";
import { ComparisonDeliveryTab } from "./components/ComparisonDeliveryTab";
import { ComparisonAttachmentsTab } from "./components/ComparisonAttachmentsTab";
import { QuoteComparisonRequisitionTable } from "./components/QuoteComparisonRequisitionTable";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { matchQuoteLineToRequisitionItem } from "@/lib/procurement/match-quote-requisition-item";
import {
  assignRequisitionLineNumbers,
  getRequisitionLineNumber,
} from "@/lib/procurement/requisition-line-identity";

interface QuoteComparison {
  quoteId: string;
  status: string;
  quoteNumber?: string | null;
  vendor: {
    id: string;
    name: string;
    email: string;
    rating?: number | null;
  };
  totalAmount: number | null;
  currency: string;
  /** Frozen multiplier from quote currency → USD (set server-side from Accounts rates or market as of received date). */
  quoteToUsdRate?: number | null;
  localCurrency?: string | null; // Local Currency quote
  localCurrencyAmount?: number | null; // Local Currency amount
  validUntil: Date | null;
  receivedAt: Date | null;
  itemCount: number;
  fileUrl?: string | null;
  fileName?: string | null;
  fileAttachmentId?: string | null;
  // Enhanced quote fields - ALL REQUIRED FIELDS
  additionalCharges?: number | null;
  deliveryCharges?: number | null;
  deliveryChargesAttachment?: string | null;
  otherChargesBreakdown?: Record<string, number> | null;
  termsAndConditions?: string | null; // Terms and Condition from vendor
  deliveryTerms?: string | null;
  paymentTerms?: string | null;
  packingCharges?: number | null;
  deliveryPort?: string | null;
  exWorkLocation?: string | null;
  quotationReference?: string | null;
  leadTime?: string | null; // Lead Time
  validityPeriod?: string | null; // e.g. "30 days" from Excel
  portOfSupply?: string | null; // Port of supply
  referenceDocuments?: Array<{ id: string; filename: string; fileUrl: string | null }>; // Attachments other than quote Excel
  items: Array<{
    id?: string;
    requisitionItemId?: string | null;
    itemName: string;
    description?: string | null;
    quantity: number;
    unit: string;
    unitPrice: number | null;
    totalPrice: number | null;
    deliveryTime: number | null;
    remarks?: string | null; // Remarks
    discountPercent?: number | null; // Percentage Discount
    expectedDeliveryPort?: string | null;
    expectedDeliveryDate?: Date | string | null;
    itemRemarks?: string | null;
    lineNumber?: number | null;
    impaNumber?: string | null; // IMPA number (OEM/Part number)
    partNumber?: string | null;
  }>;
}

interface RequisitionInfo {
  id: string;
  requisitionNumber: string;
  requisitionType?: string;
  heading: string;
  status: string;
  isBudgeted?: boolean | null;
  budgetCode?: string | null;
  portOfSupply?: string | null;
  vesselLocalCurrency?: string | null;
  splitAllocationsAsParent?: Array<{
    vendorQuoteId?: string;
    vendorQuote?: { id: string };
    allocationItems: Array<{ requisitionItemId: string }>;
  }>;
  vessel?: {
    name: string;
    code: string;
  };
  items: Array<{
    id: string;
    itemName: string;
    description: string | null;
    remarks?: string | null;
    quantity: number;
    quantityInLiters?: number | null;
    unit: string;
    urgency?: string;
    impaNumber?: string | null;
    partNumber?: string | null;
    partName?: string | null;
    itemNumber?: string | null;
    drawingNumber?: string | null;
    oilGrade?: string | null;
    manualMachineryName?: string | null;
    paintBrand?: string | null;
    paintProductName?: string | null;
    paintColorGrade?: string | null;
    paintCategory?: string | null;
    attachments?: Array<{
      id: string;
      fileName: string;
      mimeType?: string | null;
      fileSize?: number | null;
    }>;
    defect?: {
      id: string;
      defectCode: string;
      heading: string;
    } | null;
  }>;
}

type VendorQuoteVisual = {
  headerBg: string;
  tableHeaderBg: string;
  borderColor: string;
  rowBg: string;
  headerText: "text-foreground";
  badgeBg: string;
  badgeText: "text-foreground";
};

/** Vendor card chrome: derived from your reference swatches (Teal, Light grey, Bronze→Silver, Navy stack, Pink scale, Orange “Shades”) — light surfaces + readable dark text. Includes 5 extra blended steps for long quote lists. */
const VENDOR_QUOTE_CARD_THEMES: VendorQuoteVisual[] = [
  // --- Teal (“Shades of Teal”) ---
  { headerBg: "#f5fcf9", tableHeaderBg: "#def7ef", borderColor: "#5eead4", rowBg: "#ffffff", headerText: "text-foreground", badgeBg: "rgba(13, 148, 136, 0.12)", badgeText: "text-foreground" },
  { headerBg: "#e8faf5", tableHeaderBg: "#c8f0e4", borderColor: "#2dd4bf", rowBg: "#fbfffe", headerText: "text-foreground", badgeBg: "rgba(13, 148, 136, 0.14)", badgeText: "text-foreground" },
  { headerBg: "#dcf5ef", tableHeaderBg: "#a8e8d6", borderColor: "#14b8a6", rowBg: "#fbfffe", headerText: "text-foreground", badgeBg: "rgba(15, 118, 110, 0.14)", badgeText: "text-foreground" },
  { headerBg: "#cfeadf", tableHeaderBg: "#7fdcc5", borderColor: "#0d9488", rowBg: "#fefefe", headerText: "text-foreground", badgeBg: "rgba(13, 148, 136, 0.16)", badgeText: "text-foreground" },
  { headerBg: "#bfe0d6", tableHeaderBg: "#5cbcaa", borderColor: "#0f766e", rowBg: "#fefefe", headerText: "text-foreground", badgeBg: "rgba(15, 118, 110, 0.18)", badgeText: "text-foreground" },
  // --- Light grey (“Shades of light grey”) ---
  { headerBg: "#ebebeb", tableHeaderBg: "#e0e0e0", borderColor: "#c4c4c4", rowBg: "#ffffff", headerText: "text-foreground", badgeBg: "rgba(17, 17, 17, 0.07)", badgeText: "text-foreground" },
  { headerBg: "#f0f0f0", tableHeaderBg: "#e6e6e6", borderColor: "#cdcdcd", rowBg: "#ffffff", headerText: "text-foreground", badgeBg: "rgba(17, 17, 17, 0.06)", badgeText: "text-foreground" },
  { headerBg: "#f3f3f3", tableHeaderBg: "#eaeaea", borderColor: "#d6d6d6", rowBg: "#ffffff", headerText: "text-foreground", badgeBg: "rgba(17, 17, 17, 0.06)", badgeText: "text-foreground" },
  { headerBg: "#f6f6f6", tableHeaderBg: "#efefef", borderColor: "#dcdcdc", rowBg: "#ffffff", headerText: "text-foreground", badgeBg: "rgba(17, 17, 17, 0.05)", badgeText: "text-foreground" },
  { headerBg: "#fafafa", tableHeaderBg: "#f4f4f4", borderColor: "#e3e3e3", rowBg: "#ffffff", headerText: "text-foreground", badgeBg: "rgba(17, 17, 17, 0.05)", badgeText: "text-foreground" },
  // --- Bronze → Silver ---
  { headerBg: "#f7f2ea", tableHeaderBg: "#eee4d6", borderColor: "#b89a6a", rowBg: "#fffdfb", headerText: "text-foreground", badgeBg: "rgba(139, 105, 20, 0.12)", badgeText: "text-foreground" },
  { headerBg: "#f1ebe1", tableHeaderBg: "#e5dcd0", borderColor: "#a67c3d", rowBg: "#fffdfb", headerText: "text-foreground", badgeBg: "rgba(139, 105, 20, 0.14)", badgeText: "text-foreground" },
  { headerBg: "#ebe6de", tableHeaderBg: "#dbd3c8", borderColor: "#8f7350", rowBg: "#fffdfb", headerText: "text-foreground", badgeBg: "rgba(113, 90, 50, 0.12)", badgeText: "text-foreground" },
  { headerBg: "#e8e5e1", tableHeaderBg: "#d4d0ca", borderColor: "#7a7268", rowBg: "#ffffff", headerText: "text-foreground", badgeBg: "rgba(90, 82, 70, 0.1)", badgeText: "text-foreground" },
  { headerBg: "#ededed", tableHeaderBg: "#e2e2e4", borderColor: "#9ca3af", rowBg: "#ffffff", headerText: "text-foreground", badgeBg: "rgba(75, 85, 99, 0.1)", badgeText: "text-foreground" },
  // --- Navy / cool slate ladder (light UI chrome from your stack #CCD0CF → #06141B) ---
  { headerBg: "#e8ecec", tableHeaderBg: "#dde3e3", borderColor: "#4a5c6a", rowBg: "#ffffff", headerText: "text-foreground", badgeBg: "rgba(74, 92, 106, 0.12)", badgeText: "text-foreground" },
  { headerBg: "#e2e8e9", tableHeaderBg: "#d5dce0", borderColor: "#3d5566", rowBg: "#ffffff", headerText: "text-foreground", badgeBg: "rgba(61, 85, 102, 0.12)", badgeText: "text-foreground" },
  { headerBg: "#dce4e6", tableHeaderBg: "#ccd6d9", borderColor: "#314a5c", rowBg: "#fefeff", headerText: "text-foreground", badgeBg: "rgba(49, 74, 92, 0.12)", badgeText: "text-foreground" },
  { headerBg: "#d0dbdf", tableHeaderBg: "#bfcbd1", borderColor: "#253745", rowBg: "#fefeff", headerText: "text-foreground", badgeBg: "rgba(37, 55, 69, 0.14)", badgeText: "text-foreground" },
  { headerBg: "#c5d0d6", tableHeaderBg: "#afbec6", borderColor: "#11212d", rowBg: "#fdfefe", headerText: "text-foreground", badgeBg: "rgba(17, 33, 45, 0.12)", badgeText: "text-foreground" },
  { headerBg: "#bac6cd", tableHeaderBg: "#9ba8ab", borderColor: "#06141b", rowBg: "#fdfefe", headerText: "text-foreground", badgeBg: "rgba(6, 20, 27, 0.1)", badgeText: "text-foreground" },
  // --- Pink scale (lighter weights for card chrome) ---
  { headerBg: "#fce7ef", tableHeaderBg: "#f9c5da", borderColor: "#f48fb1", rowBg: "#fffafd", headerText: "text-foreground", badgeBg: "rgba(233, 30, 99, 0.1)", badgeText: "text-foreground" },
  { headerBg: "#fad4e4", tableHeaderBg: "#f8a5c8", borderColor: "#ec407a", rowBg: "#fffafd", headerText: "text-foreground", badgeBg: "rgba(233, 30, 99, 0.12)", badgeText: "text-foreground" },
  { headerBg: "#f8c2db", tableHeaderBg: "#f48fb1", borderColor: "#d81b60", rowBg: "#fffafd", headerText: "text-foreground", badgeBg: "rgba(194, 24, 91, 0.12)", badgeText: "text-foreground" },
  // --- Orange “Shades” (warm end kept light for rows) ---
  { headerBg: "#fff7ed", tableHeaderBg: "#ffedd5", borderColor: "#fb923c", rowBg: "#fffaf5", headerText: "text-foreground", badgeBg: "rgba(234, 88, 12, 0.12)", badgeText: "text-foreground" },
  { headerBg: "#fff0db", tableHeaderBg: "#fed7aa", borderColor: "#ea580c", rowBg: "#fffaf5", headerText: "text-foreground", badgeBg: "rgba(234, 88, 12, 0.14)", badgeText: "text-foreground" },
  { headerBg: "#ffe8d0", tableHeaderBg: "#fdba74", borderColor: "#c2410c", rowBg: "#fffaf5", headerText: "text-foreground", badgeBg: "rgba(154, 52, 18, 0.12)", badgeText: "text-foreground" },
  // --- Five extended blends (for quote counts beyond the palette above) ---
  { headerBg: "#eef4f3", tableHeaderBg: "#dce8e6", borderColor: "#4f6d6a", rowBg: "#ffffff", headerText: "text-foreground", badgeBg: "rgba(47, 89, 84, 0.1)", badgeText: "text-foreground" },
  { headerBg: "#f4f0eb", tableHeaderBg: "#e6dfd5", borderColor: "#6b7280", rowBg: "#fffdfb", headerText: "text-foreground", badgeBg: "rgba(75, 85, 99, 0.1)", badgeText: "text-foreground" },
  { headerBg: "#f3eaef", tableHeaderBg: "#e5dae2", borderColor: "#a78b9a", rowBg: "#fffafc", headerText: "text-foreground", badgeBg: "rgba(167, 139, 154, 0.14)", badgeText: "text-foreground" },
  { headerBg: "#fff3ea", tableHeaderBg: "#f0e0d4", borderColor: "#b45309", rowBg: "#fffaf5", headerText: "text-foreground", badgeBg: "rgba(180, 83, 9, 0.12)", badgeText: "text-foreground" },
  { headerBg: "#e6f2f3", tableHeaderBg: "#d5e9ea", borderColor: "#0f766e", rowBg: "#ffffff", headerText: "text-foreground", badgeBg: "rgba(15, 118, 110, 0.12)", badgeText: "text-foreground" },
];

const APPROVED_VENDOR_QUOTE_THEME: VendorQuoteVisual = {
  headerBg: "#fffbeb",
  tableHeaderBg: "#fde68a",
  borderColor: "#fbbf24",
  rowBg: "#fffbeb",
  headerText: "text-foreground",
  badgeBg: "rgba(234, 88, 12, 0.14)",
  badgeText: "text-foreground",
};

const COMPARISON_TAB_TRIGGER_CLASS =
  "h-8 flex-none rounded-md border border-border/70 bg-card px-4 text-xs font-semibold text-muted-foreground shadow-sm transition-colors hover:border-border hover:bg-background hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md";

export function QuotesContent() {
  const params = useParams();
  const router = useRouter();
  const requisitionId = params.id as string;
  const { ready, markSuccess } = usePageBootstrap();

  const [requisition, setRequisition] = useState<RequisitionInfo | null>(null);
  const [quotes, setQuotes] = useState<QuoteComparison[]>([]);
  const [importPendingCount, setImportPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  /** First `fetchData` completion (success or error) — avoids empty-state flash while requests are in flight. */
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chunkError, setChunkError] = useState<Error | null>(null);
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<string[]>([]); // Multi-select for split (top checkboxes); Approve uses when length === 1
  const [approvingQuote, setApprovingQuote] = useState(false);
  const [userAccessLevel, setUserAccessLevel] = useState<number | null>(null);
  const [lastQuoteProcessTime, setLastQuoteProcessTime] = useState<string | null>(null);
  // Store updated quantities: key = itemId, value = updated quantity (common for all vendors)
  const [updatedQuantities, setUpdatedQuantities] = useState<Record<string, number>>({});
  // Item-level vendor selection: key = requisitionItemId, value = quoteId (one item supplied by one vendor only)
  const [selectedVendorPerItem, setSelectedVendorPerItem] = useState<Record<string, string>>({});
  const [splittingQuote, setSplittingQuote] = useState(false);
  /** Split PO: show when selected vendors lack line items */
  const [splitVendorValidationOpen, setSplitVendorValidationOpen] = useState(false);
  const [splitVendorValidationNames, setSplitVendorValidationNames] = useState<string[]>([]);

  // Delivery & Other Charges Dialog State (manual entry with breakdown)
  const QUOTE_CHARGE_FIELDS = [
    { key: "deliveryCharges", label: "Delivery Charges" },
    { key: "courierCharges", label: "Courier Charges" },
    { key: "handlingCharges", label: "Handling Charges" },
    { key: "transportCharges", label: "Transport Charges" },
    { key: "customClearanceCharges", label: "Custom Clearance Charges" },
    { key: "warehouseCharges", label: "Warehouse Charges" },
  ] as const;
  const [showDeliveryChargesDialog, setShowDeliveryChargesDialog] = useState(false);
  const [chargesBreakdown, setChargesBreakdown] = useState<Record<string, string>>({});
  const [deliveryChargesFile, setDeliveryChargesFile] = useState<File | null>(null);
  const [updatingDeliveryCharges, setUpdatingDeliveryCharges] = useState(false);
  const [quoteToEditDelivery, setQuoteToEditDelivery] = useState<QuoteComparison | null>(null);
  const [rankSummaryPage, setRankSummaryPage] = useState(1);
  const RANK_SUMMARY_PAGE_SIZE = 15;
  const [comparisonTab, setComparisonTab] = useState("overview");
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsPageSize] = useState(15);

  // Multi-currency display state
  const [displayCurrency, setDisplayCurrency] = useState<string>(BASE_CURRENCY);
  const [rateSource, setRateSource] = useState<RateSource>('frozen');
  const [vesselLocalCurrency, setVesselLocalCurrency] = useState<string | null>(null);
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>([]);
  const [openClarificationCount, setOpenClarificationCount] = useState(0);

  const chargesTotalForDialog = useMemo(() => {
    return QUOTE_CHARGE_FIELDS.reduce((sum, { key }) => sum + (parseFloat(chargesBreakdown[key] || "0") || 0), 0);
  }, [chargesBreakdown]);

  const openDeliveryChargesDialog = (quote: QuoteComparison) => {
    setQuoteToEditDelivery(quote);
    const breakdown = quote.otherChargesBreakdown;
    const initial: Record<string, string> = {};
    QUOTE_CHARGE_FIELDS.forEach(({ key }) => {
      const val = breakdown?.[key] ?? (key === "deliveryCharges" ? quote.deliveryCharges : undefined);
      initial[key] = val != null ? String(val) : "";
    });
    setChargesBreakdown(initial);
    setDeliveryChargesFile(null);
    setShowDeliveryChargesDialog(true);
  };

  const updateDeliveryCharges = async () => {
    if (!quoteToEditDelivery) return;
    try {
      setUpdatingDeliveryCharges(true);
      const formData = new FormData();
      QUOTE_CHARGE_FIELDS.forEach(({ key }) => {
        formData.append(key, chargesBreakdown[key]?.trim() || "0");
      });
      formData.append("deliveryCharges", String(chargesTotalForDialog));
      if (deliveryChargesFile) {
        formData.append("file", deliveryChargesFile);
      }
      const response = await fetch(`/api/quotes/${quoteToEditDelivery.quoteId}/delivery-charges`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update delivery charges");
      }
      toast.success("Delivery and other charges updated successfully");
      setShowDeliveryChargesDialog(false);
      fetchData();
    } catch (err: any) {
      console.error("Error updating delivery charges:", err);
      toast.error(err.message || "Failed to update delivery charges");
    } finally {
      setUpdatingDeliveryCharges(false);
    }
  };


  const persistBudgetSelection = async (next: boolean | null) => {
    if (!requisition) return;
    const previous = requisition.isBudgeted ?? null;
    setRequisition((r) => (r ? { ...r, isBudgeted: next } : r));
    try {
      const res = await fetch(`/api/requisitions/${requisitionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isBudgeted: next }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to update");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update budget selection");
      setRequisition((r) => (r ? { ...r, isBudgeted: previous } : r));
    }
  };

  // Fetch user access level
  const fetchUserAccessLevel = async () => {
    try {
      const response = await fetch('/api/profile/basic', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setUserAccessLevel(data.user?.designationAccessLevel || null);
      }
    } catch (error) {
      console.error('Error fetching user access level:', error);
    }
  };

  // Handle chunk loading errors and network errors
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const errorMessage = event.message || '';
      const isChunkError = 
        errorMessage.includes('Failed to load chunk') ||
        errorMessage.includes('Loading chunk') ||
        errorMessage.includes('ChunkLoadError') ||
        errorMessage.includes('Minified React error #130');
      
      const isNetworkError =
        errorMessage.includes('network') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('Failed to fetch');

      if (isChunkError || isNetworkError) {
        console.error('Chunk/Network loading error detected:', event);
        const userMessage = isChunkError
          ? 'There was a loading problem while opening the quote comparison page. Please try again.'
          : 'Network problem while loading the quote comparison page. Please check your connection and try again.';
        setChunkError(new Error(errorMessage || userMessage));
        setError(userMessage);
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || event.reason?.toString() || '';
      const isChunkError = 
        reason.includes('Failed to load chunk') ||
        reason.includes('Loading chunk') ||
        reason.includes('ChunkLoadError') ||
        reason.includes('Minified React error #130');
      
      if (isChunkError) {
        console.error('Unhandled chunk loading error:', event.reason);
        const userMessage = 'There was a loading problem while opening the quote comparison page. Please try again.';
        setChunkError(new Error(reason || userMessage));
        setError(userMessage);
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    fetchData();
    fetchUserAccessLevel();
  }, [requisitionId]);

  // Access level 25 or less cannot access quote comparison – redirect to requisitions
  useEffect(() => {
    if (userAccessLevel == null) return;
    if (userAccessLevel <= 25) {
      toast.error("You do not have access to quote comparison.");
      router.replace("/purchase/view-requisitions");
    }
  }, [userAccessLevel, router]);

  // Automatic email processing - runs only once when page is first loaded
  useEffect(() => {
    let isProcessing = false;
    let initialTimeout: NodeJS.Timeout | null = null;

    const autoProcessEmails = async () => {
      // Don't run if already processing or loading
      if (isProcessing || loading) {
        return;
      }

      try {
        isProcessing = true;
        
        const processResponse = await fetch('/api/emails/process-quotes', {
          method: 'POST',
          credentials: 'include',
        });
        
        const processData = await processResponse.json();
        
        if (processResponse.ok && processData.success) {
          const quotesProcessed = processData.quotesProcessed || 0;
          const emailsFetched = processData.emailsFetched || 0;
          
          if (quotesProcessed > 0 || emailsFetched > 0) {
            console.log(`🔄 Auto-processed on quote page (one-time): ${quotesProcessed} quote(s) from ${emailsFetched} email(s)`);
            setLastQuoteProcessTime(new Date().toLocaleString());
            setTimeout(() => {
              fetchData();
            }, 1000);
          }
        } else if (processResponse.status === 401) {
          toast.warning('Automatic quote processing requires admin access. Please ask admin to run it from Gmail Admin page.');
        } else {
          const errorMessage = processData?.error || 'Failed to auto-process quote emails';
          console.error('Quote auto-processing failed:', errorMessage);
        }
      } catch (error) {
        console.error('Auto-processing error on quote page (silent):', error);
      } finally {
        isProcessing = false;
      }
    };

    // Run only once when page loads (after a short delay to let initial data load)
    // No continuous polling - user can manually refresh if needed
    initialTimeout = setTimeout(autoProcessEmails, 3000);

    return () => {
      if (initialTimeout) {
        clearTimeout(initialTimeout);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requisitionId]); // Re-run only if requisition ID changes (new page load)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setChunkError(null);

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        // Fetch requisition details with timeout
        const reqResponse = await fetch(`/api/requisitions/${requisitionId}`, {
          credentials: "include",
          signal: controller.signal,
        });

        if (!reqResponse.ok) {
          throw new Error("Failed to fetch requisition");
        }

        const reqData = await reqResponse.json();
        setRequisition({
          ...reqData,
          isBudgeted: reqData.isBudgeted === true ? true : reqData.isBudgeted === false ? false : null,
        });

        if (Array.isArray(reqData.splitAllocationsAsParent) && reqData.splitAllocationsAsParent.length > 0) {
          const nextVendorPerItem: Record<string, string> = {};
          const quoteIdsUsed: string[] = [];
          for (const alloc of reqData.splitAllocationsAsParent) {
            const quoteId = alloc.vendorQuote?.id ?? alloc.vendorQuoteId;
            if (!quoteId) continue;
            quoteIdsUsed.push(quoteId);
            for (const ai of alloc.allocationItems ?? []) {
              if (ai.requisitionItemId) nextVendorPerItem[ai.requisitionItemId] = quoteId;
            }
          }
          if (Object.keys(nextVendorPerItem).length > 0) {
            setSelectedVendorPerItem(nextVendorPerItem);
            setSelectedQuoteIds([...new Set(quoteIdsUsed)]);
          }
        }

        try {
          const clarRes = await fetch(
            `/api/rfq-clarifications?requisitionId=${encodeURIComponent(requisitionId)}&pending=1`,
            { credentials: "include", signal: controller.signal }
          );
          if (clarRes.ok) {
            const clarData = await clarRes.json();
            setOpenClarificationCount(clarData.openCount ?? clarData.clarifications?.length ?? 0);
          }
        } catch {
          setOpenClarificationCount(0);
        }

        // Fetch quote comparison with timeout
        const quotesResponse = await fetch(`/api/quotes/${requisitionId}/compare`, {
          credentials: "include",
          signal: controller.signal,
        });

        if (!quotesResponse.ok) {
          if (quotesResponse.status === 404) {
            setQuotes([]);
            setLoading(false);
            markSuccess();
            clearTimeout(timeoutId);
            return;
          }
          let detail = "";
          try {
            const errBody = await quotesResponse.json();
            detail =
              typeof errBody?.error === "string"
                ? errBody.error
                : typeof errBody?.message === "string"
                  ? errBody.message
                  : "";
            if (errBody?.details && process.env.NODE_ENV === "development") {
              detail = detail ? `${detail}: ${errBody.details}` : String(errBody.details);
            }
          } catch {
            /* ignore non-JSON error bodies */
          }
          throw new Error(
            detail
              ? `Failed to fetch quotes (${quotesResponse.status}): ${detail}`
              : `Failed to fetch quotes (${quotesResponse.status})`
          );
        }

        const quotesData = await quotesResponse.json();
        const comparisonData = quotesData.comparison || [];
        setQuotes(comparisonData);
        setImportPendingCount(
          quotesData.importSummary?.importPendingCount ??
            quotesData.importSummary?.statusReceivedWithoutPrices ??
            0
        );

        // Extract currency context from API response
        const ctx = quotesData.currencyContext;
        if (ctx) {
          if (ctx.vesselLocalCurrency) setVesselLocalCurrency(ctx.vesselLocalCurrency);
          if (ctx.availableCurrencies?.length) setAvailableCurrencies(ctx.availableCurrencies);
          if (ctx.baseCurrency) setDisplayCurrency(ctx.baseCurrency);
        }

        // Set first vendor (by array order) as selected by default if none selected
        if (comparisonData.length > 0) {
          setSelectedQuoteIds((prev) => (prev.length === 0 ? [comparisonData[0].quoteId] : prev));
        }

        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout')) {
          throw new Error("Request timed out. Please check your network connection and try again.");
        }
        throw fetchError;
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load quotes";
      const isNetworkOrChunkError =
        errorMessage.includes('timeout') ||
        errorMessage.includes('network') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('Failed to load') ||
        errorMessage.includes('chunk') ||
        errorMessage.includes('Minified React error #130');

      if (isNetworkOrChunkError) {
        const userMessage = errorMessage.includes('Minified React error #130') || errorMessage.includes('chunk')
          ? 'There was a loading problem while opening the quote comparison page. Please try again.'
          : 'Network problem while loading the quote comparison page. Please check your connection and try again.';
        setError(userMessage);
      } else {
        setError(errorMessage);
      }
      
      // Check if it's a network/chunk error
      if (isNetworkOrChunkError) {
        setChunkError(err instanceof Error ? err : new Error(errorMessage));
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setInitialFetchDone(true);
      markSuccess();
    }
  }, [requisitionId, markSuccess]);

  const formatCurrency = (
    amount: number | null,
    currency: string = "USD",
    showDual: boolean = true,
    quoteToUsdRate?: number | null
  ) => {
    if (amount === null || amount === undefined) return "N/A";
    if (showDual && currency !== BASE_CURRENCY) {
      return formatDualCurrencySync(amount, currency, BASE_CURRENCY, quoteToUsdRate);
    }
    return formatCurrencyUtil(amount, currency);
  };

  /**
   * Format a quote amount in the selected display currency.
   * Shows original currency + converted to display currency.
   */
  const formatInDisplayCurrency = (
    amount: number | null,
    quoteCurrency: string,
    quoteToUsdRate?: number | null
  ): string => {
    if (amount === null || amount === undefined) return "N/A";
    
    // 'ORIGINAL' means show in the quote's own currency without conversion
    if (displayCurrency === 'ORIGINAL' || displayCurrency === quoteCurrency) {
      return formatCurrencyUtil(amount, quoteCurrency);
    }
    
    const original = formatCurrencyUtil(amount, quoteCurrency);
    
    // Convert to display currency
    const result = convertQuoteAmountToCurrency(amount, quoteCurrency, displayCurrency, quoteToUsdRate);
    const converted = formatCurrencyUtil(result.amount, displayCurrency);
    
    // Show both with rate source indicator
    return `${original} (${converted})`;
  };

  /**
   * Format a quote amount showing all three: original, base (USD), and vessel local currency.
   */
  const formatTripleCurrency = (
    amount: number | null,
    quoteCurrency: string,
    quoteToUsdRate?: number | null
  ): string => {
    if (amount === null || amount === undefined) return "N/A";
    return formatTripleCurrencySync(amount, quoteCurrency, BASE_CURRENCY, vesselLocalCurrency, quoteToUsdRate);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Match quote items with requisition items (requisitionItemId / line # / unique IMPA — not name-only)
  const requisitionLinesForMatch = useMemo(
    () =>
      assignRequisitionLineNumbers(
        (requisition?.items ?? []).map((it) => ({
          id: it.id,
          itemName: it.itemName,
          impaNumber: it.impaNumber,
          quantity: it.quantity,
          unit: it.unit,
        }))
      ),
    [requisition?.items]
  );

  const getQuoteItemForRequisitionItem = useCallback(
    (quote: QuoteComparison, requisitionItem: RequisitionInfo["items"][0]) => {
      if (!requisition?.items?.length) return undefined;
      const reqLine = requisitionLinesForMatch.find((r) => r.id === requisitionItem.id);
      if (!reqLine) return undefined;
      const quoteLines = quote.items.map((q, idx) => ({
        ...q,
        lineNumber:
          q.lineNumber ??
          (q.requisitionItemId
            ? getRequisitionLineNumber(q.requisitionItemId, requisitionLinesForMatch)
            : idx + 1),
      }));
      return matchQuoteLineToRequisitionItem(quoteLines, reqLine, requisitionLinesForMatch);
    },
    [requisition?.items, requisitionLinesForMatch]
  );

  // Calculate discount percentage from existing total, quantity, and unit price
  // Formula: Total = Qty * UnitPrice * (100 - Discount) / 100
  // Solving for Discount: Discount = 100 - (Total * 100 / (Qty * UnitPrice))
  const calculateDiscount = (
    totalPrice: number | null,
    quantity: number,
    unitPrice: number | null
  ): number => {
    if (!totalPrice || !unitPrice || quantity === 0) return 0;
    const calculatedDiscount = 100 - (totalPrice * 100 / (quantity * unitPrice));
    return Math.max(0, Math.min(100, calculatedDiscount)); // Clamp between 0 and 100
  };

  // Calculate total with updated quantity
  // Formula: Total = Updated Qty * Unit Price * (100 - Discount) / 100
  const calculateTotalWithUpdatedQty = (
    updatedQty: number,
    unitPrice: number | null,
    discount: number
  ): number | null => {
    if (!unitPrice) return null;
    if (updatedQty <= 0) return 0; // Return 0 instead of null when quantity is 0
    return updatedQty * unitPrice * (100 - discount) / 100;
  };

  // Calculate grand totals and rankings
  const rankedQuotes = useMemo(() => {
    return quotes
      .map((quote) => ({
        ...quote,
        grandTotal: quote.totalAmount ? Number(quote.totalAmount) : 0,
      }))
      .sort((a, b) => a.grandTotal - b.grandTotal)
      .map((quote, index) => ({
        ...quote,
        rank: index + 1,
      }));
  }, [quotes]);

  const hasApprovedQuote = useMemo(() => quotes.some((q) => q.status === "APPROVED"), [quotes]);

  const splitAlreadyApproved = useMemo(() => {
    if (!requisition) return false;
    if (requisition.status === "SPLIT") return true;
    if ((requisition.splitAllocationsAsParent?.length ?? 0) >= 2) return true;
    return quotes.filter((q) => q.status === "APPROVED").length >= 2;
  }, [requisition, quotes]);

  const isComparisonLocked = useMemo(() => {
    if (!requisition) return false;
    const status = requisition.status;
    if (status === "SPLIT" || status === "QUOTE_APPROVED" || status === "QUOTE_CONFIRMED_PO_SENT") {
      return true;
    }
    return hasApprovedQuote;
  }, [requisition, hasApprovedQuote]);

  const itemIncludedInVendorTotal = useCallback(
    (itemId: string, quoteId: string) => {
      if (!isComparisonLocked) return true;
      const assigned = selectedVendorPerItem[itemId];
      if (assigned) return assigned === quoteId;
      const approvedQuote = quotes.find((q) => q.status === "APPROVED");
      return approvedQuote?.quoteId === quoteId;
    },
    [isComparisonLocked, selectedVendorPerItem, quotes]
  );

  const vendorHasAssignedItems = useCallback(
    (quoteId: string) =>
      (requisition?.items ?? []).some((it) => selectedVendorPerItem[it.id] === quoteId),
    [requisition?.items, selectedVendorPerItem]
  );

  /** True when every requisition line is assigned to this vendor (full-vendor selection). */
  const allItemsAssignedToVendor = useCallback(
    (quoteId: string) => {
      const items = requisition?.items ?? [];
      return items.length > 0 && items.every((it) => selectedVendorPerItem[it.id] === quoteId);
    },
    [requisition?.items, selectedVendorPerItem]
  );

  /** Header Select: assign every line to one vendor (single-vendor PO). */
  const assignAllItemsToVendor = useCallback(
    (quoteId: string) => {
      if (!requisition?.items?.length) return;
      const next: Record<string, string> = {};
      requisition.items.forEach((it) => {
        next[it.id] = quoteId;
      });
      setSelectedVendorPerItem(next);
      setSelectedQuoteIds([quoteId]);
    },
    [requisition?.items]
  );

  /** Supply radio: assign one line only (split across vendors). */
  const assignItemToVendor = useCallback((itemId: string, quoteId: string) => {
    setSelectedVendorPerItem((prev) => ({ ...prev, [itemId]: quoteId }));
  }, []);

  /** Vendor header checkbox — selects all items for that vendor; use Supply radios to split instead. */
  const handleVendorSelectCheckbox = useCallback(
    (quoteId: string, checked: boolean | "indeterminate") => {
      if (checked === true) {
        assignAllItemsToVendor(quoteId);
        return;
      }
      if (allItemsAssignedToVendor(quoteId)) return;
      setSelectedQuoteIds((prev) => prev.filter((id) => id !== quoteId));
    },
    [assignAllItemsToVendor, allItemsAssignedToVendor]
  );

  // Default each item to the first vendor (rank 1) when data loads; default top selection to first quote
  useEffect(() => {
    if (isComparisonLocked) return;
    if (!requisition?.items?.length || !rankedQuotes.length || !rankedQuotes[0]) return;
    const firstQuoteId = rankedQuotes[0].quoteId;
    setSelectedVendorPerItem((prev) => {
      const next = { ...prev };
      let changed = false;
      requisition.items.forEach((it) => {
        if (!(it.id in next)) {
          next[it.id] = firstQuoteId;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setSelectedQuoteIds((prev) => (prev.length === 0 ? [firstQuoteId] : prev));
  }, [requisition?.id, requisition?.items?.length, rankedQuotes.length, rankedQuotes[0]?.quoteId, isComparisonLocked]);

  // Keep selectedQuoteIds in sync: one vendor with all lines, or each vendor used in a split
  useEffect(() => {
    if (!requisition?.items?.length || !rankedQuotes.length) return;

    const fullVendor = rankedQuotes.find((q) =>
      requisition.items.every((it) => selectedVendorPerItem[it.id] === q.quoteId)
    );
    if (fullVendor) {
      setSelectedQuoteIds((prev) =>
        prev.length === 1 && prev[0] === fullVendor.quoteId ? prev : [fullVendor.quoteId]
      );
      return;
    }

    const withItems = rankedQuotes
      .map((q) => q.quoteId)
      .filter((qid) => requisition.items.some((it) => selectedVendorPerItem[it.id] === qid));

    setSelectedQuoteIds((prev) => {
      const prevSet = new Set(prev);
      if (withItems.length === prevSet.size && withItems.every((id) => prevSet.has(id))) return prev;
      return withItems;
    });
  }, [selectedVendorPerItem, requisition?.items, requisition?.id, rankedQuotes]);

  // Calculate grand totals with updated quantities (common quantity for all vendors)
  const grandTotalsWithUpdatedQty = useMemo(() => {
    if (!requisition) return {};
    
    const totals: Record<string, number> = {};
    
    rankedQuotes.forEach((quote) => {
      let total = 0;
      requisition.items.forEach((item) => {
        const quoteItem = getQuoteItemForRequisitionItem(quote, item);
        if (quoteItem) {
          const updatedQty = updatedQuantities[item.id] ?? item.quantity;
          const discount = calculateDiscount(
            quoteItem.totalPrice,
            quoteItem.quantity,
            quoteItem.unitPrice
          );
          const itemTotal = calculateTotalWithUpdatedQty(
            updatedQty,
            quoteItem.unitPrice,
            discount
          );
          if (itemTotal !== null) {
            total += itemTotal;
          }
        }
      });
      totals[quote.quoteId] = total;
    });
    
    return totals;
     
  }, [requisition, rankedQuotes, updatedQuantities]);

  // Dashboard ranking uses updated quantities when available
  const requisitionItems = requisition?.items || [];

  const dashboardRankedQuotes = useMemo(() => {
    if (!requisition?.items?.length) return [];
    return rankedQuotes
      .map((quote) => {
        const stats = countQuotedItems(quote, requisition.items, getQuoteItemForRequisitionItem);
        return {
          ...quote,
          displayGrandTotal: grandTotalsWithUpdatedQty[quote.quoteId] ?? quote.grandTotal ?? 0,
          quotedPct: stats.pct,
          missingCount: stats.missing,
        };
      })
      .sort((a, b) => a.displayGrandTotal - b.displayGrandTotal)
      .map((q, i) => ({ ...q, rank: i + 1 }));
  }, [rankedQuotes, grandTotalsWithUpdatedQty, requisition?.items]);

  const comparisonKpis = useMemo(() => {
    if (!requisition?.items?.length || dashboardRankedQuotes.length === 0) return null;
    const forKpi = dashboardRankedQuotes.map((q) => ({
      quoteId: q.quoteId,
      currency: q.currency,
      quoteToUsdRate: q.quoteToUsdRate,
      totalAmount: q.displayGrandTotal,
      additionalCharges: q.additionalCharges,
      deliveryCharges: q.deliveryCharges,
      packingCharges: q.packingCharges,
      paymentTerms: q.paymentTerms,
      deliveryTerms: q.deliveryTerms,
      leadTime: q.leadTime,
      validityPeriod: q.validityPeriod,
      validUntil: q.validUntil,
      items: q.items,
      vendor: q.vendor,
      grandTotal: q.displayGrandTotal,
      quotedStats: countQuotedItems(q, requisition.items, getQuoteItemForRequisitionItem),
      rank: q.rank,
    }));
    return buildComparisonKpis(forKpi, requisition.items);
  }, [dashboardRankedQuotes, requisition?.items]);

  const paginatedRequisitionItems = requisitionItems.slice(
    (itemsPage - 1) * itemsPageSize,
    itemsPage * itemsPageSize
  );

  useEffect(() => {
    setRankSummaryPage(1);
  }, [rankedQuotes.length]);

  useEffect(() => {
    setItemsPage(1);
  }, [requisition?.id, requisition?.items?.length]);

  const quoteCardsRowRef = useRef<HTMLDivElement>(null);

  const clearQuoteRowHeightSync = useCallback((root: HTMLElement) => {
    root.querySelectorAll<HTMLElement>(".quote-card-header").forEach((el) => {
      el.classList.remove("quote-card-header-synced");
      el.style.height = "";
      el.style.minHeight = "";
      el.style.maxHeight = "";
    });
    root.querySelectorAll<HTMLElement>(".quote-card-metadata-footer, .quote-card-currency-note").forEach((el) => {
      el.style.height = "";
      el.style.minHeight = "";
    });
    root.querySelectorAll<HTMLTableRowElement>(
      "tr.quote-header-row, tr.quote-data-row, tr.quote-footer-row"
    ).forEach((tr) => {
      tr.classList.remove("quote-row-height-synced");
      tr.style.height = "";
      tr.style.minHeight = "";
      tr.style.maxHeight = "";
      tr.querySelectorAll<HTMLTableCellElement>("td, th").forEach((cell) => {
        cell.style.height = "";
        cell.style.minHeight = "";
        cell.style.maxHeight = "";
      });
    });
  }, []);

  const applyQuoteTableRowHeight = useCallback((tr: HTMLTableRowElement, px: number) => {
    const h = `${Math.max(1, px)}px`;
    tr.classList.add("quote-row-height-synced");
    tr.style.height = h;
    tr.style.minHeight = h;
    tr.style.maxHeight = h;
    tr.querySelectorAll<HTMLTableCellElement>("td, th").forEach((cell) => {
      cell.style.height = h;
      cell.style.minHeight = h;
      cell.style.maxHeight = h;
    });
  }, []);

  /** Requisition card is the source of truth; vendor cards mirror its row/header/footer heights. */
  const syncQuoteTableRowHeights = useCallback(() => {
    const root = quoteCardsRowRef.current;
    if (!root || root.offsetParent === null) return;

    const firstTable =
      root.querySelector<HTMLTableElement>("table.quote-req-details-table.quote-sync-table") ??
      root.querySelector<HTMLTableElement>("table.quote-sync-table");
    if (!firstTable) return;

    clearQuoteRowHeightSync(root);
    void root.offsetHeight;

    const allTables = root.querySelectorAll<HTMLTableElement>("table.quote-sync-table");
    const allHeaders = root.querySelectorAll<HTMLElement>(".quote-card-header");
    const firstHeader = allHeaders[0];
    if (firstHeader) {
      const headerPx = Math.ceil(firstHeader.getBoundingClientRect().height);
      if (headerPx > 0) {
        const h = `${headerPx}px`;
        allHeaders.forEach((header) => {
          header.classList.add("quote-card-header-synced");
          header.style.height = h;
          header.style.minHeight = h;
          header.style.maxHeight = h;
        });
      }
    }

    const firstHeaderRow = firstTable.querySelector<HTMLTableRowElement>("thead tr.quote-header-row");
    if (firstHeaderRow) {
      const headerRowPx = Math.ceil(firstHeaderRow.getBoundingClientRect().height);
      if (headerRowPx > 0) {
        allTables.forEach((table) => {
          const row = table.querySelector<HTMLTableRowElement>("thead tr.quote-header-row");
          if (row) applyQuoteTableRowHeight(row, headerRowPx);
        });
      }
    }

    const firstDataRows = firstTable.querySelectorAll<HTMLTableRowElement>("tbody tr.quote-data-row");
    if (firstDataRows.length === 0) return;

    firstDataRows.forEach((firstRow, index) => {
      const rowPx = Math.ceil(firstRow.getBoundingClientRect().height);
      if (rowPx <= 0) return;
      allTables.forEach((table) => {
        const row = table.querySelectorAll<HTMLTableRowElement>("tbody tr.quote-data-row")[index];
        if (row) applyQuoteTableRowHeight(row, rowPx);
      });
    });

    const firstFooterRows = firstTable.querySelectorAll<HTMLTableRowElement>("tfoot tr.quote-footer-row");
    firstFooterRows.forEach((firstFooterRow, index) => {
      const footerPx = Math.ceil(firstFooterRow.getBoundingClientRect().height);
      if (footerPx <= 0) return;
      allTables.forEach((table) => {
        const row = table.querySelectorAll<HTMLTableRowElement>("tfoot tr.quote-footer-row")[index];
        if (row) applyQuoteTableRowHeight(row, footerPx);
      });
    });

    const syncFooterBlockHeights = (selector: string) => {
      const blocks = root.querySelectorAll<HTMLElement>(selector);
      if (blocks.length === 0) return;
      let maxPx = 0;
      blocks.forEach((el) => {
        maxPx = Math.max(maxPx, Math.ceil(el.getBoundingClientRect().height));
      });
      if (maxPx <= 0) return;
      const h = `${maxPx}px`;
      blocks.forEach((el) => {
        el.style.height = h;
        el.style.minHeight = h;
      });
    };
    syncFooterBlockHeights(".quote-card-currency-note");
    syncFooterBlockHeights(".quote-card-metadata-footer");
  }, [applyQuoteTableRowHeight, clearQuoteRowHeightSync]);

  useLayoutEffect(() => {
    if (loading || !requisition?.items?.length || comparisonTab !== "item-comparison") return;

    let rafId = 0;
    const scheduleRun = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => syncQuoteTableRowHeights());
    };

    const run = () => syncQuoteTableRowHeights();
    run();
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(run);
    });

    const el = quoteCardsRowRef.current;
    let ro: ResizeObserver | undefined;
    const rowObservers: ResizeObserver[] = [];
    if (el && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => scheduleRun());
      ro.observe(el);
      const firstTable =
        el.querySelector<HTMLTableElement>("table.quote-req-details-table.quote-sync-table") ??
        el.querySelector<HTMLTableElement>("table.quote-sync-table");
      firstTable?.querySelectorAll<HTMLTableRowElement>(
        "thead tr.quote-header-row, tbody tr.quote-data-row, tfoot tr.quote-footer-row"
      ).forEach((tr) => {
        const rowRo = new ResizeObserver(() => scheduleRun());
        rowRo.observe(tr);
        rowObservers.push(rowRo);
      });
      const firstCardHeader = el.querySelector<HTMLElement>(".quote-card-header");
      if (firstCardHeader) {
        const headerRo = new ResizeObserver(() => scheduleRun());
        headerRo.observe(firstCardHeader);
        rowObservers.push(headerRo);
      }
    }
    window.addEventListener("resize", scheduleRun);

    if (typeof document !== "undefined" && document.fonts?.ready) {
      void document.fonts.ready.then(() => scheduleRun());
    }

    const t = window.setTimeout(() => scheduleRun(), 150);
    const t2 = window.setTimeout(() => scheduleRun(), 400);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      cancelAnimationFrame(rafId);
      ro?.disconnect();
      rowObservers.forEach((o) => o.disconnect());
      window.removeEventListener("resize", scheduleRun);
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [
    loading,
    comparisonTab,
    requisition?.id,
    requisition?.items?.length,
    quotes.length,
    rankedQuotes.length,
    itemsPage,
    paginatedRequisitionItems.length,
    displayCurrency,
    syncQuoteTableRowHeights,
  ]);

  // Handle quote approval (for access levels 37, 39)
  const primaryQuoteId = selectedQuoteIds.length === 1 ? selectedQuoteIds[0] : null;

  const handleApproveQuote = async () => {
    if (!primaryQuoteId) {
      toast.error('Please select a vendor quote to approve');
      return;
    }

    try {
      setApprovingQuote(true);
      console.log(`🔵 [FRONTEND] Approving quote: ${primaryQuoteId}`);

      const response = await fetch(`/api/quotes/${primaryQuoteId}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes: undefined,
          confirmedQuantities: (requisition?.items ?? []).map((item) => ({
            requisitionItemId: item.id,
            quantity: getUpdatedQuantity(item.id, item.quantity),
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || data.message || 'Failed to approve quote';
        console.error('❌ [FRONTEND] Quote approval failed:', errorMessage);
        toast.error(errorMessage, { duration: 5000 });
        throw new Error(errorMessage);
      }

      console.log('✅ [FRONTEND] Quote approved successfully:', data);
      toast.success(data.message || 'Quote approved successfully');
      
      // Refresh the data
      await fetchData();
    } catch (err) {
      console.error('❌ [FRONTEND] Error approving quote:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve quote';
      toast.error(errorMessage, { duration: 5000 });
    } finally {
      setApprovingQuote(false);
    }
  };

  // Split quote between vendors: approve allocations only (POs issued separately by purchaser 32/33)
  const handleSplitAndApprove = async () => {
    if (!requisition?.items?.length || !rankedQuotes.length) return;

    if (selectedQuoteIds.length >= 2) {
      const vendorsWithNoItems = selectedQuoteIds.filter(
        (qid) => !requisition.items.some((it) => selectedVendorPerItem[it.id] === qid)
      );
      if (vendorsWithNoItems.length > 0) {
        const names = vendorsWithNoItems
          .map((qid) => rankedQuotes.find((q) => q.quoteId === qid)?.vendor.name ?? qid)
          .filter(Boolean);
        setSplitVendorValidationNames(names);
        setSplitVendorValidationOpen(true);
        return;
      }
    }

    const quoteIdsUsed = new Set<string>();
    requisition.items.forEach((it) => {
      const qId = selectedVendorPerItem[it.id];
      if (qId) quoteIdsUsed.add(qId);
    });
    if (quoteIdsUsed.size < 2) {
      toast.error("Select items from at least two different vendors to split the quote.");
      return;
    }
    const allocations: { vendorId: string; quoteId: string; requisitionItemIds: string[] }[] = [];
    const quoteIdToQuote = new Map(rankedQuotes.map((q) => [q.quoteId, q]));
    quoteIdsUsed.forEach((quoteId) => {
      const quote = quoteIdToQuote.get(quoteId);
      if (!quote) return;
      const requisitionItemIds = requisition.items.filter((it) => selectedVendorPerItem[it.id] === quoteId).map((it) => it.id);
      if (requisitionItemIds.length > 0) {
        allocations.push({
          vendorId: quote.vendor.id,
          quoteId: quote.quoteId,
          requisitionItemIds,
        });
      }
    });
    if (allocations.length < 2) {
      toast.error("At least two vendors must have at least one item selected.");
      return;
    }
    try {
      setSplittingQuote(true);
      const response = await fetch(`/api/requisitions/${requisitionId}/split-and-approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocations,
          confirmedQuantities: (requisition?.items ?? []).map((item) => ({
            requisitionItemId: item.id,
            quantity: getUpdatedQuantity(item.id, item.quantity),
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to split and approve");
      }
      toast.success(data.message || "Requisition split and quotes approved. Purchasers will issue POs separately.");
      await fetchData();
    } catch (err: any) {
      console.error("Split and approve error:", err);
      toast.error(err.message || "Failed to split and approve quotes.", { duration: 6000 });
    } finally {
      setSplittingQuote(false);
    }
  };

  const getUpdatedQuantity = (itemId: string, originalQty: number): number => {
    return updatedQuantities[itemId] ?? originalQty;
  };

  const vendorTotalRows = useMemo(() => {
    if (!requisition?.items?.length) return [];
    return dashboardRankedQuotes.map((q) => {
      const itemsForTotal = isComparisonLocked
        ? requisition.items.filter((it) => itemIncludedInVendorTotal(it.id, q.quoteId))
        : requisition.items;
      return {
      quoteId: q.quoteId,
      rank: q.rank,
      status: q.status,
      currency: q.currency,
      quoteToUsdRate: q.quoteToUsdRate,
      vendorName: q.vendor.name,
      totals: computeVendorTotalsSummary(q, itemsForTotal, getUpdatedQuantity, getQuoteItemForRequisitionItem),
    };
    });
  }, [dashboardRankedQuotes, requisition?.items, updatedQuantities, isComparisonLocked, itemIncludedInVendorTotal]);

  // Update quantity for an item (applies to all vendors)
  const handleQuantityChange = (itemId: string, newQty: number) => {
    setUpdatedQuantities(prev => ({
      ...prev,
      [itemId]: newQty > 0 ? newQty : 0
    }));
  };

  // Show network error handler if there's a chunk or network error
  // Access level 25 or less cannot access quote comparison
  if (userAccessLevel != null && userAccessLevel <= 25) {
    return null;
  }

  if (!initialFetchDone && loading) {
    return (
      <div className="flex min-h-[min(70vh,560px)] w-full flex-col items-center justify-center py-16">
        <ActiniumLoader size="lg" text="Loading quote comparison…" />
      </div>

    );
  }

  if (chunkError || (error && (
    error.includes('timeout') ||
    error.includes('network') ||
    error.includes('fetch') ||
    error.includes('Failed to load') ||
    error.includes('chunk')
  ))) {
    return (
      <NetworkErrorHandler
        error={chunkError || error}
        onRetry={fetchData}
        autoRetry={true}
        maxRetries={3}
        retryDelay={2000}
      />
    );
  }
  return (<PageReadyGate ready={ready}>
    {splittingQuote && (
      <ActiniumLoader overlay text="Approving split quotes…" showText={true} />
    )}
    <NetworkErrorHandler
      error={error}
      onRetry={fetchData}
      autoRetry={false}
    >
      <div className="space-y-4 w-full">
      <main className="py-3">
        <div className="mb-3 rounded-md border border-border bg-card p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="mb-2 h-7 -ml-1 px-2 text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Back
              </Button>
              <h1 className="text-xl font-bold text-foreground leading-tight">
                Bid Comparison — {requisition?.heading || "Quote Comparison"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {requisition?.requisitionNumber && (
                  <Badge variant="outline" className="h-6 px-2 text-[11px]">
                    Req {requisition.requisitionNumber}
                  </Badge>
                )}
                {requisition?.vessel && (
                  <Badge variant="outline" className="h-6 gap-1 px-2 text-[11px]">
                    <Wrench className="h-3 w-3" />
                    {requisition.vessel.name}
                  </Badge>
                )}
                <Badge variant="outline" className="h-6 px-2 text-[11px]">
                  {quotes.length} quotes
                </Badge>
                {lastQuoteProcessTime && <span>Last processed {lastQuoteProcessTime}</span>}
              </div>
            </div>
            {isComparisonLocked && (
              <div className="flex min-w-[14rem] max-w-xl flex-1 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-950">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  Quote comparison is read-only. Quotes have been approved; vendor totals show selected line items only.
                </span>
              </div>
            )}
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <Button variant="outline" asChild size="sm" className="h-8 px-3 text-xs">
                <Link href={`/purchase/requisitions/${requisitionId}/view`}>
                  View req
                </Link>
              </Button>
              <Button variant="outline" asChild size="sm" className="h-8 px-3 text-xs">
                <Link href={`/purchase/clarifications?requisitionId=${requisitionId}`}>
                  <MessageSquare className="h-3.5 w-3.5 mr-1" />
                  Clarifications
                  {openClarificationCount > 0 && (
                    <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-[10px]">
                      {openClarificationCount}
                    </Badge>
                  )}
                </Link>
              </Button>
              {canManageFreight(userAccessLevel) && (
                <Button variant="outline" asChild size="sm" className="h-8 px-3 text-xs">
                  <Link href={`/purchase/freight/${requisitionId}`}>Freight</Link>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/quotes/${requisitionId}/export-excel`, {
                      credentials: 'include',
                    });
                    
                    if (!response.ok) {
                      throw new Error('Failed to export to Excel');
                    }
                    
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || `Price_Comparison_${requisition?.requisitionNumber}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    toast.success('Excel file exported successfully');
                  } catch (error: any) {
                    console.error('Error exporting to Excel:', error);
                    toast.error(error.message || 'Failed to export to Excel');
                  }
                }}
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Export
              </Button>
              {(() => {
                const selectedQuote = quotes.find(q => q.quoteId === primaryQuoteId);
                const quoteStatus = selectedQuote?.status || 'RECEIVED';
                const canApprove = userAccessLevel !== null && (userAccessLevel === 37 || userAccessLevel === 39 || (userAccessLevel !== null && [50, 99, 100].includes(userAccessLevel)));
                
                if (!canApprove) return null;

                const approveDisabled =
                  isComparisonLocked ||
                  approvingQuote ||
                  !primaryQuoteId ||
                  hasApprovedQuote ||
                  quoteStatus !== 'RECEIVED' ||
                  selectedQuoteIds.length !== 1;

                return (
                  <Button
                    onClick={handleApproveQuote}
                    disabled={approveDisabled}
                    className="h-8 items-center gap-2 bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    title={
                      isComparisonLocked || hasApprovedQuote
                        ? 'Quotes have already been approved for this requisition.'
                        : selectedQuoteIds.length !== 1
                          ? 'Select a single vendor quote to approve.'
                          : ''
                    }
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {approvingQuote ? 'Approving...' : 'Approve Selected Quote'}
                  </Button>
                );
              })()}
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Card-based layout: Requisition details on one card, each vendor quote on a separate card with aligned row heights */}
        {!loading && quotes.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {importPendingCount > 0
                  ? "Quote responses need import"
                  : "No Quotes Available"}
              </h3>
              <p className="text-foreground mb-4 max-w-xl mx-auto">
                {importPendingCount > 0
                  ? `${importPendingCount} vendor response(s) are marked received but have no priced line items yet (Excel import may have failed). Run Process Quote Responses from Gmail Management, or ask an admin to retry import.`
                  : "No quotes have been received for this requisition yet."}
              </p>
              {importPendingCount > 0 ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="outline" onClick={() => router.push("/admin/gmail-test")}>
                    Gmail Management
                  </Button>
                  <Button onClick={() => void fetchData()}>Retry load</Button>
                </div>
              ) : (
                <Button onClick={() => router.push(`/purchase/send-quote-request/${requisitionId}`)}>
                  Send Quote Request
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {(quotes.length > 0 || dashboardRankedQuotes.length > 0) && (
              <CollapsibleCard
                key={requisitionId}
                defaultOpen={false}
                title="Quote summary & vendor ranking"
                description={
                  comparisonKpis ? (
                    <span className="text-[11px] text-muted-foreground">
                      Lowest{" "}
                      <span className="font-medium text-foreground">
                        {formatCurrency(comparisonKpis.lowestBid, comparisonKpis.lowestCurrency, false)}
                      </span>
                      {" · "}
                      {comparisonKpis.lowestVendorName}
                      {dashboardRankedQuotes.length > 0 && (
                        <>
                          {" · "}
                          {dashboardRankedQuotes.length} vendor
                          {dashboardRankedQuotes.length === 1 ? "" : "s"}
                        </>
                      )}
                      {comparisonKpis.itemStats.total > 0 && (
                        <>
                          {" · "}
                          {comparisonKpis.itemStats.quoted}/{comparisonKpis.itemStats.total} lines quoted
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      {dashboardRankedQuotes.length} vendor
                      {dashboardRankedQuotes.length === 1 ? "" : "s"} — expand for KPIs and ranking
                    </span>
                  )
                }
                className="shadow-sm [&_[data-slot=card-header]]:px-4 [&_[data-slot=card-header]]:py-2 [&_[data-slot=card-title]]:text-sm [&>div.relative]:!gap-0 [&>div.relative]:!py-0"
                contentClassName="space-y-2 px-4 pb-3 pt-0"
              >
                {quotes.length > 0 && (
                  <div className="flex items-stretch gap-2 overflow-x-auto pb-0.5">
                    <div className="flex shrink-0 items-center gap-2 self-stretch rounded-md border border-border bg-muted/30 px-2 py-1 text-xs">
                      <DollarSign className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                          Display
                        </Label>
                        <select
                          value={displayCurrency}
                          onChange={(e) => setDisplayCurrency(e.target.value)}
                          className="h-7 max-w-[7.5rem] rounded-md border border-input bg-background px-1.5 text-[11px]"
                        >
                          <option value="ORIGINAL">Original</option>
                          <option value={BASE_CURRENCY}>USD</option>
                          {availableCurrencies.filter((c) => c !== BASE_CURRENCY).map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                          {vesselLocalCurrency &&
                            !availableCurrencies.includes(vesselLocalCurrency) &&
                            vesselLocalCurrency !== BASE_CURRENCY && (
                              <option value={vesselLocalCurrency}>{vesselLocalCurrency}</option>
                            )}
                        </select>
                      </div>
                      <div className="flex items-center gap-1.5 border-l border-border/60 pl-2">
                        <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                          Rates
                        </Label>
                        <select
                          value={rateSource}
                          onChange={(e) => setRateSource(e.target.value as RateSource)}
                          className="h-7 max-w-[8.5rem] rounded-md border border-input bg-background px-1.5 text-[11px]"
                        >
                          <option value="frozen">🔒 Frozen</option>
                          <option value="monthly">📅 Monthly</option>
                          <option value="live">🌐 Live</option>
                        </select>
                      </div>
                      {vesselLocalCurrency && (
                        <Badge variant="outline" className="hidden h-6 gap-1 px-1.5 text-[10px] sm:inline-flex">
                          <MapPin className="h-2.5 w-2.5" />
                          {vesselLocalCurrency}
                        </Badge>
                      )}
                    </div>
                    {comparisonKpis && (
                      <ComparisonKpiCards
                        kpis={comparisonKpis}
                        formatAmount={(amount, currency) => formatCurrency(amount, currency, false)}
                      />
                    )}
                  </div>
                )}
                {dashboardRankedQuotes.length > 0 && (
                  <VendorRankingTable
                    quotes={dashboardRankedQuotes}
                    page={rankSummaryPage}
                    pageSize={RANK_SUMMARY_PAGE_SIZE}
                    onPageChange={setRankSummaryPage}
                    formatTotal={(quote) =>
                      displayCurrency !== "ORIGINAL" && displayCurrency !== quote.currency
                        ? formatInDisplayCurrency(quote.displayGrandTotal, quote.currency, quote.quoteToUsdRate)
                        : formatCurrency(quote.displayGrandTotal, quote.currency, true, quote.quoteToUsdRate)
                    }
                    allItemsAssignedToVendor={allItemsAssignedToVendor}
                    onVendorSelectCheckbox={handleVendorSelectCheckbox}
                  />
                )}
              </CollapsibleCard>
            )}

            <Tabs value={comparisonTab} onValueChange={setComparisonTab} className="gap-2">
              <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/50 p-1.5 shadow-sm">
                <TabsList className="h-auto min-h-10 flex-1 flex-wrap justify-start gap-1.5 border-0 bg-transparent p-0 shadow-none">
                <TabsTrigger value="overview" className={COMPARISON_TAB_TRIGGER_CLASS}>
                  Overview
                </TabsTrigger>
                <TabsTrigger value="item-comparison" className={COMPARISON_TAB_TRIGGER_CLASS}>
                  Item Comparison ({requisition?.items?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="commercial" className={COMPARISON_TAB_TRIGGER_CLASS}>
                  Commercial
                </TabsTrigger>
                <TabsTrigger value="delivery" className={COMPARISON_TAB_TRIGGER_CLASS}>
                  Delivery
                </TabsTrigger>
                <TabsTrigger value="attachments" className={COMPARISON_TAB_TRIGGER_CLASS}>
                  Attachments ({dashboardRankedQuotes.filter((q) => q.fileUrl || q.fileAttachmentId || q.deliveryChargesAttachment || (q.referenceDocuments && q.referenceDocuments.length > 0)).length})
                </TabsTrigger>
                </TabsList>
                {requisition && (
                  <ComparisonBudgetBar
                    budgetCode={requisition.budgetCode}
                    isBudgeted={requisition.isBudgeted}
                    onBudgetedChange={(next) => void persistBudgetSelection(next)}
                    disabled={isComparisonLocked}
                  />
                )}
              </div>

              <TabsContent value="overview" className="mt-2">
                {comparisonKpis && (
                  <ComparisonOverviewTab
                    kpis={comparisonKpis}
                    topQuote={dashboardRankedQuotes[0]}
                    vendorTotalRows={vendorTotalRows}
                    requisitionNumber={requisition?.requisitionNumber}
                    formatAmount={(amount, currency, quoteToUsdRate) =>
                      formatCurrency(amount, currency, true, quoteToUsdRate)
                    }
                    formatDisplayTotal={(amount, currency, quoteToUsdRate) =>
                      displayCurrency !== "ORIGINAL" && displayCurrency !== currency
                        ? formatInDisplayCurrency(amount, currency, quoteToUsdRate)
                        : formatCurrency(amount, currency, true, quoteToUsdRate)
                    }
                  />
                )}
              </TabsContent>

              <TabsContent value="item-comparison" className="mt-2 space-y-2">
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">Line-by-line comparison</p>
                  <p className="text-[11px] text-muted-foreground">Use Supply to assign lines. Lowest line prices remain highlighted in green.</p>
                </div>
                <Badge variant="outline" className="h-6 px-2 text-[11px]">
                  {rankedQuotes.length} vendors
                </Badge>
              </div>
            </div>
            {/* Card layout: Requisition card fixed on left; vendor cards in horizontal scroll container. When >15 items, whole row scrolls together. */}
            {requisition && requisition.items.length > 0 && (() => {
              const itemCount = requisition.items.length;
              const useUnifiedScroll = itemCount > 15;
              // Height for ~15 rows: card header 116 + table header 32 + 15 data rows (36 each) + 5 footer rows (32 each) + buffer
              const unifiedScrollMaxHeight = 116 + 28 + 15 * 56 + 5 * 28 + 120;

              const metadataSlots = {
                terms: rankedQuotes.some((q) => Boolean(q.termsAndConditions)),
                quotationReference: rankedQuotes.some(
                  (q) => q.quotationReference != null && q.quotationReference !== ""
                ),
                referenceDocuments: rankedQuotes.some(
                  (q) => q.referenceDocuments && q.referenceDocuments.length > 0
                ),
                leadTime: rankedQuotes.some((q) => q.leadTime != null && q.leadTime !== ""),
                validityPeriod: rankedQuotes.some(
                  (q) => q.validityPeriod != null && q.validityPeriod !== ""
                ),
                deliveryPort: rankedQuotes.some((q) => q.deliveryPort != null && q.deliveryPort !== ""),
                exWorkLocation: rankedQuotes.some(
                  (q) =>
                    q.exWorkLocation != null &&
                    q.exWorkLocation !== "" &&
                    q.exWorkLocation !== q.deliveryPort
                ),
              };
              const showMetadataFooter = Object.values(metadataSlots).some(Boolean);
              const metadataHasDetailSlots =
                metadataSlots.quotationReference ||
                metadataSlots.referenceDocuments ||
                metadataSlots.leadTime ||
                metadataSlots.validityPeriod ||
                metadataSlots.deliveryPort ||
                metadataSlots.exWorkLocation;
              const showCurrencyUsdNote = rankedQuotes.some(
                (q) =>
                  q.currency !== BASE_CURRENCY &&
                  (displayCurrency === "ORIGINAL" || displayCurrency === BASE_CURRENCY)
              );
              const showCurrencyDisplayNote = rankedQuotes.some(
                (q) =>
                  displayCurrency !== "ORIGINAL" &&
                  displayCurrency !== q.currency &&
                  displayCurrency !== BASE_CURRENCY
              );

              const renderQuoteMetadataFooter = (quote?: (typeof rankedQuotes)[number]) => {
                if (!showMetadataFooter) return null;
                return (
                  <div className="quote-card-metadata-footer shrink-0 border-t bg-muted/90 px-4 py-3 text-xs">
                    {metadataSlots.terms && (
                      <>
                        {quote?.termsAndConditions ? (
                          <p className="font-semibold text-foreground break-words whitespace-pre-wrap">
                            {quote.termsAndConditions}
                          </p>
                        ) : (
                          <div className="min-h-[1.25rem]" aria-hidden="true">
                            &nbsp;
                          </div>
                        )}
                        {metadataHasDetailSlots && <hr className="my-2 border-border" />}
                      </>
                    )}
                    {metadataHasDetailSlots && (
                      <div className="space-y-1 text-foreground">
                        {metadataSlots.quotationReference && (
                          <p className="min-h-[1.25rem] leading-5">
                            {quote?.quotationReference ? (
                              <>
                                <span className="font-semibold">Quotation Reference Number</span> -{" "}
                                {quote.quotationReference}
                              </>
                            ) : (
                              <span className="invisible select-none" aria-hidden="true">
                                Quotation Reference Number
                              </span>
                            )}
                          </p>
                        )}
                        {metadataSlots.referenceDocuments && (
                          <div className="flex min-h-[1.25rem] flex-wrap items-center gap-1">
                            {quote?.referenceDocuments && quote.referenceDocuments.length > 0 ? (
                              <>
                                <span className="text-foreground font-medium text-[10px]">
                                  View Reference Document
                                </span>
                                {quote.referenceDocuments.map((ref) => (
                                  <button
                                    key={ref.id}
                                    type="button"
                                    title={ref.filename}
                                    onClick={async () => {
                                      try {
                                        const res = await fetch(`/api/emails/attachments/${ref.id}/view`, {
                                          credentials: "include",
                                        });
                                        const data = await res.json();
                                        if (res.ok && data.signedUrl) {
                                          window.open(data.signedUrl, "_blank", "noopener,noreferrer");
                                        } else {
                                          toast.error(data.error || "File could not be loaded");
                                        }
                                      } catch {
                                        toast.error("File could not be loaded");
                                      }
                                    }}
                                    className="inline-flex rounded p-1 text-foreground hover:bg-muted"
                                  >
                                    <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                                  </button>
                                ))}
                              </>
                            ) : (
                              <span className="invisible select-none" aria-hidden="true">
                                View Reference Document
                              </span>
                            )}
                          </div>
                        )}
                        {metadataSlots.leadTime && (
                          <p className="min-h-[1.25rem] leading-5">
                            {quote?.leadTime ? (
                              <>
                                <span className="font-semibold">Delivery Lead Time</span> - {quote.leadTime}
                              </>
                            ) : (
                              <span className="invisible select-none" aria-hidden="true">
                                Delivery Lead Time
                              </span>
                            )}
                          </p>
                        )}
                        {metadataSlots.validityPeriod && (
                          <p className="min-h-[1.25rem] leading-5">
                            {quote?.validityPeriod ? (
                              <>
                                <span className="font-semibold">Validity Period</span> - {quote.validityPeriod}
                              </>
                            ) : (
                              <span className="invisible select-none" aria-hidden="true">
                                Validity Period
                              </span>
                            )}
                          </p>
                        )}
                        {metadataSlots.deliveryPort && (
                          <p className="min-h-[1.25rem] leading-5">
                            {quote?.deliveryPort ? (
                              <>
                                <span className="font-semibold">Delivery Port / Ex-Work</span> -{" "}
                                {quote.deliveryPort}
                              </>
                            ) : (
                              <span className="invisible select-none" aria-hidden="true">
                                Delivery Port / Ex-Work
                              </span>
                            )}
                          </p>
                        )}
                        {metadataSlots.exWorkLocation && (
                          <p className="min-h-[1.25rem] leading-5">
                            {quote?.exWorkLocation &&
                            quote.exWorkLocation !== "" &&
                            quote.exWorkLocation !== quote.deliveryPort ? (
                              <>
                                <span className="font-semibold">Ex-Work Location</span> -{" "}
                                {quote.exWorkLocation}
                              </>
                            ) : (
                              <span className="invisible select-none" aria-hidden="true">
                                Ex-Work Location
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              };

              const cardsRow = (
              <div
                ref={quoteCardsRowRef}
                className="flex flex-row gap-2 items-stretch min-w-0 w-full quote-cards-row-heights"
                style={
                  {
                    "--quote-card-header-height": "116px",
                    "--quote-header-row-height": "28px",
                    "--quote-data-row-height": "48px",
                    "--quote-footer-row-height": "32px",
                  } as React.CSSProperties
                }
              >
                {/* Row heights driven by Requisition card: same heights applied to all cards so rows align */}
                <style>{`
                  .quote-cards-row-heights table.quote-req-details-table {
                    table-layout: fixed;
                  }
                  .quote-cards-row-heights table.quote-vendor-table {
                    table-layout: auto;
                    width: max-content;
                    min-width: 100%;
                  }
                  .quote-cards-row-heights table.quote-vendor-table .quote-vendor-money-cell,
                  .quote-cards-row-heights table.quote-vendor-table .quote-vendor-money-head {
                    white-space: nowrap !important;
                    overflow: visible !important;
                    text-overflow: clip;
                    font-variant-numeric: tabular-nums;
                  }
                  .quote-cards-row-heights table.quote-vendor-table .quote-footer-row td.quote-vendor-money-cell {
                    overflow: visible !important;
                    white-space: nowrap !important;
                  }
                  .quote-cards-row-heights table.quote-vendor-table .quote-vendor-remarks-col {
                    min-width: 3.5rem;
                    max-width: 8rem;
                    white-space: normal !important;
                    word-break: break-word;
                  }
                  .quote-cards-row-heights table.quote-vendor-table .quote-vendor-supply-col {
                    width: 3.5rem;
                    min-width: 3.5rem;
                  }
                  .quote-cards-row-heights .quote-header-row {
                    height: var(--quote-header-row-height) !important;
                  }
                  .quote-cards-row-heights .quote-header-row th {
                    height: var(--quote-header-row-height) !important;
                    min-height: var(--quote-header-row-height) !important;
                    max-height: var(--quote-header-row-height) !important;
                    padding: 2px 4px !important;
                    box-sizing: border-box;
                    vertical-align: middle !important;
                    overflow: hidden;
                    line-height: 1.15;
                  }
                  .quote-cards-row-heights .quote-data-row td {
                    min-height: var(--quote-data-row-height);
                    padding: 2px 4px !important;
                    box-sizing: border-box;
                    vertical-align: middle !important;
                    overflow: hidden;
                    line-height: 1.25;
                    white-space: normal;
                  }
                  .quote-cards-row-heights tr.quote-row-height-synced,
                  .quote-cards-row-heights tr.quote-row-height-synced td,
                  .quote-cards-row-heights tr.quote-row-height-synced th {
                    box-sizing: border-box !important;
                    overflow: hidden !important;
                  }
                  .quote-cards-row-heights tr.quote-row-height-synced td.quote-item-cell,
                  .quote-cards-row-heights tr.quote-row-height-synced td.quote-remarks-cell {
                    vertical-align: top !important;
                    overflow-y: auto !important;
                    overflow-x: hidden !important;
                  }
                  .quote-cards-row-heights tr.quote-row-height-synced td.quote-vendor-money-cell,
                  .quote-cards-row-heights tr.quote-row-height-synced th.quote-vendor-money-head {
                    overflow: visible !important;
                    white-space: nowrap !important;
                  }
                  .quote-cards-row-heights .quote-data-row td.quote-item-cell {
                    white-space: normal !important;
                    word-break: break-word;
                    overflow-wrap: anywhere;
                    vertical-align: top !important;
                  }
                  .quote-cards-row-heights .quote-data-row td.quote-radio-cell {
                    vertical-align: middle !important;
                  }
                  .quote-cards-row-heights .quote-data-row td.quote-comments-cell {
                    vertical-align: middle !important;
                  }
                  .quote-cards-row-heights .quote-data-row td.quote-remarks-cell {
                    vertical-align: top !important;
                    overflow-y: auto !important;
                    overflow-x: hidden;
                    white-space: normal !important;
                    word-break: break-word;
                    padding: 2px 4px !important;
                    line-height: 1.25;
                  }
                  .quote-cards-row-heights .quote-footer-row {
                    height: var(--quote-footer-row-height) !important;
                  }
                  .quote-cards-row-heights .quote-footer-row td,
                  .quote-cards-row-heights .quote-footer-row th {
                    min-height: var(--quote-footer-row-height);
                    height: var(--quote-footer-row-height) !important;
                    max-height: var(--quote-footer-row-height) !important;
                    padding: 2px 4px !important;
                    box-sizing: border-box;
                    vertical-align: middle !important;
                    overflow: hidden;
                    line-height: 1.2;
                  }
                  .quote-cards-row-heights table.quote-req-details-table .quote-header-row th,
                  .quote-cards-row-heights table.quote-req-details-table .quote-data-row td,
                  .quote-cards-row-heights table.quote-req-details-table .quote-footer-row td {
                    padding-top: 2px !important;
                    padding-bottom: 2px !important;
                    padding-left: 1px !important;
                    padding-right: 1px !important;
                  }
                  .quote-cards-row-heights .quote-card-header {
                    min-height: var(--quote-card-header-height);
                    box-sizing: border-box;
                  }
                  .quote-cards-row-heights .quote-card-header-synced {
                    overflow: hidden;
                  }
                  .quote-cards-row-heights .quote-comparison-card {
                    display: flex;
                    flex-direction: column;
                    align-self: stretch;
                    height: 100%;
                    box-sizing: border-box;
                  }
                  .quote-cards-row-heights .quote-card-body {
                    display: flex;
                    flex: 1 1 auto;
                    flex-direction: column;
                    min-height: 0;
                  }
                  .quote-cards-row-heights .quote-card-fill-spacer {
                    flex: 1 1 auto;
                    min-height: 0;
                  }
                  .quote-table-body { font-size: 12px; }
                  .quote-table-body-vendor { font-size: 11px; }
                  table.quote-req-details-table col.quote-req-sno-col { width: 1.4rem; }
                  table.quote-req-details-table col.quote-req-name-col { width: auto; min-width: 6rem; }
                  table.quote-req-details-table col.quote-req-code-col { width: 4.25rem; }
                  table.quote-req-details-table col.quote-req-qty-col { width: 4.5rem; }
                  table.quote-req-details-table col.quote-req-updated-qty-col { width: calc(4.75rem + 10px); }
                  table.quote-req-details-table .quote-req-sno-cell {
                    width: 1.4rem;
                    max-width: 1.4rem;
                    padding-left: 0 !important;
                    padding-right: 0 !important;
                  }
                  table.quote-req-details-table .quote-req-name-cell {
                    width: auto;
                    min-width: 0;
                  }
                  table.quote-req-details-table .quote-req-code-cell {
                    width: 4.25rem;
                    max-width: 4.25rem;
                  }
                  table.quote-req-details-table .quote-req-updated-qty-cell {
                    width: calc(4.75rem + 10px);
                    max-width: calc(4.75rem + 10px);
                  }
                `}</style>

                {/* Requisition Details Card - grows on wide screens up to 800px to fill 98% width */}
                <Card className="quote-comparison-card flex h-full flex-col self-stretch flex-[0_0_40%] w-[40%] max-w-[40%] shrink-0 gap-0 overflow-hidden rounded-md border-2 border-border p-0 shadow-sm">
                  <div
                    className="quote-card-header bg-primary px-4 py-3 text-primary-foreground"
                    style={{
                      minHeight: "var(--quote-card-header-height)",
                    }}
                  >
                    <div className="text-sm font-bold uppercase tracking-wide">Requisition Details</div>
                    <div className="mt-1 text-xs text-primary-foreground/95">
                      {requisition.requisitionNumber}
                      {requisition.vessel && ` • ${requisition.vessel.name}`}
                    </div>
                  </div>
                  <TooltipProvider delayDuration={200}>
                  <div className="quote-card-body">
                  <div className="overflow-x-auto">
                    <QuoteComparisonRequisitionTable
                      requisitionId={requisitionId}
                      requisitionType={requisition?.requisitionType ?? "STR"}
                      items={paginatedRequisitionItems}
                      itemsPage={itemsPage}
                      itemsPageSize={itemsPageSize}
                      isComparisonLocked={isComparisonLocked}
                      getUpdatedQuantity={getUpdatedQuantity}
                      handleQuantityChange={handleQuantityChange}
                    />
                  </div>
                  {showCurrencyUsdNote && (
                    <p
                      className="quote-card-currency-note border-t border-border/60 px-2 py-1 text-[9px] text-transparent"
                      aria-hidden="true"
                    >
                      &nbsp;
                    </p>
                  )}
                  {showCurrencyDisplayNote && (
                    <p
                      className="quote-card-currency-note border-t border-border/60 px-2 py-1 text-[9px] text-transparent"
                      aria-hidden="true"
                    >
                      &nbsp;
                    </p>
                  )}
                  {renderQuoteMetadataFooter()}
                  <div className="quote-card-fill-spacer" aria-hidden="true" />
                  </div>
                  </TooltipProvider>
                </Card>

                {/* Vendor quote cards: flex to fill remaining width on large screens, scroll when many vendors */}
                <div className="flex h-full min-h-0 flex-1 flex-row gap-2 overflow-x-auto pb-4 flex-nowrap items-stretch">
                {rankedQuotes.map((quote, quoteIndex) => {
                  const isApproved = quote.status === "APPROVED";
                  const colorIndex = quoteIndex % VENDOR_QUOTE_CARD_THEMES.length;
                  const vc = isApproved ? APPROVED_VENDOR_QUOTE_THEME : VENDOR_QUOTE_CARD_THEMES[colorIndex];

                  let subTotalForVendor = 0;
                  let totalDiscountForVendor = 0;
                  if (requisition) {
                    requisition.items.forEach((item) => {
                      if (!itemIncludedInVendorTotal(item.id, quote.quoteId)) return;
                      const quoteItem = getQuoteItemForRequisitionItem(quote, item);
                      if (quoteItem && quoteItem.unitPrice) {
                        const uq = getUpdatedQuantity(item.id, item.quantity);
                        subTotalForVendor += uq * quoteItem.unitPrice;
                      }
                      if (quoteItem) {
                        const uq = getUpdatedQuantity(item.id, item.quantity);
                        const disc = calculateDiscount(quoteItem.totalPrice, quoteItem.quantity, quoteItem.unitPrice);
                        if (disc > 0 && quoteItem.unitPrice) {
                          const orig = uq * quoteItem.unitPrice;
                          const discounted = calculateTotalWithUpdatedQty(uq, quoteItem.unitPrice, disc);
                          if (discounted != null) totalDiscountForVendor += orig - discounted;
                        }
                      }
                    });
                  }
                  const addCh = quote.additionalCharges || 0;
                  const delCh = quote.deliveryCharges || 0;
                  const grandTotal = subTotalForVendor - totalDiscountForVendor + addCh + delCh;
                  const isAuthorized = userAccessLevel && [32, 33, 50].includes(userAccessLevel);
                  const toUsdFooter = (amount: number) =>
                    formatCurrencyUtil(
                      convertQuoteAmountToUsd(amount, quote.currency, quote.quoteToUsdRate),
                      BASE_CURRENCY
                    );
                  const toDisplayCurrencyFooter = (amount: number) => {
                    if (displayCurrency === 'ORIGINAL' || displayCurrency === quote.currency) {
                      return formatCurrencyUtil(amount, quote.currency);
                    }
                    const result = convertQuoteAmountToCurrency(amount, quote.currency, displayCurrency, quote.quoteToUsdRate);
                    return formatCurrencyUtil(result.amount, displayCurrency);
                  };
                  const footerFormat = displayCurrency !== 'ORIGINAL' && displayCurrency !== quote.currency ? toDisplayCurrencyFooter : (amount: number) => formatCurrency(amount, quote.currency, false);
                  const footerBaseFormat = displayCurrency !== 'ORIGINAL' && displayCurrency !== BASE_CURRENCY ? toDisplayCurrencyFooter : toUsdFooter;

                  return (
                    <Card key={quote.quoteId} className={`quote-comparison-card flex h-full w-max min-w-[420px] flex-none flex-col self-stretch shrink-0 gap-0 overflow-hidden rounded-md border-2 p-0 shadow-sm ${isApproved ? "ring-2 ring-primary/30" : ""}`} style={{ borderColor: vc.borderColor }}>
                      <div className={`quote-card-header px-4 py-3 ${vc.headerText}`} style={{ minHeight: "var(--quote-card-header-height)", backgroundColor: vc.headerBg }}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <label className={`flex cursor-pointer items-center gap-1.5 text-[11px] font-medium ${vc.headerText}`}>
                            <Checkbox
                              checked={allItemsAssignedToVendor(quote.quoteId)}
                              onCheckedChange={(c) => handleVendorSelectCheckbox(quote.quoteId, c)}
                              disabled={
                                isComparisonLocked ||
                                (isApproved && !allItemsAssignedToVendor(quote.quoteId) && selectedQuoteIds.length > 0) ||
                                allItemsAssignedToVendor(quote.quoteId)
                              }
                              title={
                                allItemsAssignedToVendor(quote.quoteId)
                                  ? "All items assigned to this vendor — use Supply radios on each line to split instead"
                                  : "Assign all items to this vendor (use Supply radios per line to split across vendors)"
                              }
                              className="border-border text-foreground data-[state=checked]:border-primary data-[state=checked]:bg-primary accent-primary"
                            />
                            <span className={vc.headerText}>Assign all</span>
                          </label>
                          {isApproved && <Badge className="border border-primary/30 bg-primary/10 text-[10px] font-semibold text-primary">Selected for PO</Badge>}
                        </div>
                        <div className={`truncate text-center text-[13px] font-bold ${vc.headerText}`} title={quote.vendor.name}>{quote.vendor.name}</div>
                        <div className={`mt-2 flex items-center justify-center gap-2 ${vc.headerText}`}>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${vc.badgeText}`} style={{ backgroundColor: vc.badgeBg }}>Rank {quote.rank}</span>
                          {quote.vendor.rating != null && (
                            <>
                              <Star size={12} className="text-amber-600" fill="currentColor" aria-hidden />
                              <span className={`text-[11px] ${vc.headerText}`}>({quote.vendor.rating.toFixed(1)})</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="quote-card-body">
                      <div className="overflow-x-auto">
                        <table className="quote-vendor-table w-max min-w-full border-collapse text-sm quote-sync-table">
                          <thead>
                            <tr className="quote-header-row" style={{ backgroundColor: vc.tableHeaderBg }}>
                              <th className={`quote-vendor-supply-col text-center border-r text-[9px] font-semibold uppercase ${vc.headerText}`} title="Select this vendor to supply this item">Supply</th>
                              <th className={`quote-vendor-remarks-col text-center border-r text-[9px] font-semibold uppercase ${vc.headerText}`}>Remarks</th>
                              <th className={`quote-vendor-money-head text-center border-r text-[9px] font-semibold uppercase ${vc.headerText}`}>
                                Unit Price {displayCurrency !== 'ORIGINAL' && displayCurrency !== quote.currency ? `(${displayCurrency})` : ''}
                              </th>
                              <th className={`quote-vendor-money-head text-center border-r text-[9px] font-semibold uppercase ${vc.headerText}`}>Discount</th>
                              <th className={`quote-vendor-money-head text-center border-r text-[9px] font-semibold uppercase ${vc.headerText}`}>
                                Total Price {displayCurrency !== 'ORIGINAL' && displayCurrency !== quote.currency ? `(${displayCurrency})` : ''}
                              </th>
                              <th className={`quote-vendor-money-head text-center text-[8px] font-semibold uppercase px-1 ${vc.headerText}`} title="Converted to USD using the frozen rate stored for this quote (company rates from Accounts when set, else market as of quote received date).">
                                {displayCurrency === 'ORIGINAL' ? 'Grand Total (USD)' : `Grand Total (${displayCurrency})`}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="text-foreground">
                            {paginatedRequisitionItems.map((item) => {
                              const quoteItem = getQuoteItemForRequisitionItem(quote, item);
                              const lineIncluded = itemIncludedInVendorTotal(item.id, quote.quoteId);
                              const updatedQty = lineIncluded
                                ? getUpdatedQuantity(item.id, item.quantity)
                                : 0;
                              const discount = quoteItem && lineIncluded
                                ? calculateDiscount(quoteItem.totalPrice, quoteItem.quantity, quoteItem.unitPrice)
                                : 0;
                              const calcTotal =
                                quoteItem && lineIncluded
                                  ? calculateTotalWithUpdatedQty(updatedQty, quoteItem.unitPrice, discount)
                                  : isComparisonLocked
                                    ? 0
                                    : quoteItem
                                      ? calculateTotalWithUpdatedQty(
                                          getUpdatedQuantity(item.id, item.quantity),
                                          quoteItem.unitPrice,
                                          calculateDiscount(
                                            quoteItem.totalPrice,
                                            quoteItem.quantity,
                                            quoteItem.unitPrice
                                          )
                                        )
                                      : null;
                              const isLowest = quoteItem && rankedQuotes.every((q) => {
                                const qi = getQuoteItemForRequisitionItem(q, item);
                                const uq = getUpdatedQuantity(item.id, item.quantity);
                                const d = qi ? calculateDiscount(qi.totalPrice, qi.quantity, qi.unitPrice) : 0;
                                const ct = qi ? calculateTotalWithUpdatedQty(uq, qi.unitPrice, d) : null;
                                return !qi || !calcTotal || Number(calcTotal) <= Number(ct ?? 0);
                              });
                              const isSelectedForItem = selectedVendorPerItem[item.id] === quote.quoteId;
                              const lineTotalNum =
                                calcTotal != null
                                  ? Number(calcTotal)
                                  : updatedQty === 0
                                    ? 0
                                    : quoteItem?.totalPrice != null
                                      ? Number(quoteItem.totalPrice)
                                      : null;
                              const lineTotalUsd =
                                lineTotalNum != null && !Number.isNaN(lineTotalNum)
                                  ? formatCurrencyUtil(
                                      convertQuoteAmountToUsd(lineTotalNum, quote.currency, quote.quoteToUsdRate),
                                      BASE_CURRENCY
                                    )
                                  : "N/A";
                              return (
                                <tr key={item.id} className="quote-data-row border-b" style={{ backgroundColor: vc.rowBg }}>
                                  <td className="text-center border-r quote-table-body-vendor quote-radio-cell">
                                    <input
                                      type="radio"
                                      name={`item-vendor-${item.id}`}
                                      value={quote.quoteId}
                                      checked={isSelectedForItem}
                                      onChange={() => assignItemToVendor(item.id, quote.quoteId)}
                                      disabled={isComparisonLocked}
                                      title={`Assign this item to ${quote.vendor.name}`}
                                      className="h-3.5 w-3.5 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                  </td>
                                  <td className="text-center border-r quote-table-body-vendor quote-vendor-remarks-cell quote-remarks-cell align-top">{quoteItem?.itemRemarks || quoteItem?.remarks || "-"}</td>
                                  <td className="quote-vendor-money-cell text-center border-r quote-table-body-vendor">
                                    {lineIncluded && quoteItem?.unitPrice != null ? (
                                      displayCurrency !== 'ORIGINAL' && displayCurrency !== quote.currency
                                        ? formatInDisplayCurrency(quoteItem.unitPrice, quote.currency, quote.quoteToUsdRate)
                                        : formatCurrency(quoteItem.unitPrice, quote.currency, false)
                                    ) : isComparisonLocked ? formatCurrency(0, quote.currency, false) : "N/A"}
                                  </td>
                                  <td className="quote-vendor-money-cell text-center border-r quote-table-body-vendor text-foreground">
                                    {lineIncluded && quoteItem
                                      ? discount > 0
                                        ? `${discount.toFixed(1)}%`
                                        : "—"
                                      : isComparisonLocked
                                        ? "—"
                                        : "N/A"}
                                  </td>
                                  <td className={`quote-vendor-money-cell text-center border-r quote-table-body-vendor font-semibold ${isLowest ? "text-success" : "text-foreground"}`}>
                                    {calcTotal != null
                                      ? (displayCurrency !== 'ORIGINAL' && displayCurrency !== quote.currency
                                          ? formatInDisplayCurrency(calcTotal, quote.currency, quote.quoteToUsdRate)
                                          : formatCurrency(calcTotal, quote.currency, false))
                                      : updatedQty === 0
                                        ? formatCurrency(0, quote.currency, false)
                                        : quoteItem?.totalPrice != null
                                          ? formatCurrency(quoteItem.totalPrice, quote.currency, false)
                                          : "N/A"}
                                  </td>
                                  <td className="quote-vendor-money-cell text-center quote-table-body-vendor text-foreground">
                                    {displayCurrency !== 'ORIGINAL' && displayCurrency !== BASE_CURRENCY
                                      ? (lineTotalNum != null && !Number.isNaN(lineTotalNum)
                                          ? formatInDisplayCurrency(lineTotalNum, quote.currency, quote.quoteToUsdRate)
                                          : "N/A")
                                      : lineTotalUsd}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="text-foreground">
                            <tr className="quote-footer-row border-t font-bold" style={{ backgroundColor: vc.rowBg }}>
                              <td className="p-[1px] border-r quote-table-body-vendor"></td>
                              <td className="p-[1px] border-r quote-table-body-vendor">-</td>
                              <td className="p-[1px] border-r quote-table-body-vendor">-</td>
                              <td className="p-[1px] border-r quote-table-body-vendor">-</td>
                              <td className="p-[1px] border-r quote-table-body-vendor text-foreground quote-vendor-money-cell">{footerFormat(subTotalForVendor)}</td>
                              <td className="p-[1px] quote-table-body-vendor text-foreground quote-vendor-money-cell">{footerBaseFormat(subTotalForVendor)}</td>
                            </tr>
                            <tr className="quote-footer-row border-t font-medium" style={{ backgroundColor: vc.rowBg }}>
                              <td className="p-[1px] border-r quote-table-body-vendor"></td>
                              <td className="p-[1px] border-r quote-table-body-vendor">-</td>
                              <td className="p-[1px] border-r quote-table-body-vendor">-</td>
                              <td className="p-[1px] border-r quote-table-body-vendor text-success quote-vendor-money-cell">
                                {totalDiscountForVendor > 0 ? `-${footerFormat(totalDiscountForVendor)}` : footerFormat(0)}
                              </td>
                              <td className="p-[1px] border-r quote-table-body-vendor font-medium quote-vendor-money-cell">
                                {footerFormat(subTotalForVendor - totalDiscountForVendor)}
                              </td>
                              <td className="p-[1px] quote-table-body-vendor quote-vendor-money-cell">{footerBaseFormat(subTotalForVendor - totalDiscountForVendor)}</td>
                            </tr>
                            <tr className="quote-footer-row border-t font-medium" style={{ backgroundColor: vc.rowBg }}>
                              <td className="p-[1px] border-r quote-table-body-vendor"></td>
                              <td className="p-[1px] border-r quote-table-body-vendor">-</td>
                              <td className="p-[1px] border-r quote-table-body-vendor">-</td>
                              <td className="p-[1px] border-r quote-table-body-vendor">-</td>
                              <td className="p-[1px] border-r quote-table-body-vendor quote-vendor-money-cell">{footerFormat(addCh)}</td>
                              <td className="p-[1px] quote-table-body-vendor quote-vendor-money-cell">{footerBaseFormat(addCh)}</td>
                            </tr>
                            <tr className="quote-footer-row border-t font-medium" style={{ backgroundColor: vc.rowBg }}>
                              <td className="p-[1px] border-r quote-table-body-vendor"></td>
                              <td className="p-[1px] border-r quote-table-body-vendor">
                                {isAuthorized && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openDeliveryChargesDialog(quote)} title="Edit Delivery Charges"><Edit className="h-3 w-3" /></Button>}
                                {!isAuthorized && !quote.deliveryChargesAttachment && "-"}
                                {quote.deliveryChargesAttachment && <a href={quote.deliveryChargesAttachment} target="_blank" rel="noopener noreferrer" className="text-info"><FileText className="h-3 w-3 inline" /></a>}
                              </td>
                              <td className="p-[1px] border-r quote-table-body-vendor">-</td>
                              <td className="p-[1px] border-r quote-table-body-vendor">-</td>
                              <td className="p-[1px] border-r quote-table-body-vendor quote-vendor-money-cell">{footerFormat(delCh)}</td>
                              <td className="p-[1px] quote-table-body-vendor quote-vendor-money-cell">{footerBaseFormat(delCh)}</td>
                            </tr>
                            <tr className="quote-footer-row border-t-2 font-bold bg-muted" style={{ backgroundColor: vc.rowBg }}>
                              <td className="p-[1px] border-r quote-table-body-vendor"></td>
                              <td className="p-[1px] border-r quote-table-body-vendor">-</td>
                              <td className="p-[1px] border-r quote-table-body-vendor">-</td>
                              <td className="p-[1px] border-r quote-table-body-vendor">-</td>
                              <td className="p-[1px] border-r quote-table-body-vendor text-success quote-vendor-money-cell">{footerFormat(grandTotal)}</td>
                              <td className="p-[1px] quote-table-body-vendor text-success quote-vendor-money-cell">{footerBaseFormat(grandTotal)}</td>
                            </tr>
                          </tfoot>
                        </table>
                        {showCurrencyUsdNote && (
                          <p className="quote-card-currency-note border-t border-border/60 px-2 py-1 text-[9px] text-muted-foreground">
                            {quote.currency !== BASE_CURRENCY &&
                            (displayCurrency === "ORIGINAL" || displayCurrency === BASE_CURRENCY)
                              ? "Grand Total (USD) uses the frozen conversion rate saved for this quote (Accounts rates when configured, otherwise market as of the quote received date). If the rate is not yet saved, a static fallback is shown until you refresh after the server resolves it."
                              : "\u00A0"}
                          </p>
                        )}
                        {showCurrencyDisplayNote && (
                          <p className="quote-card-currency-note border-t border-border/60 px-2 py-1 text-[9px] text-muted-foreground">
                            {displayCurrency !== "ORIGINAL" &&
                            displayCurrency !== quote.currency &&
                            displayCurrency !== BASE_CURRENCY
                              ? `Prices converted to ${displayCurrency} for comparison. Original quote is in ${quote.currency}.`
                              : "\u00A0"}
                          </p>
                        )}
                      </div>
                      {renderQuoteMetadataFooter(quote)}
                      <div className="quote-card-fill-spacer" aria-hidden="true" />
                      </div>
                    </Card>
                  );
                })}
                </div>
              </div>
              );
              return (
                <>
                  {useUnifiedScroll ? (
                    <div className="overflow-y-auto rounded-md border border-border bg-muted/50" style={{ maxHeight: unifiedScrollMaxHeight }}>
                      {cardsRow}
                    </div>
                  ) : cardsRow}
                  {useUnifiedScroll && (
                    <p className="text-xs text-muted-foreground mt-1 text-center">Scroll above to see all {itemCount} items. Requisition and vendor cards move together.</p>
                  )}
                  {requisitionItems.length > 0 && (
                    <TablePagination
                      page={itemsPage}
                      pageSize={itemsPageSize}
                      total={requisitionItems.length}
                      onPageChange={setItemsPage}
                      itemLabel="items"
                      className="mt-1"
                    />
                  )}
                </>
              );
            })()}

            {requisition && rankedQuotes.length >= 2 && (() => {
              const quoteIdsUsed = new Set<string>();
              requisition.items.forEach((it) => {
                const qId = selectedVendorPerItem[it.id];
                if (qId) quoteIdsUsed.add(qId);
              });
              const canSplit = quoteIdsUsed.size >= 2;
              const canPerformSplit =
                userAccessLevel != null &&
                (userAccessLevel === 37 ||
                  userAccessLevel === 39 ||
                  [50, 99, 100].includes(userAccessLevel));
              if (!canSplit || !canPerformSplit) return null;
              return (
                <div className="rounded border border-primary/30 bg-muted/30 p-2">
                  <p className="mb-1 text-xs font-semibold text-foreground">
                    {splitAlreadyApproved
                      ? "Split approved — purchasers will issue POs separately for each vendor"
                      : `Split across ${quoteIdsUsed.size} vendors — approve one quote per vendor (POs issued separately by purchaser)`}
                  </p>
                  <Button
                    size="sm"
                    onClick={handleSplitAndApprove}
                    disabled={splittingQuote || splitAlreadyApproved}
                    className="h-7 bg-primary text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    title={
                      splitAlreadyApproved
                        ? "This requisition has already been split and approved."
                        : undefined
                    }
                  >
                    {splittingQuote ? (
                      <>
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        Approving split…
                      </>
                    ) : splitAlreadyApproved ? (
                      "Split approved"
                    ) : (
                      "Split and approve quotes"
                    )}
                  </Button>
                </div>
              );
            })()}
              </TabsContent>

              <TabsContent value="commercial" className="mt-2">
                <ComparisonCommercialTab
                  quotes={dashboardRankedQuotes}
                  formatAmount={(amount, currency, quoteToUsdRate) =>
                    formatCurrency(amount, currency, true, quoteToUsdRate)
                  }
                  formatDate={formatDate}
                  canEditDelivery={
                    !isComparisonLocked &&
                    userAccessLevel != null &&
                    [32, 33, 50].includes(userAccessLevel)
                  }
                  onEditDelivery={(quoteId) => {
                    const q = quotes.find((x) => x.quoteId === quoteId);
                    if (q) openDeliveryChargesDialog(q);
                  }}
                />
              </TabsContent>

              <TabsContent value="delivery" className="mt-2">
                <ComparisonDeliveryTab quotes={dashboardRankedQuotes} formatDate={formatDate} />
              </TabsContent>

              <TabsContent value="attachments" className="mt-2">
                <ComparisonAttachmentsTab
                  rows={dashboardRankedQuotes.map((q) => ({
                    quoteId: q.quoteId,
                    rank: q.rank,
                    vendorName: q.vendor.name,
                    fileName: q.fileName,
                    fileUrl: q.fileUrl,
                    fileAttachmentId: q.fileAttachmentId,
                    referenceDocuments: q.referenceDocuments,
                    deliveryChargesAttachment: q.deliveryChargesAttachment,
                  }))}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      {/* Split PO: block when multiple vendors are checked but some have no line items */}
      <Dialog open={splitVendorValidationOpen} onOpenChange={setSplitVendorValidationOpen}>
        <DialogContent className="sm:">
          <DialogHeader>
            <DialogTitle>Cannot issue split purchase orders</DialogTitle>
            <DialogDescription className="sr-only">
              Vendors selected without assigned line items must be fixed before issuing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-foreground">
            <p className="text-muted-foreground">
              Use the <strong>Supply</strong> radio on each line to split items between vendors. The following vendor(s)
              are in the split but have no lines assigned — assign at least one item to each, or select a single vendor
              using the header <strong>Select</strong> checkbox to assign all items to one supplier.
            </p>
            <ul className="list-disc pl-5 font-medium">
              {splitVendorValidationNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setSplitVendorValidationOpen(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery & Other Charges Dialog - manual entry with breakdown */}
      <Dialog open={showDeliveryChargesDialog} onOpenChange={setShowDeliveryChargesDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Delivery & Other Charges</DialogTitle>
            <DialogDescription>
              Manual entry for {quoteToEditDelivery?.vendor.name}. Enter amounts as needed; total is calculated automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {QUOTE_CHARGE_FIELDS.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor={key} className="text-right text-sm">
                  {label}
                </Label>
                <div className="col-span-3 relative">
                  <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id={key}
                    type="number"
                    step="0.01"
                    min={0}
                    value={chargesBreakdown[key] ?? ""}
                    onChange={(e) => setChargesBreakdown((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="pl-9"
                    placeholder="0.00"
                  />
                </div>
              </div>
            ))}
            <div className="pt-2 border-t">
              <p className="text-sm font-medium text-foreground">
                Total: {quoteToEditDelivery?.currency ?? "USD"} {chargesTotalForDialog.toFixed(2)}
              </p>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="file" className="text-right">
                Attachment
              </Label>
              <div className="col-span-3">
                <Input
                  id="file"
                  type="file"
                  onChange={(e) => setDeliveryChargesFile(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeliveryChargesDialog(false)} disabled={updatingDeliveryCharges}>
              Cancel
            </Button>
            <Button onClick={updateDeliveryCharges} disabled={updatingDeliveryCharges}>
              {updatingDeliveryCharges ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Charges"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </NetworkErrorHandler>
    </PageReadyGate>
  );
}
