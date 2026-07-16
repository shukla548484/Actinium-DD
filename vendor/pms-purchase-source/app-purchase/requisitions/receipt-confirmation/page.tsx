"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import ActiniumLoader from "@/components/ActiniumLoader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FilterFieldShell,
  filterTriggerClearPadding,
} from "@/components/ui/clearable-input";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useVessels } from "@/hooks/useStaticData";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";
import {
  Check,
  CheckCircle,
  ChevronsUpDown,
  XCircle,
  AlertCircle,
  Package,
  Search,
  Eye,
  AlertTriangle,
} from "lucide-react";
import { TableSerialHead, TableSerialCell } from "@/components/ui/table-serial-column";
import { canConfirmOnboardReceipt } from "@/lib/purchase/receipt-confirmation-access";
import {
  computeOverallReceiptStatus,
  normalizeReceiptQuantity,
  receiptQuantityVariance,
  resolveReceiptLineStatus,
  type ReceiptLineStatus,
} from "@/lib/purchase/receipt-ordered-qty";

interface DeliveryNote {
  id: string;
  deliveryNoteNumber: string;
  deliveryDate: string;
  status: string;
  purchaseOrder?: { id: string; poNumber: string } | null;
  vendorQuote: {
    id: string;
    requisition: {
      id: string;
      requisitionNumber: string;
      heading: string;
      vessel: {
        id: string;
        name: string;
      };
    };
    vendor: {
      id: string;
      name: string;
    };
  };
}

type PortSearchItem = {
  id: string;
  name: string;
  country?: string | null;
  code?: string | null;
};

interface RequisitionItem {
  requisitionItem: {
    id: string;
    itemName: string;
    description?: string;
    partNumber?: string;
    partName?: string;
    quantity: number;
    unit: string;
    machineryInstanceId?: string;
    manualMachineryName?: string;
    addToInventory?: boolean;
  };
  quoteItem: {
    id: string;
    itemName: string;
    quantity: number;
    unit: string;
    partNumber?: string;
    unitPrice?: number;
    totalPrice?: number;
  } | null;
  orderedQuantity: number | null;
  requestedQuantity: number;
  receiptStatus?: {
    id: string;
    status: string;
    receivedQuantity: number;
    expectedQuantity: number;
    issueType?: string;
    issueDescription?: string;
    isAddedToInventory: boolean;
  } | null;
}

export default function ReceiptConfirmationPage() {
  const { ready, markSuccess } = usePageBootstrap();
  const { data: vessels = [] } = useVessels({ limit: 100, isActive: true });
  
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<DeliveryNote[]>([]);
  const [selectedVessel, setSelectedVessel] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Receipt confirmation dialog
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const [selectedDeliveryNote, setSelectedDeliveryNote] = useState<any>(null);
  const [receiptItems, setReceiptItems] = useState<RequisitionItem[]>([]);
  const [overallStatus, setOverallStatus] = useState<"FULLY_RECEIVED" | "PARTIALLY_RECEIVED" | "NOT_RECEIVED">("PARTIALLY_RECEIVED");
  const [confirmationNotes, setConfirmationNotes] = useState("");
  const [portOfReceived, setPortOfReceived] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [portComboboxOpen, setPortComboboxOpen] = useState(false);
  const [portSearchQuery, setPortSearchQuery] = useState("");
  const [portSearchResults, setPortSearchResults] = useState<PortSearchItem[]>([]);
  const [portSearchLoading, setPortSearchLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const searchParams = useSearchParams();
  const [vesselBoxes, setVesselBoxes] = useState<
    Array<{ id: string; boxNumber: string; label: string }>
  >([]);
  const [defaultReceivingBoxId, setDefaultReceivingBoxId] = useState<string | null>(null);
  const sessionPutAwayBoxIdRef = React.useRef<string>("");
  const [lastInventoryResults, setLastInventoryResults] = useState<
    Array<{ requisitionItemId: string; outcome: string; message: string; sparePartNumber?: string }>
  >([]);
  const [currentUserAccessLevel, setCurrentUserAccessLevel] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const user = data.user ?? data;
        setCurrentUserAccessLevel(user.designationAccessLevel ?? null);
      } catch {
        setCurrentUserAccessLevel(null);
      }
    })();
  }, []);

  const canConfirmReceipt = canConfirmOnboardReceipt(currentUserAccessLevel);

  // Fetch delivery notes with pending receipt confirmation
  const fetchDeliveryNotes = useCallback(async () => {
    if (!selectedVessel) {
      setDeliveryNotes([]);
      setFilteredNotes([]);
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery-notes?vesselId=${encodeURIComponent(selectedVessel)}&pendingReceipt=true`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to fetch delivery notes"
        );
      }
      const data = await res.json();
      const pendingNotes = (data.deliveryNotes ?? []) as DeliveryNote[];
      setDeliveryNotes(pendingNotes);
      setFilteredNotes(pendingNotes);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to fetch delivery notes");
      setDeliveryNotes([]);
      setFilteredNotes([]);
    } finally {
      setLoading(false);
      markSuccess();
    }
  }, [selectedVessel, markSuccess]);

  useEffect(() => {
    fetchDeliveryNotes();
  }, [fetchDeliveryNotes]);

  useEffect(() => {
    const v = searchParams.get("vesselId");
    if (v) setSelectedVessel(v);
  }, [searchParams]);

  useEffect(() => {
    if (vessels.length > 0 && !selectedVessel) {
      setSelectedVessel(vessels[0].id);
    }
  }, [vessels, selectedVessel]);

  useEffect(() => {
    if (searchTerm) {
      setFilteredNotes(
        deliveryNotes.filter(
          (dn) =>
            dn.deliveryNoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            dn.purchaseOrder?.poNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            dn.vendorQuote.requisition.requisitionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            dn.vendorQuote.vendor.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredNotes(deliveryNotes);
    }
  }, [searchTerm, deliveryNotes]);

  const loadVesselBoxes = useCallback(async (vesselId: string) => {
    try {
      const res = await fetch(`/api/spares-inventory/vessel-boxes?vesselId=${encodeURIComponent(vesselId)}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setVesselBoxes(data.boxes ?? []);
        setDefaultReceivingBoxId(data.defaultReceivingBoxId ?? null);
        return data.defaultReceivingBoxId as string | null;
      }
    } catch {
      setVesselBoxes([]);
    }
    return null;
  }, []);

  useEffect(() => {
    if (!portComboboxOpen) {
      setPortSearchQuery("");
      setPortSearchResults([]);
      return;
    }
    if (!portSearchQuery || portSearchQuery.trim().length < 2) {
      setPortSearchResults([]);
      return;
    }
    const timeoutId = setTimeout(async () => {
      setPortSearchLoading(true);
      try {
        const response = await fetch(
          `/api/ports/search?q=${encodeURIComponent(portSearchQuery.trim())}&limit=30`,
          { credentials: "include" }
        );
        if (!response.ok) {
          setPortSearchResults([]);
          return;
        }
        const data = await response.json();
        setPortSearchResults((data?.ports || []) as PortSearchItem[]);
      } catch {
        setPortSearchResults([]);
      } finally {
        setPortSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [portComboboxOpen, portSearchQuery]);

  // Open receipt confirmation dialog
  const handleConfirmReceipt = async (deliveryNote: DeliveryNote) => {
    try {
      const vesselId = deliveryNote.vendorQuote.requisition.vessel.id;
      const defaultBox = await loadVesselBoxes(vesselId);
      const res = await fetch(`/api/delivery-notes/${deliveryNote.id}/pending-receipt`);
      if (res.ok) {
        const data = await res.json();
        setSelectedDeliveryNote(data);
        
        // Initialize receipt items — ordered qty is the baseline (not requested qty)
        const items: any[] = data.items.map((item: RequisitionItem) => {
          const orderedQty =
            item.orderedQuantity ??
            item.quoteItem?.quantity ??
            null;
          const orderedQtyNormalized =
            orderedQty != null ? normalizeReceiptQuantity(orderedQty) : null;
          const receivedDefault = Math.max(
            0,
            Math.round(
              normalizeReceiptQuantity(
                item.receiptStatus?.receivedQuantity ??
                  (orderedQtyNormalized != null ? orderedQtyNormalized : 0)
              )
            )
          );
          const initialStatus = (
            item.receiptStatus?.status || "RECEIVED"
          ) as ReceiptLineStatus;
          const resolvedStatus =
            initialStatus === "RECEIVED" || initialStatus === "QUANTITY_MISMATCH"
              ? resolveReceiptLineStatus(
                  "RECEIVED",
                  receivedDefault,
                  orderedQtyNormalized ?? 0
                )
              : initialStatus;

          return {
            requisitionItemId: item.requisitionItem.id,
            vendorQuoteItemId: item.quoteItem?.id || null,
            status: resolvedStatus,
            receivedQuantity: receivedDefault,
            expectedQuantity: orderedQtyNormalized ?? 0,
            requestedQuantity: item.requestedQuantity ?? item.requisitionItem.quantity,
            orderedQuantity: orderedQtyNormalized,
            unit: item.quoteItem?.unit || item.requisitionItem.unit,
            issueType: item.receiptStatus?.issueType || null,
            issueDescription: item.receiptStatus?.issueDescription || null,
            putAwayBoxId:
              item.requisitionItem.addToInventory !== false ? defaultBox ?? "" : "",
            putAwayRobLocation: "",
            requisitionItem: item.requisitionItem,
            quoteItem: item.quoteItem,
            missingOrderedQty: orderedQty == null,
          };
        });
        
        const initialBoxId = defaultBox ?? "";
        sessionPutAwayBoxIdRef.current = initialBoxId;
        setPortOfReceived(data.requisition?.portOfSupply?.trim() ?? "");
        setReceivedDate(format(new Date(), "yyyy-MM-dd"));
        setReceiptItems(items);
        setIsReceiptDialogOpen(true);
      } else {
        toast.error("Failed to load delivery note details");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error loading delivery note");
    }
  };

  useEffect(() => {
    const dnId = searchParams.get("dnId");
    if (!dnId || deliveryNotes.length === 0) return;
    const dn = deliveryNotes.find((d) => d.id === dnId);
    if (dn) void handleConfirmReceipt(dn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, deliveryNotes]);

  // Update item status
  const applySessionPutAwayBox = (items: any[], boxId: string) =>
    items.map((item) =>
      item.requisitionItem?.addToInventory === false
        ? item
        : { ...item, putAwayBoxId: boxId }
    );

  const updateItemStatus = (index: number, field: string, value: any) => {
    if (field === "putAwayBoxId") {
      const boxId = String(value);
      sessionPutAwayBoxIdRef.current = boxId;
      setReceiptItems((prev) => applySessionPutAwayBox(prev, boxId));
      return;
    }

    setReceiptItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, [field]: value };
        const addToInventory = next.requisitionItem?.addToInventory !== false;

        if (field === "receivedQuantity") {
          const received = Math.max(
            0,
            Math.round(normalizeReceiptQuantity(Number(value) || 0))
          );
          next.receivedQuantity = received;
          const ordered = normalizeReceiptQuantity(
            Number(next.orderedQuantity ?? next.expectedQuantity) || 0
          );
          if (next.status === "RECEIVED" || next.status === "QUANTITY_MISMATCH") {
            next.status = resolveReceiptLineStatus("RECEIVED", received, ordered);
          }
          if (
            addToInventory &&
            (next.status === "RECEIVED" || next.status === "QUANTITY_MISMATCH") &&
            sessionPutAwayBoxIdRef.current
          ) {
            next.putAwayBoxId = sessionPutAwayBoxIdRef.current;
          }
        }

        if (field === "status") {
          const received = normalizeReceiptQuantity(Number(next.receivedQuantity) || 0);
          const ordered = normalizeReceiptQuantity(
            Number(next.orderedQuantity ?? next.expectedQuantity) || 0
          );
          if (value === "RECEIVED") {
            next.status = resolveReceiptLineStatus("RECEIVED", received, ordered);
          }
          if (
            addToInventory &&
            (next.status === "RECEIVED" || next.status === "QUANTITY_MISMATCH") &&
            sessionPutAwayBoxIdRef.current
          ) {
            next.putAwayBoxId = sessionPutAwayBoxIdRef.current;
          }
        }

        return next;
      })
    );
  };

  useEffect(() => {
    if (receiptItems.length === 0) return;
    setOverallStatus(
      computeOverallReceiptStatus(
        receiptItems.map((item) => ({
          status: item.status as ReceiptLineStatus,
          receivedQuantity: item.receivedQuantity,
          orderedQuantity: item.orderedQuantity ?? item.expectedQuantity,
        }))
      )
    );
  }, [receiptItems]);

  // Submit receipt confirmation
  const handleSubmitReceipt = async () => {
    if (!selectedDeliveryNote) return;

    // Validate at least one item has status
    const hasValidItems = receiptItems.some(
      (item) => item.status && item.receivedQuantity >= 0
    );

    if (!hasValidItems) {
      toast.error("Please set status for at least one item");
      return;
    }

    const missingOrdered = receiptItems.some((item) => item.missingOrderedQty);
    if (missingOrdered) {
      toast.error(
        "One or more lines have no ordered quantity on the quote. Contact shore before confirming receipt."
      );
      return;
    }

    const port = portOfReceived.trim();
    if (!port) {
      toast.error("Port of received is required");
      return;
    }

    if (!receivedDate) {
      toast.error("Date of received is required");
      return;
    }

    const computedOverall = overallStatus;

    setSubmitting(true);
    try {
      const payload = {
        deliveryNoteId: selectedDeliveryNote.deliveryNote.id,
        requisitionId: selectedDeliveryNote.requisition.id,
        vendorQuoteId: selectedDeliveryNote.vendorQuote.id,
        overallStatus: computedOverall,
        portOfReceived: port,
        receivedDate,
        notes: confirmationNotes,
        items: receiptItems.map((item) => ({
          requisitionItemId: item.requisitionItemId,
          vendorQuoteItemId: item.vendorQuoteItemId,
          status: item.status,
          receivedQuantity: item.receivedQuantity,
          expectedQuantity: item.expectedQuantity,
          unit: item.unit,
          issueType: item.issueType || undefined,
          issueDescription: item.issueDescription || undefined,
          putAway:
            item.status === "RECEIVED" &&
            item.requisitionItem?.addToInventory !== false &&
            item.putAwayBoxId
              ? {
                  boxId: item.putAwayBoxId,
                  currentRobLocation: item.putAwayRobLocation || null,
                }
              : item.putAwayRobLocation
                ? { currentRobLocation: item.putAwayRobLocation }
                : undefined,
        })),
      };

      const res = await fetch("/api/requisitions/receipt-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setLastInventoryResults(data.inventoryResults ?? []);
        const added = (data.inventoryResults ?? []).filter(
          (r: { outcome: string }) => r.outcome === "ADDED" || r.outcome === "INCREMENTED"
        ).length;
        const pending = (data.inventoryResults ?? []).filter(
          (r: { outcome: string }) => r.outcome === "PENDING_PUTAWAY"
        ).length;
        const skipped = (data.inventoryResults ?? []).filter(
          (r: { outcome: string }) =>
            r.outcome.startsWith("SKIPPED") && r.outcome !== "SKIPPED_NOT_RECEIVED"
        ).length;
        toast.success(
          `Receipt confirmed. Inventory: ${added} updated${pending ? `, ${pending} pending put-away` : ""}${skipped ? `, ${skipped} skipped` : ""}.`
        );
        if (pending > 0) {
          toast.info("Assign storage locations in Spares → Assign locations", {
            action: {
              label: "Open",
              onClick: () => {
                window.location.href = "/technical/spares-inventory/assign-location";
              },
            },
          });
        }
        setIsReceiptDialogOpen(false);
        setSelectedDeliveryNote(null);
        setReceiptItems([]);
        setConfirmationNotes("");
        setPortOfReceived("");
        setReceivedDate("");
        fetchDeliveryNotes();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to submit receipt confirmation");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error submitting receipt confirmation");
    } finally {
      setSubmitting(false);
    }
  };

  return (<PageReadyGate ready={ready}>
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Onboard Receipt Confirmation</h1>
            <p className="text-muted-foreground">
            Confirm actual quantities received onboard against <strong>ordered</strong> quantities
            (PO quote lines). Access levels 20–24. SPR lines with Add to inventory update{" "}
            <Link href="/technical/spares-inventory/inventory" className="text-primary underline">
              Spares inventory
            </Link>
            .
          </p>
        </div>
      </div>

      {!canConfirmReceipt && currentUserAccessLevel != null && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Access restricted
          </div>
          <p className="mt-1">
            Only crew with access levels 20–24 can confirm onboard receipt quantities.
          </p>
        </div>
      )}

      {/* Filters */}
      <Card variant="filter">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Vessel</Label>
              <FilterFieldShell
                showClear={Boolean(selectedVessel)}
                onClear={() => setSelectedVessel("")}
                hasDropdownChevron
              >
                <Select value={selectedVessel} onValueChange={setSelectedVessel}>
                  <SelectTrigger
                    width="vessel"
                    className={filterTriggerClearPadding(Boolean(selectedVessel), true)}
                  >
                    <SelectValue placeholder="Select vessel" />
                  </SelectTrigger>
                  <SelectContent>
                    {vessels.map((v: any) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterFieldShell>
            </div>
            <div>
              <Label>Search</Label>
              <FilterFieldShell
                showClear={searchTerm.length > 0}
                onClear={() => setSearchTerm("")}
                className="max-w-none"
              >
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-2.5 z-0 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by DN, PO, requisition, vendor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={cn("pl-8", searchTerm && "pr-7")}
                  />
                </div>
              </FilterFieldShell>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Notes List */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Receipt Confirmations</CardTitle>
          <CardDescription>
            Delivery notes with an uploaded or verified DN, awaiting onboard receipt confirmation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-blue-600 mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">Loading delivery notes...</p>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p>No pending delivery notes found</p>
              <p className="text-xs mt-2 max-w-md mx-auto">
                A PO appears here after its DN is uploaded or verified on{" "}
                <Link href="/purchase/dn-status" className="text-primary underline">
                  DN Status
                </Link>{" "}
                and receipt has not been confirmed yet.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                      <TableSerialHead />
                  <TableHead>Delivery Note</TableHead>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Requisition</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Delivery Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNotes.map((dn, index) => (
                  <TableRow key={dn.id}>
                    <TableSerialCell serialNo={index + 1} />
                    <TableCell className="font-medium">{dn.deliveryNoteNumber}</TableCell>
                    <TableCell className="font-medium">
                      {dn.purchaseOrder?.poNumber ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{dn.vendorQuote.requisition.requisitionNumber}</div>
                        <div className="text-xs text-muted-foreground">{dn.vendorQuote.requisition.heading}</div>
                      </div>
                    </TableCell>
                    <TableCell>{dn.vendorQuote.vendor.name}</TableCell>
                    <TableCell>
                      {format(new Date(dn.deliveryDate), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={dn.status === "VERIFIED" ? "default" : "secondary"}>
                        {dn.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleConfirmReceipt(dn)}
                        disabled={!canConfirmReceipt}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" /> Confirm Receipt
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Receipt Confirmation Dialog */}
      <Dialog open={isReceiptDialogOpen} onOpenChange={setIsReceiptDialogOpen}>
        <DialogContent className="max-h-[92vh] w-[min(96vw,72rem)] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirm Receipt - {selectedDeliveryNote?.deliveryNote.deliveryNoteNumber}</DialogTitle>
            <DialogDescription>
              Enter received quantities against ordered (PO quote) quantities — not requisition requested qty.
            </DialogDescription>
          </DialogHeader>

          {selectedDeliveryNote && (
            <div className="space-y-4">
              {/* Requisition Info */}
              <div className="p-4 bg-info border border-border rounded-lg">
                <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                  <div className="space-y-1.5">
                    <div>
                      <span className="font-medium">Requisition:</span>{" "}
                      {selectedDeliveryNote.requisition.requisitionNumber}
                    </div>
                    <div>
                      <span className="font-medium">Vessel:</span>{" "}
                      {selectedDeliveryNote.requisition.vessel.name}
                    </div>
                    <div>
                      <span className="font-medium">Delivery Date:</span>{" "}
                      {format(
                        new Date(selectedDeliveryNote.deliveryNote.deliveryDate),
                        "dd MMM yyyy"
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div>
                      <span className="font-medium">PO Number:</span>{" "}
                      {selectedDeliveryNote.purchaseOrder?.poNumber ?? "—"}
                    </div>
                    <div>
                      <span className="font-medium">Vendor:</span>{" "}
                      {selectedDeliveryNote.vendor.name}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor="portOfReceived" className="text-xs font-medium">
                        Port of received <span className="text-destructive">*</span>
                      </Label>
                      <Popover open={portComboboxOpen} onOpenChange={setPortComboboxOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            id="portOfReceived"
                            variant="outline"
                            role="combobox"
                            type="button"
                            className={cn(
                              "mt-1 h-8 w-full justify-between bg-background text-left text-xs font-normal",
                              !portOfReceived && "text-muted-foreground"
                            )}
                          >
                            <span className="truncate">
                              {portOfReceived || "Search port..."}
                            </span>
                            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[var(--radix-popover-trigger-width)] p-0"
                          align="start"
                        >
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder="Search ports..."
                              value={portSearchQuery}
                              onValueChange={setPortSearchQuery}
                            />
                            <CommandList>
                              <CommandEmpty>
                                {portSearchLoading
                                  ? "Searching..."
                                  : portSearchQuery.trim().length < 2
                                    ? "Type at least 2 characters"
                                    : "No ports found."}
                              </CommandEmpty>
                              <CommandGroup>
                                {portSearchResults.map((port) => (
                                  <CommandItem
                                    key={port.id}
                                    value={`${port.name} ${port.country ?? ""} ${port.code ?? ""}`}
                                    onSelect={() => {
                                      setPortOfReceived(port.name);
                                      setPortComboboxOpen(false);
                                      setPortSearchQuery("");
                                      setPortSearchResults([]);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        portOfReceived === port.name
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    <span className="truncate">
                                      {port.name}
                                      {port.code ? ` (${port.code})` : ""}
                                      {port.country ? ` — ${port.country}` : ""}
                                    </span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label htmlFor="receivedDate" className="text-xs font-medium">
                        Date of received <span className="text-destructive">*</span>
                      </Label>
                      <DatePicker
                        id="receivedDate"
                        value={receivedDate}
                        onChange={setReceivedDate}
                        placeholder="Pick date"
                        className="mt-1 h-8 bg-background text-xs"
                        triggerClassName="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Overall Status (derived from line qty vs ordered) */}
              <div>
                <Label>Overall Receipt Status</Label>
                <div className="mt-2">
                  <Badge
                    variant={
                      overallStatus === "FULLY_RECEIVED"
                        ? "default"
                        : overallStatus === "NOT_RECEIVED"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {overallStatus.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>

              {/* Items */}
              <div className="rounded-md border overflow-hidden">
                <Table variant="dense" className="w-full text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
                      <TableHead className="w-8 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        #
                      </TableHead>
                      <TableHead className="min-w-[9rem] max-w-[11rem] px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Item
                      </TableHead>
                      <TableHead className="w-[4.5rem] px-1 pr-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Req
                      </TableHead>
                      <TableHead className="w-[4.5rem] pl-3 px-1 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Ord
                      </TableHead>
                      <TableHead className="w-[4.25rem] px-1 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Rcv
                      </TableHead>
                      <TableHead className="w-10 px-1 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Var
                      </TableHead>
                      <TableHead className="w-[7.5rem] px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Status
                      </TableHead>
                      <TableHead className="min-w-[8.25rem] px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Box / type
                      </TableHead>
                      <TableHead className="min-w-[6rem] px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        ROB / issue
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receiptItems.map((receiptItem: any, index: number) => {
                      const item =
                        receiptItem.requisitionItem ||
                        selectedDeliveryNote.items[index]?.requisitionItem;
                      if (!item) return null;

                      const itemLabel = item.partName || item.itemName;
                      const itemTitle = [
                        item.partNumber,
                        itemLabel,
                        item.manualMachineryName,
                      ]
                        .filter(Boolean)
                        .join(" · ");

                      const orderedQty =
                        receiptItem.orderedQuantity ??
                        receiptItem.expectedQuantity ??
                        receiptItem.quoteItem?.quantity ??
                        null;
                      const requestedQty =
                        receiptItem.requestedQuantity ?? item.quantity;
                      const variance =
                        orderedQty != null
                          ? receiptQuantityVariance(
                              Number(receiptItem.receivedQuantity) || 0,
                              orderedQty
                            )
                          : null;
                      const showPutAway =
                        item.addToInventory !== false &&
                        (receiptItem.status === "RECEIVED" ||
                          receiptItem.status === "QUANTITY_MISMATCH");
                      const showIssues =
                        receiptItem.status !== "RECEIVED" &&
                        receiptItem.status !== "QUANTITY_MISMATCH";
                      const unitLabel = receiptItem.unit || "";

                      return (
                        <TableRow
                          key={receiptItem.requisitionItemId || item.id}
                          className="align-middle even:bg-muted/15"
                        >
                          <TableCell className="px-2 py-1.5 text-muted-foreground tabular-nums">
                            {index + 1}
                          </TableCell>
                          <TableCell className="max-w-[11rem] px-2 py-1.5">
                            <p
                              className="line-clamp-2 break-words text-xs font-medium leading-snug"
                              title={itemTitle}
                            >
                              {item.partNumber ? (
                                <span className="text-muted-foreground">{item.partNumber}</span>
                              ) : null}
                              {item.partNumber ? " · " : null}
                              {itemLabel}
                            </p>
                          </TableCell>
                          <TableCell className="px-1 pr-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                            <span>{requestedQty}</span>
                            {unitLabel ? (
                              <span className="ml-0.5 text-[10px] text-muted-foreground">
                                {unitLabel}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="pl-3 px-1 py-1.5 text-right tabular-nums whitespace-nowrap">
                            {orderedQty != null ? (
                              <>
                                <span className="font-medium">{orderedQty}</span>
                                {unitLabel ? (
                                  <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">
                                    {unitLabel}
                                  </span>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-destructive">—</span>
                            )}
                          </TableCell>
                          <TableCell className="px-1 py-1.5">
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              value={Number(receiptItem.receivedQuantity) || 0}
                              onChange={(e) =>
                                updateItemStatus(
                                  index,
                                  "receivedQuantity",
                                  e.target.value === ""
                                    ? 0
                                    : Number(e.target.value)
                                )
                              }
                              className="h-7 w-[3.25rem] min-w-0 px-1 text-right text-xs tabular-nums"
                            />
                          </TableCell>
                          <TableCell className="px-1 py-1.5 text-right tabular-nums whitespace-nowrap">
                            {variance != null ? (
                              <span
                                className={
                                  variance === 0
                                    ? "text-muted-foreground"
                                    : variance > 0
                                      ? "font-medium text-amber-700"
                                      : "font-medium text-destructive"
                                }
                              >
                                {variance > 0 ? "+" : ""}
                                {variance}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="px-2 py-1.5">
                            <Select
                              value={receiptItem.status}
                              onValueChange={(v) => updateItemStatus(index, "status", v)}
                            >
                              <SelectTrigger className="h-7 w-full min-w-0 border-muted-foreground/20 px-1.5 text-[11px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="RECEIVED">Received</SelectItem>
                                <SelectItem value="NOT_RECEIVED">Not Received</SelectItem>
                                <SelectItem value="RETURNED">Returned</SelectItem>
                                <SelectItem value="INCORRECT">Incorrect</SelectItem>
                                <SelectItem value="QUANTITY_MISMATCH">Qty Mismatch</SelectItem>
                                <SelectItem value="OTHER_ISSUE">Other Issue</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="min-w-[8.25rem] px-2 py-1.5">
                            {showIssues ? (
                              <Input
                                placeholder="Issue type"
                                value={receiptItem.issueType || ""}
                                onChange={(e) =>
                                  updateItemStatus(index, "issueType", e.target.value)
                                }
                                className="h-7 w-full min-w-0 px-1.5 text-xs"
                              />
                            ) : showPutAway ? (
                              <Select
                                value={receiptItem.putAwayBoxId || ""}
                                onValueChange={(v) =>
                                  updateItemStatus(index, "putAwayBoxId", v)
                                }
                              >
                                <SelectTrigger className="h-7 w-full min-w-0 px-1.5 text-xs">
                                  <SelectValue placeholder="Select box" />
                                </SelectTrigger>
                                <SelectContent>
                                  {vesselBoxes.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>
                                      {b.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="px-2 py-1.5">
                            {showIssues ? (
                              <Input
                                placeholder="Describe issue…"
                                value={receiptItem.issueDescription || ""}
                                onChange={(e) =>
                                  updateItemStatus(index, "issueDescription", e.target.value)
                                }
                                className="h-7 w-full min-w-0 px-1.5 text-xs"
                              />
                            ) : showPutAway ? (
                              <Input
                                placeholder="ROB / shelf"
                                value={receiptItem.putAwayRobLocation || ""}
                                onChange={(e) =>
                                  updateItemStatus(index, "putAwayRobLocation", e.target.value)
                                }
                                className="h-7 w-full min-w-0 px-1.5 text-xs"
                              />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Notes */}
              <div>
                <Label>Additional Notes</Label>
                <Textarea
                  placeholder="Any additional comments about the receipt..."
                  value={confirmationNotes}
                  onChange={(e) => setConfirmationNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsReceiptDialogOpen(false);
                setSelectedDeliveryNote(null);
                setReceiptItems([]);
                setConfirmationNotes("");
                setPortOfReceived("");
                setReceivedDate("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReceipt}
              disabled={
                submitting ||
                !canConfirmReceipt ||
                !portOfReceived.trim() ||
                !receivedDate
              }
            >
              {submitting ? "Submitting..." : "Confirm Receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
        </PageReadyGate>
  );
}
