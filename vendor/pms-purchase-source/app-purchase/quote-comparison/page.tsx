"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Upload, Download, Eye, Edit, Search, Filter, X, AlertCircle, CheckCircle2, Ship } from "lucide-react";
import ActiniumLoader from "@/components/ActiniumLoader";
import { toast } from "sonner";
import { uploadDeliveryNote } from "@/lib/purchase/upload-delivery-note-client";
import { MAX_PURCHASE_ATTACHMENT_BYTES } from "@/lib/purchase/purchase-file-limits";
import { useVessels } from "@/hooks/useStaticData";
import {
  ClearableInput,
  FilterFieldShell,
  filterTriggerClearPadding,
} from "@/components/ui/clearable-input";
import { cn } from "@/lib/utils";
import { TableSerialHead, TableSerialCell } from "@/components/ui/table-serial-column";
import { tableSerialNo } from "@/lib/table-serial-column";

interface PurchaseOrder {
  id: string;
  poNumber: string;
  dateOfIssue: Date;
  totalAmount: number | null;
  currency: string;
  status: string;
  requisition: {
    id: string;
    requisitionNumber: string;
    heading: string;
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
      name: string;
    };
  };
  deliveryNote?: {
    id: string;
    deliveryNoteNumber: string;
    deliveryDate: Date;
    status: string;
    fileUrl: string | null;
    fileName: string | null;
    uploadedAt: Date;
  } | null;
}

export default function DNStatusPage() {
  const router = useRouter();
  const { ready, markSuccess } = usePageBootstrap();

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);
  const [userAccessLevel, setUserAccessLevel] = useState<number | null>(null);

  // Use optimized hooks for static data with caching
  const { data: vessels = [], isLoading: vesselsLoading } = useVessels({ limit: 100, isActive: true });

  const [selectedVesselId, setSelectedVesselId] = useState<string>("");

  // Restrict quote comparison / DN Status to access level > 25
  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile/basic", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const level = data?.user?.designationAccessLevel ?? null;
        setUserAccessLevel(level);
        if (level != null && level <= 25) {
          toast.error("You do not have access to this page.");
          router.replace("/purchase/view-requisitions");
          return;
        }
        setAccessChecked(true);
      })
      .catch(() => {
        if (!cancelled) setAccessChecked(true);
      });
    return () => { cancelled = true; };
  }, [router]);

  // Filters
  const [poNumberFilter, setPoNumberFilter] = useState("");
  const [poDetailsFilter, setPoDetailsFilter] = useState("");
  const [deliveryPortFilter, setDeliveryPortFilter] = useState("");
  const [dnStatusFilter, setDnStatusFilter] = useState<string>("all"); // "all", "uploaded", "not_uploaded"
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dnNumber, setDnNumber] = useState("");
  const [dnDate, setDnDate] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Initialize page once static data is loaded
  useEffect(() => {
    if (!vesselsLoading) {
      markSuccess();
    }
  }, [vesselsLoading, markSuccess]);

  useEffect(() => {
    if (!accessChecked || (userAccessLevel != null && userAccessLevel <= 25)) return;
    if (selectedVesselId) {
      fetchPurchaseOrders();
    } else {
      setPurchaseOrders([]);
      setFilteredOrders([]);
    }
  }, [selectedVesselId, accessChecked, userAccessLevel]);

  useEffect(() => {
    applyFilters();
  }, [purchaseOrders, poNumberFilter, poDetailsFilter, deliveryPortFilter, dnStatusFilter, selectedVesselId]);

  const fetchPurchaseOrders = async () => {
    if (!selectedVesselId) {
      setPurchaseOrders([]);
      setFilteredOrders([]);
      setLoading(false);
      markSuccess();
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/purchase-orders/list?vesselId=${selectedVesselId}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch purchase orders");
      }

      const data = await response.json();
      setPurchaseOrders(data.purchaseOrders || []);
    } catch (err) {
      console.error("Error fetching purchase orders:", err);
      setError(err instanceof Error ? err.message : "Failed to load purchase orders");
      toast.error("Failed to load purchase orders");
    } finally {
      setLoading(false);
      markSuccess();
    }
  };

  const applyFilters = () => {
    let filtered = [...purchaseOrders];

    // PO Number filter
    if (poNumberFilter) {
      filtered = filtered.filter((po) =>
        po.poNumber.toLowerCase().includes(poNumberFilter.toLowerCase())
      );
    }

    // PO Details filter (heading)
    if (poDetailsFilter) {
      filtered = filtered.filter((po) =>
        po.requisition.heading.toLowerCase().includes(poDetailsFilter.toLowerCase())
      );
    }

    // Delivery Port filter
    if (deliveryPortFilter) {
      filtered = filtered.filter((po) =>
        po.requisition.portOfSupply?.toLowerCase().includes(deliveryPortFilter.toLowerCase())
      );
    }

    // DN Status filter
    if (dnStatusFilter === "uploaded") {
      filtered = filtered.filter((po) => po.deliveryNote !== null && po.deliveryNote !== undefined);
    } else if (dnStatusFilter === "not_uploaded") {
      filtered = filtered.filter((po) => !po.deliveryNote || po.deliveryNote === null);
    }

    setFilteredOrders(filtered);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [poNumberFilter, poDetailsFilter, deliveryPortFilter, dnStatusFilter, selectedVesselId, itemsPerPage, filteredOrders.length]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

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

    try {
      setUploading(true);

      await uploadDeliveryNote({
        file: selectedFile,
        purchaseOrderId: selectedPO.id,
        quoteId: selectedPO.quote.id,
        deliveryNoteNumber: dnNumber,
        deliveryDate: dnDate,
      });

      toast.success("Delivery note uploaded successfully");
      
      // Reset form
      setSelectedFile(null);
      setDnNumber("");
      setDnDate("");
      setUploadDialogOpen(false);
      setSelectedPO(null);

      // Refresh purchase orders
      await fetchPurchaseOrders();
    } catch (err) {
      console.error("Error uploading delivery note:", err);
      toast.error(err instanceof Error ? err.message : "Failed to upload delivery note");
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (po: PurchaseOrder) => {
    setSelectedPO(po);
    if (po.deliveryNote) {
      setDnNumber(po.deliveryNote.deliveryNoteNumber);
      setDnDate(new Date(po.deliveryNote.deliveryDate).toISOString().split("T")[0]);
    } else {
      setDnNumber("");
      setDnDate("");
    }
    setSelectedFile(null);
    setUploadDialogOpen(true);
  };

  const handleView = (fileUrl: string) => {
    window.open(fileUrl, "_blank");
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || "delivery-note.pdf";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Error downloading file:", err);
      toast.error("Failed to download file");
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

  // Access level 25 or less cannot access quote comparison / DN Status
  if (userAccessLevel != null && userAccessLevel <= 25) {
    return null;
  }

  return (<PageReadyGate ready={ready}>
    <div className="space-y-4">
      <main className="mx-auto py-4" style={{ width: "90%", maxWidth: "90vw" }}>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">DN Status</h1>
          <p className="text-foreground">
            Upload and manage delivery notes for purchase orders
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Vessel Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ship className="h-5 w-5" />
              Select Vessel
            </CardTitle>
            <CardDescription>
              Select a vessel to view its purchase orders
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full max-w-md">
              <Label htmlFor="vessel" className="mb-2 block">
                Vessel
              </Label>
              <Select value={selectedVesselId} onValueChange={setSelectedVesselId}>
                <SelectTrigger id="vessel" width="vessel">
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
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        {selectedVesselId && (
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    <Select value={dnStatusFilter} onValueChange={setDnStatusFilter}>
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
                        <SelectItem value="uploaded">DN Uploaded</SelectItem>
                        <SelectItem value="not_uploaded">DN Not Uploaded</SelectItem>
                      </SelectContent>
                    </Select>
                  </FilterFieldShell>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                      <TableCell colSpan={11} className="py-14">
                        <div className="flex justify-center">
                          <ActiniumLoader size="md" text="Loading purchase orders…" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableSerialCell serialNo={1} />
                      <TableCell colSpan={11} className="text-center py-4 text-muted-foreground">
                        No purchase orders found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedOrders.map((po, index) => (
                      <TableRow key={po.id}>
                        <TableSerialCell serialNo={tableSerialNo(currentPage, itemsPerPage, index)} />
                        <TableCell className="font-medium">{po.poNumber}</TableCell>
                        <TableCell>{formatDate(po.dateOfIssue)}</TableCell>
                        <TableCell>{po.requisition.requisitionNumber}</TableCell>
                        <TableCell>{po.requisition.heading}</TableCell>
                        <TableCell>
                          {po.requisition.vessel
                            ? `${po.requisition.vessel.name} (${po.requisition.vessel.code})`
                            : "N/A"}
                        </TableCell>
                        <TableCell>{po.requisition.portOfSupply || "N/A"}</TableCell>
                        <TableCell>{po.quote.vendor.name}</TableCell>
                        <TableCell>{formatCurrency(po.totalAmount, po.currency)}</TableCell>
                        <TableCell>
                          {po.deliveryNote ? (
                            <Badge className="bg-success text-white">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              DN Received
                            </Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {po.deliveryNote ? (
                              <>
                                {po.deliveryNote.fileUrl && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleView(po.deliveryNote!.fileUrl!)}
                                      title="View DN"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        handleDownload(
                                          po.deliveryNote!.fileUrl!,
                                          po.deliveryNote!.fileName || "delivery-note.pdf"
                                        )
                                      }
                                      title="Download DN"
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              <Dialog open={uploadDialogOpen && selectedPO?.id === po.id} onOpenChange={setUploadDialogOpen}>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(po)}
                                    title="Edit/Re-upload DN"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent >
                                  <DialogHeader>
                                    <DialogTitle>Edit/Re-upload Delivery Note</DialogTitle>
                                    <DialogDescription>
                                      Re-upload delivery note for PO: {po.poNumber}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div>
                                      <Label htmlFor="dnNumberEdit">DN Number *</Label>
                                      <Input
                                        id="dnNumberEdit"
                                        value={dnNumber}
                                        onChange={(e) => setDnNumber(e.target.value)}
                                        placeholder="Enter DN number"
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="dnDateEdit">Delivery Date *</Label>
                                      <Input
                                        id="dnDateEdit"
                                        type="date"
                                        value={dnDate}
                                        onChange={(e) => setDnDate(e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="fileEdit">DN File (PDF) *</Label>
                                      <Input
                                        id="fileEdit"
                                        type="file"
                                        accept="application/pdf"
                                        onChange={handleFileSelect}
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
                                        {uploading ? "Uploading..." : "Re-upload"}
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                              </>
                            ) : (
                              <Dialog open={uploadDialogOpen && selectedPO?.id === po.id} onOpenChange={setUploadDialogOpen}>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedPO(po);
                                      setDnNumber("");
                                      setDnDate("");
                                      setSelectedFile(null);
                                    }}
                                  >
                                    <Upload className="h-4 w-4 mr-2" />
                                    Upload DN
                                  </Button>
                                </DialogTrigger>
                                <DialogContent >
                                  <DialogHeader>
                                    <DialogTitle>
                                      {selectedPO?.deliveryNote ? "Edit/Re-upload Delivery Note" : "Upload Delivery Note"}
                                    </DialogTitle>
                                    <DialogDescription>
                                      {selectedPO?.deliveryNote 
                                        ? `Re-upload delivery note for PO: ${po.poNumber}`
                                        : `Upload delivery note for PO: ${po.poNumber}`}
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
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="dnDate">Delivery Date *</Label>
                                      <Input
                                        id="dnDate"
                                        type="date"
                                        value={dnDate}
                                        onChange={(e) => setDnDate(e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="file">DN File (PDF) *</Label>
                                      <Input
                                        id="file"
                                        type="file"
                                        accept="application/pdf"
                                        onChange={handleFileSelect}
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
                                        {uploading ? "Uploading..." : "Upload"}
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
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
      </main>
    </div>
        </PageReadyGate>
  );
}

