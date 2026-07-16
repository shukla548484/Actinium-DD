"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Upload, Download, Eye, Edit, Search, Filter, X, AlertCircle, CheckCircle2, Ship, Shield, Ban, ShoppingCart, Receipt, ArrowRight } from "lucide-react";
import ActiniumLoader from "@/components/ActiniumLoader";
import { toast } from "sonner";
import { canUserUploadDeliveryNote } from "@/lib/purchase/delivery-note-upload-access";
import { canConfirmOnboardReceipt } from "@/lib/purchase/receipt-confirmation-access";
import { uploadDeliveryNote } from "@/lib/purchase/upload-delivery-note-client";
import { MAX_PURCHASE_ATTACHMENT_BYTES } from "@/lib/purchase/purchase-file-limits";
import { useVessels } from "@/hooks/useStaticData";
import {
  usePurchaseOrdersListByVessel,
  useConfirmedQuotes,
  purchaseOrdersListByVesselQueryKey,
  confirmedQuotesQueryKey,
} from "@/hooks/usePurchaseOrdersListByVessel";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import {
  ClearableInput,
  FilterFieldShell,
  filterTriggerClearPadding,
} from "@/components/ui/clearable-input";
import { cn } from "@/lib/utils";
import { TableSerialHead, TableSerialCell } from "@/components/ui/table-serial-column";
import { tableSerialNo } from "@/lib/table-serial-column";
import { PurchaseEntityHistoryPanel } from "@/components/purchase/PurchaseEntityHistoryPanel";
import type { PurchaseEntityHistoryEntry } from "@/lib/purchase/build-entity-history";
import { canViewPurchaseEntityHistory } from "@/lib/purchase/can-view-purchase-entity-history";
import { purchaseOrderDetailsText } from "@/lib/purchase/po-requisition-display";
import { RequisitionTypeBadge } from "@/components/requisition/RequisitionTypeBadge";
import { Loader2 } from "lucide-react";

interface PurchaseOrder {
  id: string;
  poNumber: string;
  dateOfIssue: string;
  totalAmount: number | null;
  currency: string;
  status: string;
  requisition: {
    id: string;
    requisitionNumber: string;
    heading: string;
    description?: string | null;
    requisitionType: string;
    portOfSupply: string | null;
    status: string;
    vessel: {
      name: string;
      code: string;
    } | null;
  };
  quote: {
    id: string;
    vendor: {
      id: string;
      name: string;
    };
  };
  deliveryNote?: {
    id: string;
    deliveryNoteNumber: string;
    deliveryDate: string;
    status: string;
    googleDriveFileName: string | null;
    googleDriveFileId: string | null;
    uploadedAt: string;
    verifiedAt: string | null;
    verifiedBy: {
      id: string;
      firstName: string;
      lastName: string;
    } | null;
    notes: string | null;
    hasReceiptConfirmation?: boolean;
  } | null;
}

interface ApprovedQuote {
  id: string;
  quoteId: string;
  quoteNumber: string | null;
  requisitionId: string;
  requisitionNumber: string;
  heading: string;
  description?: string | null;
  requisitionType: string;
  portOfSupply: string | null;
  vessel: {
    name: string;
    code: string;
  } | null;
  vendor: {
    id: string;
    name: string;
  };
  totalAmount: number | null;
  currency: string;
  isPendingPO: true; // Flag to indicate this needs a PO
}

interface CurrentUser {
  id: string;
  designationAccessLevel?: number;
  email: string;
}

// Requisition types where DN is NOT mandatory
const DN_NOT_MANDATORY_TYPES = ['SER', 'REP', 'CTM', 'OTR']; // Service, Repair, Communication, Other

function DNStatusPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  // Don't block page rendering - stop loader immediately
  const { ready, markSuccess } = usePageBootstrap();

  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const canViewHistory = canViewPurchaseEntityHistory(currentUser?.designationAccessLevel);
  const [issuingPO, setIssuingPO] = useState<string | null>(null);
  
  // Use optimized hooks for static data with caching
  const { data: vessels = [], isLoading: vesselsLoading } = useVessels({ limit: 100, isActive: true });
  
  const [selectedVesselId, setSelectedVesselId] = useState<string>("");

  // Filters
  const [poNumberFilter, setPoNumberFilter] = useState("");
  const [poDetailsFilter, setPoDetailsFilter] = useState("");
  const [deliveryPortFilter, setDeliveryPortFilter] = useState("");
  const [dnStatusFilter, setDnStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [navigateToInvoiceDialogOpen, setNavigateToInvoiceDialogOpen] = useState(false);
  const [lastUploadedPOId, setLastUploadedPOId] = useState<string | null>(null);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [dnNumber, setDnNumber] = useState("");
  const [dnDate, setDnDate] = useState("");
  const [dnNotes, setDnNotes] = useState("");
  const [verifyNotes, setVerifyNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dnHistory, setDnHistory] = useState<PurchaseEntityHistoryEntry[]>([]);
  const [dnHistoryLoading, setDnHistoryLoading] = useState(false);

  const {
    data: poListRaw = [],
    isFetching: poLoading,
    isError: poError,
  } = usePurchaseOrdersListByVessel(selectedVesselId || null, !!selectedVesselId);

  const { data: confirmedQuotesRaw = [] } = useConfirmedQuotes(
    selectedVesselId || null,
    !!selectedVesselId
  );

  const purchaseOrders = useMemo((): PurchaseOrder[] => {
    return (poListRaw as Record<string, unknown>[]).map((po) => {
      const requisition = po.requisition as Record<string, unknown>;
      const quote = po.quote as Record<string, unknown>;
      const vendor = (quote?.vendor ?? {}) as Record<string, unknown>;
      const dn = po.deliveryNote as Record<string, unknown> | null | undefined;
      return {
        ...(po as unknown as PurchaseOrder),
        requisition: {
          ...(requisition as PurchaseOrder["requisition"]),
          description: (requisition?.description as string) || null,
          requisitionType: String(requisition?.requisitionType ?? ""),
        },
        quote: {
          ...(quote as PurchaseOrder["quote"]),
          vendor: {
            id: (vendor.id as string) || "",
            name: (vendor.name as string) || "",
          },
        },
        deliveryNote: dn
          ? {
              ...(dn as PurchaseOrder["deliveryNote"]),
              googleDriveFileId: (dn.fileUrl as string) || (dn.googleDriveFileId as string),
              googleDriveFileName: (dn.fileName as string) || (dn.googleDriveFileName as string),
              hasReceiptConfirmation: Boolean(dn.hasReceiptConfirmation),
            }
          : null,
      };
    });
  }, [poListRaw]);

  const approvedQuotes = useMemo((): ApprovedQuote[] => {
    return (confirmedQuotesRaw as Record<string, unknown>[])
      .filter((quote) => !purchaseOrders.some((po) => po.quote.id === quote.quoteId))
      .map((quote) => {
        const q = (quote.quote ?? {}) as Record<string, unknown>;
        const vendor = (q.vendor ?? {}) as Record<string, unknown>;
        return {
          id: quote.quoteId as string,
          quoteId: quote.quoteId as string,
          quoteNumber: (q.quoteNumber as string) || null,
          requisitionId: quote.requisitionId as string,
          requisitionNumber: quote.requisitionNumber as string,
          heading: quote.heading as string,
          description: (quote.description as string) || null,
          requisitionType: quote.requisitionType as string,
          portOfSupply: (quote.portOfSupply as string) || null,
          vessel: quote.vessel as ApprovedQuote["vessel"],
          vendor: {
            id: vendor.id as string,
            name: vendor.name as string,
          },
          totalAmount: q.totalAmount ? Number(q.totalAmount) : null,
          currency: (q.currency as string) || "USD",
          isPendingPO: true as const,
        };
      });
  }, [confirmedQuotesRaw, purchaseOrders]);

  const filteredOrders = useMemo((): (PurchaseOrder | ApprovedQuote)[] => {
    let filtered: (PurchaseOrder | ApprovedQuote)[] = [...purchaseOrders, ...approvedQuotes];

    if (poNumberFilter) {
      filtered = filtered.filter((item) => {
        if ("isPendingPO" in item) return false;
        return item.poNumber.toLowerCase().includes(poNumberFilter.toLowerCase());
      });
    }

    if (poDetailsFilter) {
      const term = poDetailsFilter.toLowerCase();
      filtered = filtered.filter((item) => {
        if ("isPendingPO" in item) {
          const details = purchaseOrderDetailsText(item).toLowerCase();
          const heading = item.heading.toLowerCase();
          return details.includes(term) || heading.includes(term);
        }
        const details = purchaseOrderDetailsText(item.requisition).toLowerCase();
        const heading = item.requisition.heading.toLowerCase();
        return details.includes(term) || heading.includes(term);
      });
    }

    if (deliveryPortFilter) {
      filtered = filtered.filter((item) => {
        const portOfSupply = "isPendingPO" in item ? item.portOfSupply : item.requisition.portOfSupply;
        return portOfSupply?.toLowerCase().includes(deliveryPortFilter.toLowerCase());
      });
    }

    if (dnStatusFilter === "uploaded") {
      filtered = filtered.filter((item) => {
        if ("isPendingPO" in item) return false;
        return item.deliveryNote != null;
      });
    } else if (dnStatusFilter === "not_uploaded") {
      filtered = filtered.filter((item) => {
        if ("isPendingPO" in item) return true;
        return !item.deliveryNote;
      });
    } else if (dnStatusFilter === "verified") {
      filtered = filtered.filter((item) => {
        if ("isPendingPO" in item) return false;
        return item.deliveryNote?.status === "VERIFIED";
      });
    } else if (dnStatusFilter === "pending_verification") {
      filtered = filtered.filter((item) => {
        if ("isPendingPO" in item) return false;
        return item.deliveryNote?.status === "UPLOADED";
      });
    }

    return filtered;
  }, [
    purchaseOrders,
    approvedQuotes,
    poNumberFilter,
    poDetailsFilter,
    deliveryPortFilter,
    dnStatusFilter,
  ]);

  const loading = poLoading && !poListRaw.length;

  const refreshDnData = useCallback(async () => {
    if (!selectedVesselId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: purchaseOrdersListByVesselQueryKey(selectedVesselId) }),
      queryClient.invalidateQueries({ queryKey: confirmedQuotesQueryKey(selectedVesselId) }),
    ]);
  }, [queryClient, selectedVesselId]);

  useEffect(() => {
    if (poError) {
      setError("Failed to load purchase orders");
      toast.error("Failed to load purchase orders");
    } else {
      setError(null);
    }
  }, [poError]);

  // Stop loader immediately - don't wait for anything
  useEffect(() => {
    markSuccess();
  }, [markSuccess]);

  // Initialize vessel selection from URL params or localStorage
  useEffect(() => {
    if (vesselsLoading || selectedVesselId) return; // Don't override if already selected
    
    // Check URL params first
    const vesselIdFromUrl = searchParams?.get('vesselId');
    if (vesselIdFromUrl) {
      setSelectedVesselId(vesselIdFromUrl);
      // Save to localStorage for persistence
      try {
        localStorage.setItem('lastSelectedVesselId', vesselIdFromUrl);
      } catch (e) {
        console.error('Error saving to localStorage:', e);
      }
      return;
    }
    
    // Fall back to localStorage
    try {
      const lastVesselId = localStorage.getItem('lastSelectedVesselId');
      if (lastVesselId) {
        setSelectedVesselId(lastVesselId);
      }
    } catch (e) {
      console.error('Error accessing localStorage:', e);
    }
  }, [vesselsLoading, searchParams, selectedVesselId]);

  // Initialize data in background - non-blocking
  useEffect(() => {
    if (!vesselsLoading) {
      fetchCurrentUser();
    }
  }, [vesselsLoading]);

  useEffect(() => {
    setCurrentPage(1);
  }, [poNumberFilter, poDetailsFilter, deliveryPortFilter, dnStatusFilter, selectedVesselId, itemsPerPage, filteredOrders.length]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  // Handle auto-opening upload/edit dialog with pre-selected PO from URL
  useEffect(() => {
    if (typeof window !== 'undefined' && purchaseOrders.length > 0 && selectedVesselId) {
      const params = new URLSearchParams(window.location.search);
      const urlPOId = params.get('purchaseOrderId');
      const openUpload = params.get('openUpload') === 'true';
      const editMode = params.get('edit') === 'true';

      if (urlPOId && (openUpload || editMode) && !uploadDialogOpen) {
        const po = purchaseOrders.find(p => p.id === urlPOId);
        if (po) {
          setSelectedPO(po);
          if (editMode && po.deliveryNote) {
            // Edit mode - pre-fill with existing DN data
            setDnNumber(po.deliveryNote.deliveryNoteNumber || '');
            setDnDate(po.deliveryNote.deliveryDate ? new Date(po.deliveryNote.deliveryDate).toISOString().split('T')[0] : '');
            setDnNotes(po.deliveryNote.notes || '');
          } else {
            // Upload mode - clear form
            setDnNumber('');
            setDnDate('');
            setDnNotes('');
          }
          setSelectedFile(null);
          setUploadDialogOpen(true);
          // Clean up URL params but keep vesselId if present
          const newUrl = window.location.pathname + (selectedVesselId ? `?vesselId=${selectedVesselId}` : '');
          window.history.replaceState({}, '', newUrl);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseOrders, selectedVesselId, uploadDialogOpen]);

  useEffect(() => {
    const dnId = selectedPO?.deliveryNote?.id;
    if (!verifyDialogOpen || !dnId || !canViewHistory) {
      setDnHistory([]);
      return;
    }
    let cancelled = false;
    setDnHistoryLoading(true);
    fetch(`/api/delivery-notes/${dnId}/history`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { history: [] }))
      .then((data) => {
        if (!cancelled) setDnHistory(data.history ?? []);
      })
      .catch(() => {
        if (!cancelled) setDnHistory([]);
      })
      .finally(() => {
        if (!cancelled) setDnHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [verifyDialogOpen, selectedPO?.deliveryNote?.id, canViewHistory]);

  const fetchCurrentUser = async () => {
    try {
      const { fetchJsonWithTimeout } = await import('@/lib/utils/fetch-with-timeout');
      const data = await fetchJsonWithTimeout<{ user?: CurrentUser } | CurrentUser>("/api/auth/me", {
        timeout: 8000,
        credentials: "include",
      });
      const user = (data as any).user || data;
      setCurrentUser(user);
    } catch (error: any) {
      console.error("Error fetching current user:", error);
      if (error.message?.includes('timeout')) {
        console.warn("User fetch timed out");
      }
    }
  };

  // Check if user can issue PO
  const canIssuePO = (): boolean => {
    if (!currentUser) return false;
    const accessLevel = currentUser.designationAccessLevel || 0;
    // Access levels 32, 33, 50, 99, 100 can issue POs
    return [32, 33, 50, 99, 100].includes(accessLevel);
  };

  // Check if user can upload DN
  const canUploadDN = (po: PurchaseOrder): boolean => {
    if (!currentUser) return false;
    const accessLevel = currentUser.designationAccessLevel || 0;
    return canUserUploadDeliveryNote(accessLevel);
  };

  // Check if user can verify DN
  const canVerifyDN = (): boolean => {
    if (!currentUser) return false;
    const accessLevel = currentUser.designationAccessLevel || 0;
    return accessLevel === 25 || [50, 99, 100].includes(accessLevel);
  };

  const canConfirmOnboardReceiptDN = (): boolean => {
    if (!currentUser) return false;
    return canConfirmOnboardReceipt(currentUser.designationAccessLevel);
  };

  // Check if DN is mandatory for this requisition type
  const isDNMandatory = (requisitionType: string): boolean => {
    return !DN_NOT_MANDATORY_TYPES.includes(requisitionType);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast.error("Please select a PDF file");
        return;
      }
      if (file.size > MAX_PURCHASE_ATTACHMENT_BYTES) {
        toast.error(`File size must be less than ${MAX_PURCHASE_ATTACHMENT_BYTES / 1024 / 1024}MB`);
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedPO || !selectedFile || !dnNumber || !dnDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!canUploadDN(selectedPO)) {
      toast.error("You do not have permission to upload delivery notes");
      return;
    }

    try {
      setUploading(true);

      await uploadDeliveryNote({
        file: selectedFile,
        purchaseOrderId: selectedPO.id,
        quoteId: selectedPO.quote.id,
        deliveryNoteNumber: dnNumber,
        deliveryDate: dnDate,
        notes: dnNotes.trim() || undefined,
      });

      toast.success("Delivery note uploaded successfully. You can upload the invoice when ready.");
      
      // Store the PO ID for navigation option
      const uploadedPOId = selectedPO?.id || null;
      
      // Reset form
      setSelectedFile(null);
      setDnNumber("");
      setDnDate("");
      setDnNotes("");
      setUploadDialogOpen(false);
      
      // Refresh purchase orders and approved quotes
      await refreshDnData();
      
      // Show dialog to navigate to invoice upload
      if (uploadedPOId) {
        setLastUploadedPOId(uploadedPOId);
        setNavigateToInvoiceDialogOpen(true);
      } else {
        setSelectedPO(null);
      }
    } catch (err) {
      console.error("Error uploading delivery note:", err);
      toast.error(err instanceof Error ? err.message : "Failed to upload delivery note");
    } finally {
      setUploading(false);
    }
  };

  const handleVerify = async (verified: boolean) => {
    if (!selectedPO || !selectedPO.deliveryNote) {
      toast.error("No delivery note selected for verification");
      return;
    }

    if (!canVerifyDN()) {
      toast.error("You do not have permission to verify delivery notes");
      return;
    }

    try {
      setVerifying(true);

      const response = await fetch(`/api/delivery-notes/${selectedPO.deliveryNote.id}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          verified,
          notes: verifyNotes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to verify delivery note");
      }

      toast.success(verified ? "Delivery note verified successfully" : "Delivery note rejected");
      
      // Reset form
      setVerifyNotes("");
      setVerifyDialogOpen(false);
      setSelectedPO(null);

      // Refresh purchase orders and approved quotes
      await refreshDnData();
    } catch (err) {
      console.error("Error verifying delivery note:", err);
      toast.error(err instanceof Error ? err.message : "Failed to verify delivery note");
    } finally {
      setVerifying(false);
    }
  };

  const handleEdit = (po: PurchaseOrder) => {
    setSelectedPO(po);
    if (po.deliveryNote) {
      setDnNumber(po.deliveryNote.deliveryNoteNumber);
      setDnDate(new Date(po.deliveryNote.deliveryDate).toISOString().split("T")[0]);
      setDnNotes(po.deliveryNote.notes || "");
    } else {
      setDnNumber("");
      setDnDate("");
      setDnNotes("");
    }
    setSelectedFile(null);
    setUploadDialogOpen(true);
  };

  const handleView = async (fileId: string) => {
    try {
      const response = await fetch(`/api/delivery-notes/${fileId}/view`, {
        credentials: "include",
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, "_blank");
      } else {
        toast.error("Failed to view delivery note");
      }
    } catch (err) {
      console.error("Error viewing file:", err);
      toast.error("Failed to view delivery note");
    }
  };

  const handleDownload = async (fileId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/delivery-notes/${fileId}/download`, {
        credentials: "include",
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName || "delivery-note.pdf";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        toast.error("Failed to download delivery note");
      }
    } catch (err) {
      console.error("Error downloading file:", err);
      toast.error("Failed to download delivery note");
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number | null, currency: string = "USD") => {
    if (amount === null || amount === undefined) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(Number(amount));
  };

  const clearFilters = () => {
    setPoNumberFilter("");
    setPoDetailsFilter("");
    setDeliveryPortFilter("");
    setDnStatusFilter("all");
  };

  const handleIssuePO = async (quote: ApprovedQuote) => {
    if (!canIssuePO()) {
      toast.error("You do not have permission to issue purchase orders");
      return;
    }

    try {
      setIssuingPO(quote.quoteId);
      
      // Navigate to create PO page with quote ID pre-selected
      router.push(`/purchase/create-po?quoteId=${quote.quoteId}&requisitionId=${quote.requisitionId}`);
    } catch (err) {
      console.error("Error navigating to create PO:", err);
      toast.error("Failed to open create PO page");
      setIssuingPO(null);
    }
  };

  const getDNStatusBadge = (item: PurchaseOrder | ApprovedQuote) => {
    // For approved quotes without PO, show "PO Pending"
    if ('isPendingPO' in item) {
      return (
        <Badge className="bg-info text-white">
          <ShoppingCart className="h-3 w-3 mr-1" />
          PO Pending
        </Badge>

      );
    }

    const po = item as PurchaseOrder;
    if (!po.deliveryNote) {
      const isMandatory = isDNMandatory(po.requisition.requisitionType);
      return (
        <Badge variant={isMandatory ? "destructive" : "outline"}>
          {isMandatory ? "DN Required" : "DN Not Required"}
        </Badge>
      );
    }

    if (po.deliveryNote.status === "VERIFIED") {
      return (
        <Badge className="bg-success text-white">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Verified
        </Badge>
      );
    }

    if (po.deliveryNote.status === "REJECTED") {
      return (
        <Badge variant="destructive">
          <Ban className="h-3 w-3 mr-1" />
          Rejected
        </Badge>
      );
    }

    return (
      <Badge className="bg-success text-white">
        <FileText className="h-3 w-3 mr-1" />
        Uploaded
      </Badge>
    );
  };

  // Page structure renders immediately - no blocking loader
  // Data loads in background and displays when ready

  return (
    <PageReadyGate ready={ready}>
    <ProtectedRoute>
      <div className="space-y-4">
        <main className="py-4">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">DN Status</h1>
            <p className="text-foreground">
              Upload and manage delivery notes for purchase orders. DN upload is required before
              invoice processing; master verification is optional.
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Vessel + filters (single row) */}
          <Card variant="filter" className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filters
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div>
                  <Label htmlFor="vessel" className="mb-2 block">
                    Vessel
                  </Label>
                  <FilterFieldShell
                    showClear={Boolean(selectedVesselId)}
                    onClear={() => setSelectedVesselId("")}
                    hasDropdownChevron
                    className="max-w-none"
                  >
                    <Select value={selectedVesselId} onValueChange={setSelectedVesselId}>
                      <SelectTrigger
                        id="vessel"
                        width="vessel"
                        className={cn(
                          "w-full",
                          filterTriggerClearPadding(Boolean(selectedVesselId), true)
                        )}
                      >
                        <SelectValue placeholder="Select a vessel" />
                      </SelectTrigger>
                      <SelectContent>
                        {vessels.map((vessel) => (
                          <SelectItem key={vessel.id} value={vessel.id}>
                            {vessel.name} ({vessel.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FilterFieldShell>
                </div>
                <div>
                  <Label htmlFor="poNumber" className="mb-2 block">
                    PO Number
                  </Label>
                  <ClearableInput
                    id="poNumber"
                    placeholder="Search PO Number"
                    value={poNumberFilter}
                    onChange={(e) => setPoNumberFilter(e.target.value)}
                    onClear={() => setPoNumberFilter("")}
                    className="h-9 text-sm"
                    disabled={!selectedVesselId}
                  />
                </div>
                <div>
                  <Label htmlFor="poDetails" className="mb-2 block">
                    PO Details
                  </Label>
                  <ClearableInput
                    id="poDetails"
                    placeholder="Search PO Details"
                    value={poDetailsFilter}
                    onChange={(e) => setPoDetailsFilter(e.target.value)}
                    onClear={() => setPoDetailsFilter("")}
                    className="h-9 text-sm"
                    disabled={!selectedVesselId}
                  />
                </div>
                <div>
                  <Label htmlFor="deliveryPort" className="mb-2 block">
                    Delivery Port
                  </Label>
                  <ClearableInput
                    id="deliveryPort"
                    placeholder="Search Delivery Port"
                    value={deliveryPortFilter}
                    onChange={(e) => setDeliveryPortFilter(e.target.value)}
                    onClear={() => setDeliveryPortFilter("")}
                    className="h-9 text-sm"
                    disabled={!selectedVesselId}
                  />
                </div>
                <div>
                  <Label htmlFor="dnStatus" className="mb-2 block">
                    DN Status
                  </Label>
                  <FilterFieldShell
                    showClear={dnStatusFilter !== "all"}
                    onClear={() => setDnStatusFilter("all")}
                    hasDropdownChevron
                    className="max-w-none"
                  >
                    <Select
                      value={dnStatusFilter}
                      onValueChange={setDnStatusFilter}
                      disabled={!selectedVesselId}
                    >
                      <SelectTrigger
                        id="dnStatus"
                        className={cn(
                          "w-full",
                          filterTriggerClearPadding(dnStatusFilter !== "all", true)
                        )}
                      >
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="not_uploaded">DN Not Uploaded</SelectItem>
                        <SelectItem value="uploaded">DN Uploaded</SelectItem>
                        <SelectItem value="pending_verification">Uploaded (optional review)</SelectItem>
                        <SelectItem value="verified">Verified</SelectItem>
                      </SelectContent>
                    </Select>
                  </FilterFieldShell>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Purchase Orders Table */}
          {selectedVesselId ? (
            <Card>
              <CardHeader>
                <CardTitle>Purchase Orders</CardTitle>
                <CardDescription>
                  {filteredOrders.length} purchase order(s) found
                </CardDescription>
              </CardHeader>
              <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableSerialHead />
                      <TableHead>PO Number</TableHead>
                      <TableHead>Date of Issue</TableHead>
                      <TableHead>Requisition Number</TableHead>
                      <TableHead>PO Details</TableHead>
                      <TableHead>Requisition Type</TableHead>
                      <TableHead>Vessel</TableHead>
                      <TableHead>Delivery Port</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>DN Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableSerialCell serialNo={1} />
                        <TableCell colSpan={12} className="py-14">
                          <div className="flex justify-center">
                            <ActiniumLoader size="md" text="Loading purchase orders…" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredOrders.length === 0 ? (
                      <TableRow>
                        <TableSerialCell serialNo={1} />
                        <TableCell colSpan={12} className="text-center py-4 text-muted-foreground">
                          No purchase orders found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedOrders.map((item, rowIdx) => {
                        // Handle approved quotes without PO
                        if ('isPendingPO' in item) {
                          const quote = item as ApprovedQuote;
                          const canIssue = canIssuePO();
                          
                          return (
                            <TableRow key={quote.quoteId}>
                              <TableSerialCell serialNo={tableSerialNo(currentPage, itemsPerPage, rowIdx)} />
                              <TableCell className="font-medium text-muted-foreground">
                                <span className="text-xs">Pending</span>
                              </TableCell>
                              <TableCell className="text-muted-foreground">-</TableCell>
                              <TableCell>{quote.requisitionNumber}</TableCell>
                              <TableCell>{purchaseOrderDetailsText(quote)}</TableCell>
                              <TableCell>
                                <RequisitionTypeBadge type={quote.requisitionType} />
                              </TableCell>
                              <TableCell>
                                {quote.vessel
                                  ? `${quote.vessel.name} (${quote.vessel.code})`
                                  : "N/A"}
                              </TableCell>
                              <TableCell>{quote.portOfSupply || "N/A"}</TableCell>
                              <TableCell>{quote.vendor.name}</TableCell>
                              <TableCell>{formatCurrency(quote.totalAmount, quote.currency)}</TableCell>
                              <TableCell>
                                {getDNStatusBadge(quote)}
                              </TableCell>
                              <TableCell>
                                {canIssue && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleIssuePO(quote)}
                                    disabled={issuingPO === quote.quoteId}
                                    className="bg-info hover:bg-info"
                                  >
                                    <ShoppingCart className="h-4 w-4 mr-2" />
                                    {issuingPO === quote.quoteId ? "Opening..." : "Issue PO"}
                                  </Button>
                                )}
                                {!canIssue && (
                                  <span className="text-xs text-muted-foreground">No Permission</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        }

                        // Handle existing purchase orders
                        const po = item as PurchaseOrder;
                        const canUpload = canUploadDN(po);
                        const canVerify = canVerifyDN();
                        const canConfirmReceipt = canConfirmOnboardReceiptDN();
                        const isMandatory = isDNMandatory(po.requisition.requisitionType);
                        
                        return (
                          <TableRow key={po.id}>
                            <TableSerialCell serialNo={tableSerialNo(currentPage, itemsPerPage, rowIdx)} />
                            <TableCell className="font-medium">{po.poNumber}</TableCell>
                            <TableCell>{formatDate(po.dateOfIssue)}</TableCell>
                            <TableCell>{po.requisition.requisitionNumber}</TableCell>
                            <TableCell>{purchaseOrderDetailsText(po.requisition)}</TableCell>
                            <TableCell>
                              <RequisitionTypeBadge type={po.requisition.requisitionType} />
                            </TableCell>
                            <TableCell>
                              {po.requisition.vessel
                                ? `${po.requisition.vessel.name} (${po.requisition.vessel.code})`
                                : "N/A"}
                            </TableCell>
                            <TableCell>{po.requisition.portOfSupply || "N/A"}</TableCell>
                            <TableCell>{po.quote.vendor.name}</TableCell>
                            <TableCell>{formatCurrency(po.totalAmount, po.currency)}</TableCell>
                            <TableCell>
                              {getDNStatusBadge(po)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {po.deliveryNote ? (
                                  <>
                                    {po.deliveryNote.googleDriveFileId && (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleView(po.deliveryNote!.id)}
                                          title="View DN"
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            handleDownload(
                                              po.deliveryNote!.id,
                                              po.deliveryNote!.googleDriveFileName || "delivery-note.pdf"
                                            )
                                          }
                                          title="Download DN"
                                        >
                                          <Download className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}
                                    {canUpload && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEdit(po)}
                                        title="Edit/Re-upload DN"
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    )}
                                    {canVerify && po.deliveryNote.status === "UPLOADED" && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedPO(po);
                                          setVerifyNotes("");
                                          setVerifyDialogOpen(true);
                                        }}
                                        title="Verify DN"
                                        className="bg-success hover:bg-success"
                                      >
                                        <Shield className="h-4 w-4" />
                                      </Button>
                                    )}
                                    {canConfirmReceipt &&
                                      (po.deliveryNote.status === "VERIFIED" ||
                                        po.deliveryNote.status === "UPLOADED") &&
                                      !po.deliveryNote.hasReceiptConfirmation && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          title="Confirm onboard receipt (ordered vs received qty)"
                                          onClick={() => {
                                            const params = new URLSearchParams();
                                            if (selectedVesselId) {
                                              params.set("vesselId", selectedVesselId);
                                            }
                                            params.set("dnId", po.deliveryNote!.id);
                                            router.push(
                                              `/purchase/requisitions/receipt-confirmation?${params.toString()}`
                                            );
                                          }}
                                        >
                                          <Receipt className="h-4 w-4" />
                                        </Button>
                                      )}
                                  </>
                                ) : (
                                  <>
                                    {canUpload && isMandatory && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedPO(po);
                                          setDnNumber("");
                                          setDnDate("");
                                          setDnNotes("");
                                          setSelectedFile(null);
                                          setUploadDialogOpen(true);
                                        }}
                                      >
                                        <Upload className="h-4 w-4 mr-2" />
                                        Upload DN
                                      </Button>
                                    )}
                                    {!isMandatory && (
                                      <span className="text-xs text-muted-foreground">Not Required</span>
                                    )}
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
                <div className="mt-4">
                  <TablePagination
                    page={currentPage}
                    pageSize={itemsPerPage}
                    total={filteredOrders.length}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(size) => {
                      setItemsPerPage(size);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Ship className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Vessel Selected</h3>
                  <p className="text-foreground">
                    Please select a vessel to view its purchase orders
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upload DN Dialog */}
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogContent >
              <DialogHeader>
                <DialogTitle>
                  {selectedPO?.deliveryNote ? "Edit/Re-upload Delivery Note" : "Upload Delivery Note"}
                </DialogTitle>
                <DialogDescription>
                  {selectedPO?.deliveryNote 
                    ? `Re-upload delivery note for PO: ${selectedPO.poNumber}`
                    : `Upload delivery note for PO: ${selectedPO?.poNumber}`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="dnNumber">DN Number *</Label>
                  <Input
                    id="dnNumber"
                    value={dnNumber}
                    onChange={(e) => setDnNumber(e.target.value)}
                    placeholder="Enter DN number"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="dnDate">Delivery Date *</Label>
                  <Input
                    id="dnDate"
                    type="date"
                    value={dnDate}
                    onChange={(e) => setDnDate(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="dnNotes">Notes (Optional)</Label>
                  <Textarea
                    id="dnNotes"
                    value={dnNotes}
                    onChange={(e) => setDnNotes(e.target.value)}
                    placeholder="Additional notes about the delivery..."
                    rows={3}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="file">DN File (PDF) *</Label>
                  <Input
                    id="file"
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileSelect}
                    className="mt-2"
                  />
                  {selectedFile && (
                    <p className="text-sm text-foreground mt-1">
                      Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setUploadDialogOpen(false);
                      setSelectedPO(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={uploading || !selectedFile || !dnNumber || !dnDate}
                  >
                    {uploading ? "Uploading..." : selectedPO?.deliveryNote ? "Re-upload" : "Upload"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Verify DN Dialog */}
          <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
            <DialogContent 
              className="max-h-[90vh] overflow-y-auto"
             
            >
              <DialogHeader>
                <DialogTitle>Verify Delivery Note</DialogTitle>
                <DialogDescription>
                  Verify or reject delivery note for PO: {selectedPO?.poNumber}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {selectedPO?.deliveryNote && (
                  <>
                    {/* Delivery Note Info */}
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-sm font-medium">DN Number: {selectedPO.deliveryNote.deliveryNoteNumber}</p>
                      <p className="text-sm text-foreground">Delivery Date: {formatDate(selectedPO.deliveryNote.deliveryDate)}</p>
                      <p className="text-sm text-foreground">Uploaded: {formatDate(selectedPO.deliveryNote.uploadedAt)}</p>
                    </div>

                    {canViewHistory && (
                    <div>
                      <Label className="text-sm font-semibold mb-2 block">History</Label>
                      {dnHistoryLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading history…
                        </div>
                      ) : (
                        <PurchaseEntityHistoryPanel history={dnHistory} />
                      )}
                    </div>
                    )}

                    {/* Comments from Uploader */}
                    {selectedPO.deliveryNote.notes && (
                      <div className="p-4 bg-info border border-border rounded-md">
                        <Label className="text-sm font-semibold text-info mb-2 block">
                          Comments from Uploader:
                        </Label>
                        <p className="text-sm text-info whitespace-pre-wrap">
                          {selectedPO.deliveryNote.notes}
                        </p>
                      </div>
                    )}

                    {/* PDF Preview */}
                    {selectedPO.deliveryNote.googleDriveFileId && (
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">PDF Preview:</Label>
                        <div className="w-full h-[60vh] border rounded-md overflow-hidden">
                          <iframe
                            src={`/api/delivery-notes/${selectedPO.deliveryNote.id}/view#toolbar=1`}
                            className="w-full h-full"
                            title={`Delivery Note ${selectedPO.deliveryNote.deliveryNoteNumber}`}
                          />
                        </div>
                      </div>
                    )}

                    {/* Verification Notes */}
                    <div>
                      <Label htmlFor="verifyNotes">Verification Notes (Optional)</Label>
                      <Textarea
                        id="verifyNotes"
                        value={verifyNotes}
                        onChange={(e) => setVerifyNotes(e.target.value)}
                        placeholder="Add verification notes..."
                        rows={3}
                        className="mt-2"
                      />
                    </div>
                  </>
                )}
                
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setVerifyDialogOpen(false);
                      setSelectedPO(null);
                      setVerifyNotes("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleVerify(false)}
                    disabled={verifying}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleVerify(true)}
                    disabled={verifying}
                    className="bg-success hover:bg-success"
                  >
                    {verifying ? "Verifying..." : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Verify
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Navigate to Invoice Upload Dialog */}
          <Dialog open={navigateToInvoiceDialogOpen} onOpenChange={setNavigateToInvoiceDialogOpen}>
            <DialogContent >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  Delivery Note Uploaded Successfully
                </DialogTitle>
                <DialogDescription>
                  Your delivery note has been uploaded. You can proceed to upload the invoice for
                  this purchase order.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Alert>
                  <Receipt className="h-4 w-4" />
                  <AlertDescription>
                    Would you like to upload an invoice for this purchase order now?
                  </AlertDescription>
                </Alert>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setNavigateToInvoiceDialogOpen(false);
                    setLastUploadedPOId(null);
                    setSelectedPO(null);
                  }}
                >
                  Stay Here
                </Button>
                <Button
                  onClick={() => {
                    if (lastUploadedPOId && selectedPO?.requisition?.vessel?.id) {
                      // Navigate to invoices page with PO ID and vessel ID as query params
                      const vesselId = selectedPO.requisition.vessel.id;
                      router.push(`/purchase/invoices?vesselId=${vesselId}&purchaseOrderId=${lastUploadedPOId}&openUpload=true`);
                    } else {
                      // Fallback: just go to invoices page
                      router.push('/purchase/invoices');
                    }
                    setNavigateToInvoiceDialogOpen(false);
                    setLastUploadedPOId(null);
                    setSelectedPO(null);
                  }}
                  className="bg-info hover:bg-info"
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Go to Invoice Upload
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </ProtectedRoute>
    </PageReadyGate>
  );
}

export function DNStatusContent() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      }
    >
      <DNStatusPageContent />
    </Suspense>
  );
}
