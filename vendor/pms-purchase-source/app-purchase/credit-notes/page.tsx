"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Upload,
  Download,
  Calendar,
  DollarSign,
  Search,
  X,
  Loader2,
  CheckCircle2,
  Ship,
  AlertCircle,
  Mail,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import ActiniumLoader from "@/components/ActiniumLoader";
import { useVessels } from "@/hooks/useStaticData";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { TableSerialHead, TableSerialCell } from "@/components/ui/table-serial-column";
import { tableSerialNo } from "@/lib/table-serial-column";

interface PurchaseOrder {
  id: string;
  poNumber: string;
  requisition: {
    id: string;
    requisitionNumber: string;
    heading: string;
    vessel: {
      name: string;
      code: string;
    };
  };
  quote: {
    vendor: {
      name: string;
    };
  };
}

interface CreditNote {
  id: string;
  creditNoteNumber: string | null;
  amount: number;
  currency: string;
  date: string;
  pdfUrl: string | null;
  pdfFileName: string | null;
  description: string | null;
  status?: "PENDING" | "CONFIRMED" | "REJECTED";
  vendorConfirmedAt?: string | null;
  purchaseOrder: {
    id: string;
    poNumber: string;
    requisition: {
      id: string;
      requisitionNumber: string;
      heading: string;
      vessel: {
        id: string;
        name: string;
        code: string;
      };
    };
    quote: {
      vendor: {
        id: string;
        name: string;
      };
    };
  };
  uploadedBy: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function CreditNotesPage() {
  const router = useRouter();
  // Don't block page rendering - stop loader immediately
  const { ready, markSuccess } = usePageBootstrap();
  const { data: vessels = [], isLoading: vesselsLoading } = useVessels({ limit: 100, isActive: true });
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [filteredPurchaseOrders, setFilteredPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [userAccessLevel, setUserAccessLevel] = useState<number | null>(null);
  const [isVendor, setIsVendor] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  // Form state
  const [selectedVesselId, setSelectedVesselId] = useState<string>("");
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState<string>("");
  const [creditNoteNumber, setCreditNoteNumber] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [currency, setCurrency] = useState<string>("USD");
  const [date, setDate] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Check user access and vendor status - parallel check
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { fetchJsonWithTimeout } = await import('@/lib/utils/fetch-with-timeout');
        
        // Check both user and vendor in parallel
        const [userResult, vendorResult] = await Promise.allSettled([
          fetchJsonWithTimeout<{ user: any }>("/api/profile/basic", {
            timeout: 8000,
            credentials: "include",
          }),
          fetchJsonWithTimeout<{ vendor: any }>("/api/vendor-auth/me", {
            timeout: 8000,
            credentials: "include",
          })
        ]);
        
        let hasAccess = false;
        
        // Check user access
        if (userResult.status === 'fulfilled') {
          const accessLevel = userResult.value.user?.designationAccessLevel || 0;
          setUserAccessLevel(accessLevel);
          if ([32, 33, 50, 99, 100].includes(accessLevel)) {
            hasAccess = true;
          }
        }
        
        // Check vendor access
        if (vendorResult.status === 'fulfilled' && vendorResult.value.vendor) {
          setIsVendor(true);
          setVendorId(vendorResult.value.vendor.id);
          hasAccess = true;
        }
        
        if (!hasAccess) {
          toast.error("Access denied. Only users with access level 32, 33, 50, 99, 100, or vendors can access credit notes.");
          router.push("/unauthorized");
          return;
        }
        
        // Stop loading immediately
        markSuccess();
        
        // Fetch credit notes in background
        fetchCreditNotes();
      } catch (error: any) {
        console.error("Error checking access:", error);
        if (error.message?.includes('timeout')) {
          toast.error("Failed to verify access. Please refresh the page.");
        }
        markSuccess();
      }
    };
    
    checkAccess();
  }, [router, markSuccess]);

  // Initialize vessel selection from URL params or localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && !selectedVesselId) {
      // Priority 1: URL params
      const params = new URLSearchParams(window.location.search);
      const urlVesselId = params.get('vesselId');
      
      if (urlVesselId) {
        setSelectedVesselId(urlVesselId);
        // Save to localStorage for persistence
        try {
          localStorage.setItem('lastSelectedVesselId', urlVesselId);
          localStorage.setItem('selectedVesselId', urlVesselId);
        } catch (e) {
          console.error('Error saving to localStorage:', e);
        }
        return;
      }
      
      // Priority 2: localStorage (fallback)
      try {
        const lastVesselId = localStorage.getItem('lastSelectedVesselId') || localStorage.getItem('selectedVesselId');
        if (lastVesselId) {
          setSelectedVesselId(lastVesselId);
        }
      } catch (e) {
        console.error('Error accessing localStorage:', e);
      }
    }
  }, []);

  // Save selected vessel to localStorage when it changes
  useEffect(() => {
    if (selectedVesselId && typeof window !== 'undefined') {
      try {
        localStorage.setItem('lastSelectedVesselId', selectedVesselId);
        // Also save to selectedVesselId for compatibility with useVesselSelection hook
        localStorage.setItem('selectedVesselId', selectedVesselId);
      } catch (e) {
        console.error('Error saving to localStorage:', e);
      }
    }
  }, [selectedVesselId]);

  // Fetch purchase orders when vessel is selected
  useEffect(() => {
    if (selectedVesselId) {
      fetchPurchaseOrders(selectedVesselId);
    } else {
      setFilteredPurchaseOrders([]);
      setSelectedPurchaseOrderId("");
    }
  }, [selectedVesselId]);

  const fetchCreditNotes = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/credit-notes", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setCreditNotes(data.creditNotes || []);
      } else {
        toast.error("Failed to fetch credit notes");
      }
    } catch (error) {
      console.error("Error fetching credit notes:", error);
      toast.error("Failed to fetch credit notes");
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchaseOrders = async (vesselId?: string) => {
    try {
      const url = vesselId 
        ? `/api/purchase-orders/list?vesselId=${vesselId}`
        : "/api/purchase-orders/list";
      
      const { fetchJsonWithTimeout } = await import('@/lib/utils/fetch-with-timeout');
      const data = await fetchJsonWithTimeout<{ purchaseOrders: PurchaseOrder[] }>(url, {
        timeout: 12000,
        credentials: "include",
      });
      const orders = data.purchaseOrders || [];
      setPurchaseOrders(orders);
      
      // If vendor, filter to only their purchase orders
      if (isVendor && vendorId) {
        const vendorOrders = orders.filter((po: PurchaseOrder) => 
          po.quote?.vendor?.id === vendorId
        );
        setFilteredPurchaseOrders(vendorOrders);
      } else {
        setFilteredPurchaseOrders(orders);
      }
    } catch (error: any) {
      console.error("Error fetching purchase orders:", error);
      if (error.message?.includes('timeout')) {
        console.warn("Purchase orders fetch timed out");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast.error("Please upload a PDF file");
        return;
      }
      setPdfFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedVesselId) {
      toast.error("Please select a vessel");
      return;
    }

    if (!selectedPurchaseOrderId || !amount || !date || !pdfFile) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("purchaseOrderId", selectedPurchaseOrderId);
      formData.append("vesselId", selectedVesselId);
      formData.append("creditNoteNumber", creditNoteNumber);
      formData.append("amount", amount);
      formData.append("currency", currency);
      formData.append("date", date);
      formData.append("description", description);
      formData.append("pdfFile", pdfFile);

      const response = await fetch("/api/credit-notes", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        toast.error(errorData.error || errorData.message || `Failed to upload credit note (${response.status})`);
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: Failed to upload credit note`);
      }
      
      const data = await response.json();
      toast.success(data.message || "Credit note uploaded successfully");
      
      // Reset form
      setSelectedVesselId("");
      setSelectedPurchaseOrderId("");
      setCreditNoteNumber("");
      setAmount("");
      setCurrency("USD");
      setDate("");
      setDescription("");
      setPdfFile(null);
      setShowUploadForm(false);
      
      // Refresh list
      fetchCreditNotes();
    } catch (error) {
      console.error("Error uploading credit note:", error);
      toast.error("Failed to upload credit note");
    } finally {
      setUploading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const filteredCreditNotes = creditNotes.filter((cn) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      cn.purchaseOrder.poNumber.toLowerCase().includes(search) ||
      cn.purchaseOrder.requisition.requisitionNumber.toLowerCase().includes(search) ||
      cn.purchaseOrder.requisition.heading.toLowerCase().includes(search) ||
      (cn.creditNoteNumber && cn.creditNoteNumber.toLowerCase().includes(search)) ||
      cn.purchaseOrder.quote.vendor.name.toLowerCase().includes(search)

    );
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedVesselId, selectedPurchaseOrderId, itemsPerPage, filteredCreditNotes.length]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCreditNotes = filteredCreditNotes.slice(startIndex, endIndex);

  const handleConfirmCreditNote = async (creditNoteId: string) => {
    try {
      const response = await fetch(`/api/credit-notes/${creditNoteId}/confirm`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        toast.success("Credit note confirmed successfully");
        fetchCreditNotes();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to confirm credit note");
      }
    } catch (error) {
      console.error("Error confirming credit note:", error);
      toast.error("Failed to confirm credit note");
    }
  };

  const handleSendEmail = async (creditNoteId: string) => {
    try {
      setSendingEmail(creditNoteId);
      const response = await fetch(`/api/credit-notes/${creditNoteId}/send-email`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Email sent successfully to ${data.vendorEmail}`);
        fetchCreditNotes();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to send email");
      }
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Failed to send email");
    } finally {
      setSendingEmail(null);
    }
  };

  // Stop loader immediately - page structure renders right away
  useEffect(() => {
    markSuccess();
  }, [markSuccess]);
  
  // Page structure renders immediately - no blocking loader

  return (<PageReadyGate ready={ready}>
    <ProtectedRoute>
      <div className="space-y-4">
      <main className="py-4">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Credit Notes</h1>
              <p className="text-foreground">
                Upload and manage credit notes against Purchase Orders
              </p>
            </div>
            <Button
              onClick={() => setShowUploadForm(!showUploadForm)}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {showUploadForm ? "Cancel" : "Upload Credit Note"}
            </Button>
          </div>
        </div>

        {/* Upload Form */}
        {showUploadForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Upload Credit Note</CardTitle>
              <CardDescription>
                Upload a credit note PDF against a Purchase Order
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vessel" className="mb-2 block">
                      <Ship className="h-4 w-4 inline mr-2" />
                      Vessel *
                    </Label>
                    <Select
                      value={selectedVesselId}
                      onValueChange={(value) => {
                        setSelectedVesselId(value);
                        setSelectedPurchaseOrderId("");
                      }}
                      required
                      disabled={vesselsLoading}
                    >
                      <SelectTrigger width="vessel">
                        <SelectValue placeholder="Select Vessel" />
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

                  <div className="space-y-2">
                    <Label htmlFor="purchaseOrder">Purchase Order *</Label>
                    <Select
                      value={selectedPurchaseOrderId}
                      onValueChange={setSelectedPurchaseOrderId}
                      required
                      disabled={!selectedVesselId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={selectedVesselId ? "Select Purchase Order" : "Select Vessel first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredPurchaseOrders.length === 0 ? (
                          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                            {selectedVesselId ? "No purchase orders found for this vessel" : "Please select a vessel first"}
                          </div>
                        ) : (
                          filteredPurchaseOrders.map((po) => (
                            <SelectItem key={po.id} value={po.id}>
                              {po.poNumber} - {po.requisition.heading}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="creditNoteNumber">Credit Note Number</Label>
                    <Input
                      id="creditNoteNumber"
                      value={creditNoteNumber}
                      onChange={(e) => setCreditNoteNumber(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount *</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        required
                      />
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                          <SelectItem value="INR">INR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Optional description"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="pdfFile">PDF File *</Label>
                    <Input
                      id="pdfFile"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      required
                    />
                    {pdfFile && (
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <FileText className="h-4 w-4" />
                        <span>{pdfFile.name}</span>
                        <span className="text-muted-foreground">
                          ({(pdfFile.size / 1024).toFixed(2)} KB)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowUploadForm(false);
                      setSelectedVesselId("");
                      setSelectedPurchaseOrderId("");
                      setCreditNoteNumber("");
                      setAmount("");
                      setCurrency("USD");
                      setDate("");
                      setDescription("");
                      setPdfFile(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={uploading}>
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Credit Note
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by PO number, requisition number, heading, credit note number, or vendor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Credit Notes Table */}
        <Card>
          <CardHeader>
            <CardTitle>Credit Notes ({filteredCreditNotes.length})</CardTitle>
            <CardDescription>
              List of all uploaded credit notes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-14">
                <ActiniumLoader size="md" text="Loading credit notes…" />
              </div>
            ) : filteredCreditNotes.length === 0 ? (
              <Alert>
                <AlertDescription>
                  {searchTerm
                    ? "No credit notes found matching your search."
                    : "No credit notes uploaded yet. Click 'Upload Credit Note' to get started."}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableSerialHead />
                      <TableHead>Vessel</TableHead>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Requisition</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Credit Note #</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Uploaded By</TableHead>
                      <TableHead>PDF</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCreditNotes.map((cn, index) => (
                      <TableRow key={cn.id}>
                        <TableSerialCell serialNo={tableSerialNo(currentPage, itemsPerPage, index)} />
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Ship className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{cn.purchaseOrder.requisition.vessel.name}</div>
                              <div className="text-xs text-muted-foreground">{cn.purchaseOrder.requisition.vessel.code}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {cn.purchaseOrder.poNumber}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {cn.purchaseOrder.requisition.requisitionNumber}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {cn.purchaseOrder.requisition.heading}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{cn.purchaseOrder.quote.vendor.name}</TableCell>
                        <TableCell>
                          {cn.creditNoteNumber || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(cn.amount, cn.currency)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {formatDate(cn.date)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {cn.status === "CONFIRMED" ? (
                            <Badge variant="default" className="bg-success">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Confirmed
                            </Badge>
                          ) : cn.status === "REJECTED" ? (
                            <Badge variant="destructive">
                              <X className="h-3 w-3 mr-1" />
                              Rejected
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{cn.uploadedBy.firstName} {cn.uploadedBy.lastName}</div>
                            <div className="text-xs text-muted-foreground">
                              {cn.uploadedBy.employeeId}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {cn.pdfUrl ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(cn.pdfUrl!, "_blank")}
                              className="flex items-center gap-1"
                            >
                              <Download className="h-4 w-4" />
                              Download
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {/* View PDF - Available for all users */}
                            {cn.pdfUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(cn.pdfUrl!, "_blank")}
                                className="flex items-center gap-1"
                                title="View PDF"
                              >
                                <Eye className="h-4 w-4" />
                                View
                              </Button>
                            )}
                            
                            {/* Vendor Actions - Confirm button */}
                            {isVendor && (cn.status === "PENDING" || !cn.status) && cn.purchaseOrder.quote.vendor.id === vendorId && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleConfirmCreditNote(cn.id)}
                                className="flex items-center gap-1"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Confirm
                              </Button>
                            )}
                            
                            {/* Employee Actions - Send Email button for access levels 32, 33, 50, 99, 100 */}
                            {!isVendor && [32, 33, 50, 99, 100].includes(userAccessLevel || 0) && (cn.status === "PENDING" || !cn.status) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSendEmail(cn.id)}
                                disabled={sendingEmail === cn.id}
                                className="flex items-center gap-1"
                              >
                                {sendingEmail === cn.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Sending...
                                  </>
                                ) : (
                                  <>
                                    <Mail className="h-4 w-4" />
                                    Send Email
                                  </>
                                )}
                              </Button>
                            )}
                            
                            {/* Show message if no actions available */}
                            {!cn.pdfUrl && 
                             !(isVendor && (cn.status === "PENDING" || !cn.status) && cn.purchaseOrder.quote.vendor.id === vendorId) &&
                             !(!isVendor && [32, 33, 50, 99, 100].includes(userAccessLevel || 0) && (cn.status === "PENDING" || !cn.status)) && (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4">
                  <TablePagination
                    page={currentPage}
                    pageSize={itemsPerPage}
                    total={filteredCreditNotes.length}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(size) => {
                      setItemsPerPage(size);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
    </ProtectedRoute>
    </PageReadyGate>
  );
}









