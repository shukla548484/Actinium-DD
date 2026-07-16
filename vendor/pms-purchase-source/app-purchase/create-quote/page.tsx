"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  FileText, 
  Store, 
  Ship, 
  DollarSign, 
  Calendar, 
  Save, 
  AlertCircle,
  CheckCircle,
  Plus,
  Trash2,
  Check,
  ChevronsUpDown,
  File
} from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useVessels } from "@/hooks/useStaticData";
import { cn } from "@/lib/utils";
import { fieldErrorCn } from "@/lib/form-field-highlight";
import { TableSerialHead, TableSerialCell } from "@/components/ui/table-serial-column";

interface Requisition {
  id: string;
  requisitionNumber: string;
  heading: string;
  status: string;
  vessel: {
    id: string;
    name: string;
    code: string;
  };
  items: Array<{
    id: string;
    itemName: string;
    description: string | null;
    quantity: number;
    unit: string;
  }>;
}

interface Vendor {
  id: string;
  name: string;
  primaryEmail: string;
  country: string;
}

interface QuoteItem {
  itemId: string;
  itemName: string;
  description: string | null;
  quantity: number;
  unit: string;
  unitPrice: string;
  totalPrice: string;
  deliveryTime: string;
  remarks: string;
}

export default function CreateQuotePage() {
  const router = useRouter();
  // Don't block page rendering - stop loader immediately
  const { ready, markSuccess } = usePageBootstrap();
  const [userAccessLevel, setUserAccessLevel] = useState<number | null>(null);
  
  // Vessel and requisition state
  const { data: vessels = [], isLoading: vesselsLoading } = useVessels({ limit: 100, isActive: true });
  const [selectedVesselId, setSelectedVesselId] = useState<string>("");
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedRequisitionId, setSelectedRequisitionId] = useState<string>("");
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);
  
  // Vendor search combobox state
  const [vendorComboboxOpen, setVendorComboboxOpen] = useState(false);
  const [vendorSearchValue, setVendorSearchValue] = useState("");
  const [quoteFieldHighlight, setQuoteFieldHighlight] = useState<Record<string, boolean>>({});
  
  // Quote details
  const [quoteNumber, setQuoteNumber] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  
  // Vendor card additional fields
  const [vendorRemarks, setVendorRemarks] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [ihmDeclaration, setIhmDeclaration] = useState(false);
  const [socDeclaration, setSocDeclaration] = useState(false);
  const [paymentTermDeclaration, setPaymentTermDeclaration] = useState(false);
  
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingRequisitions, setLoadingRequisitions] = useState(false);
  const [loadingVendors, setLoadingVendors] = useState(false);

  // Check user access level
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { fetchJsonWithTimeout } = await import('@/lib/utils/fetch-with-timeout');
        const data = await fetchJsonWithTimeout<{ user: any }>("/api/profile/basic", {
          timeout: 8000,
          credentials: "include",
        });
        const accessLevel = data.user?.designationAccessLevel || 0;
        setUserAccessLevel(accessLevel);
        
        // Check if user has required access (50, 32, or 33)
        if (![50, 32, 33].includes(accessLevel)) {
          toast.error("Access denied. Only users with access level 50, 32, or 33 can create quotes.");
          router.push("/unauthorized");
          return;
        }
        
        // Stop loading immediately after access check
        markSuccess();
        
        // Fetch vendors only (requisitions will be fetched when vessel is selected)
        fetchVendors().catch(err => console.error("Error loading vendors:", err));
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

  // Fetch requisitions for selected vessel that are ready for quotes (REQ_APPROVED or SENT_FOR_QUOTE)
  const fetchRequisitions = async (vesselId?: string) => {
    if (!vesselId) {
      setRequisitions([]);
      return;
    }

    setLoadingRequisitions(true);
    try {
      const { fetchJsonWithTimeout } = await import('@/lib/utils/fetch-with-timeout');
      
      // Fetch both statuses in parallel for the selected vessel
      const [data1, data2] = await Promise.allSettled([
        fetchJsonWithTimeout<{ requisitions: Requisition[] }>(`/api/requisitions?status=REQ_APPROVED&vesselId=${vesselId}&limit=100`, {
          timeout: 10000,
          credentials: "include",
        }),
        fetchJsonWithTimeout<{ requisitions: Requisition[] }>(`/api/requisitions?status=SENT_FOR_QUOTE&vesselId=${vesselId}&limit=100`, {
          timeout: 10000,
          credentials: "include",
        })
      ]);
      
      const req1 = data1.status === 'fulfilled' ? (data1.value.requisitions || []) : [];
      const req2 = data2.status === 'fulfilled' ? (data2.value.requisitions || []) : [];
      const allRequisitions = [...req1, ...req2];
      setRequisitions(allRequisitions);
      
      // Clear selected requisition if it doesn't belong to selected vessel
      if (selectedRequisitionId) {
        const stillExists = allRequisitions.some(r => r.id === selectedRequisitionId);
        if (!stillExists) {
          setSelectedRequisitionId("");
          setSelectedRequisition(null);
          setQuoteItems([]);
        }
      }
    } catch (error: any) {
      console.error("Error fetching requisitions:", error);
      if (error.message?.includes('timeout')) {
        toast.error("Request timed out while fetching requisitions");
      } else {
        toast.error("Failed to fetch requisitions");
      }
    } finally {
      setLoadingRequisitions(false);
    }
  };

  // Fetch requisitions when vessel changes
  useEffect(() => {
    if (selectedVesselId) {
      fetchRequisitions(selectedVesselId);
    } else {
      setRequisitions([]);
      setSelectedRequisitionId("");
      setSelectedRequisition(null);
      setQuoteItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVesselId]);

  // Fetch vendors
  const fetchVendors = async () => {
    setLoadingVendors(true);
    try {
      const { fetchJsonWithTimeout } = await import('@/lib/utils/fetch-with-timeout');
      const data = await fetchJsonWithTimeout<{ vendors: Vendor[] }>("/api/vendors?limit=100&isActive=true", {
        timeout: 10000,
        credentials: "include",
      });
      setVendors(data.vendors || []);
    } catch (error: any) {
      console.error("Error fetching vendors:", error);
      if (error.message?.includes('timeout')) {
        toast.error("Request timed out while fetching vendors");
      } else {
        toast.error("Failed to fetch vendors");
      }
    } finally {
      setLoadingVendors(false);
    }
  };

  // Handle requisition selection - fetch full requisition details with items
  useEffect(() => {
    if (selectedRequisitionId) {
      // Fetch full requisition details to ensure we have all items
      const fetchRequisitionDetails = async () => {
        try {
          const response = await fetch(`/api/requisitions/${selectedRequisitionId}`, {
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            const requisition = data.requisition || data;
            setSelectedRequisition(requisition);
            
            // Initialize quote items from requisition items
            if (requisition.items && requisition.items.length > 0) {
              const items: QuoteItem[] = requisition.items.map((item: any) => ({
                itemId: item.id,
                itemName: item.itemName,
                description: item.description || null,
                quantity: item.quantity,
                unit: item.unit,
                unitPrice: "",
                totalPrice: "",
                deliveryTime: "",
                remarks: "",
              }));
              setQuoteItems(items);
            } else {
              // Fallback to requisitions list if API doesn't return items
              const req = requisitions.find(r => r.id === selectedRequisitionId);
              if (req && req.items) {
                setSelectedRequisition(req);
                const items: QuoteItem[] = req.items.map(item => ({
                  itemId: item.id,
                  itemName: item.itemName,
                  description: item.description || null,
                  quantity: item.quantity,
                  unit: item.unit,
                  unitPrice: "",
                  totalPrice: "",
                  deliveryTime: "",
                  remarks: "",
                }));
                setQuoteItems(items);
              }
            }
          } else {
            // Fallback to requisitions list
            const requisition = requisitions.find(r => r.id === selectedRequisitionId);
            if (requisition) {
              setSelectedRequisition(requisition);
              if (requisition.items && requisition.items.length > 0) {
                const items: QuoteItem[] = requisition.items.map(item => ({
                  itemId: item.id,
                  itemName: item.itemName,
                  description: item.description || null,
                  quantity: item.quantity,
                  unit: item.unit,
                  unitPrice: "",
                  totalPrice: "",
                  deliveryTime: "",
                  remarks: "",
                }));
                setQuoteItems(items);
              }
            }
          }
        } catch (error) {
          console.error("Error fetching requisition details:", error);
          // Fallback to requisitions list
          const requisition = requisitions.find(r => r.id === selectedRequisitionId);
          if (requisition) {
            setSelectedRequisition(requisition);
            if (requisition.items && requisition.items.length > 0) {
              const items: QuoteItem[] = requisition.items.map(item => ({
                itemId: item.id,
                itemName: item.itemName,
                description: item.description || null,
                quantity: item.quantity,
                unit: item.unit,
                unitPrice: "",
                totalPrice: "",
                deliveryTime: "",
                remarks: "",
              }));
              setQuoteItems(items);
            }
          }
        }
      };
      
      fetchRequisitionDetails();
    } else {
      setSelectedRequisition(null);
      setQuoteItems([]);
    }
  }, [selectedRequisitionId, requisitions]);

  // Calculate total amount when items change
  useEffect(() => {
    const total = quoteItems.reduce((sum, item) => {
      const totalPrice = parseFloat(item.totalPrice) || 0;
      return sum + totalPrice;
    }, 0);
    setTotalAmount(total.toFixed(2));
  }, [quoteItems]);

  // Update item field
  const updateItem = (index: number, field: keyof QuoteItem, value: string) => {
    setQuoteFieldHighlight((prev) => ({ ...prev, [`itemPrice-${index}`]: false, noQuoteItems: false }));
    const updated = [...quoteItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-calculate totalPrice if unitPrice and quantity are provided
    if (field === "unitPrice" || field === "quantity") {
      const unitPrice = parseFloat(updated[index].unitPrice) || 0;
      const quantity = updated[index].quantity || 0;
      updated[index].totalPrice = (unitPrice * quantity).toFixed(2);
    }
    
    setQuoteItems(updated);
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileArray = Array.from(files);
      setAttachedFiles(prev => [...prev, ...fileArray]);
    }
  };

  // Handle file removal
  const handleRemoveFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Handle form submission
  const handleSubmit = async () => {
    const priceHighlights: Record<string, boolean> = {};
    quoteItems.forEach((item, index) => {
      if (!item.unitPrice || !item.totalPrice) {
        priceHighlights[`itemPrice-${index}`] = true;
      }
    });

    if (!selectedRequisitionId || !selectedVendorId) {
      setQuoteFieldHighlight({
        requisition: !selectedRequisitionId,
        vendor: !selectedVendorId,
        ...priceHighlights,
      });
      toast.error("Please select a requisition and vendor");
      return;
    }

    if (quoteItems.length === 0) {
      setQuoteFieldHighlight((prev) => ({ ...prev, noQuoteItems: true }));
      toast.error("Please add at least one quote item");
      return;
    }

    if (Object.keys(priceHighlights).length > 0) {
      setQuoteFieldHighlight(priceHighlights);
      toast.error("Please provide unit price and total price for all items");
      return;
    }

    setQuoteFieldHighlight({});
    setIsSubmitting(true);
    try {
      // Combine notes with vendor remarks and declarations
      const combinedNotes = [
        notes.trim(),
        vendorRemarks.trim() && `Vendor Remarks: ${vendorRemarks.trim()}`,
        ihmDeclaration && "IHM Declaration: Yes",
        socDeclaration && "SOC Declaration: Yes",
        paymentTermDeclaration && "Payment Term Declaration: Yes",
      ].filter(Boolean).join("\n\n") || null;

      const response = await fetch("/api/quotes/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          requisitionId: selectedRequisitionId,
          vendorId: selectedVendorId,
          quoteNumber: quoteNumber.trim() || null,
          totalAmount: parseFloat(totalAmount) || null,
          currency,
          validUntil: validUntil || null,
          notes: combinedNotes,
          ihmDeclaration: ihmDeclaration ? "Yes" : null,
          paymentTerms: paymentTermDeclaration ? "Declared" : null,
          items: quoteItems.map(item => ({
            itemName: item.itemName,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: parseFloat(item.unitPrice) || null,
            totalPrice: parseFloat(item.totalPrice) || null,
            deliveryTime: item.deliveryTime.trim() || null,
            remarks: item.remarks.trim() || null,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success("Quote created successfully!");
        
        // Navigate to quote comparison page
        router.push(`/purchase/requisitions/${selectedRequisitionId}/quotes`);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create quote");
      }
    } catch (error) {
      console.error("Error creating quote:", error);
      toast.error("Failed to create quote");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stop loader immediately - page structure renders right away
  useEffect(() => {
    markSuccess();
  }, [markSuccess]);
  
  // Page structure renders immediately - no blocking loader

  if (userAccessLevel && ![50, 32, 33].includes(userAccessLevel)) {
    return (
      <div className="space-y-4">
        <div className="mx-auto py-4" style={{ width: "90%", maxWidth: "90vw" }}>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Access denied. Only users with access level 50, 32, or 33 can create quotes.
            </AlertDescription>
          </Alert>
        </div>
      </div>

    );
  }

  return (<PageReadyGate ready={ready}>
    <ProtectedRoute requiredAccessLevel={32}>
      <div className="space-y-4">
        <div className="mx-auto py-4" style={{ width: "90%", maxWidth: "90vw" }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Create Quote</h1>
              <p className="text-foreground mt-2">Create a quote manually for a requisition and vendor</p>
            </div>
            <Button onClick={handleSubmit} disabled={isSubmitting} size="lg">
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? "Creating..." : "Create Quote"}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Requisition Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Select Requisition
                </CardTitle>
                <CardDescription>Choose a requisition to create a quote for</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="vessel" className="mb-2 block">Select Vessel *</Label>
                  <Select
                    value={selectedVesselId}
                    onValueChange={setSelectedVesselId}
                    disabled={vesselsLoading}
                  >
                    <SelectTrigger id="vessel" width="vessel">
                      <SelectValue placeholder="Select a vessel first" />
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

                {selectedVesselId && (
                  <div>
                    <Label htmlFor="requisition" className="mb-2 block">Requisition *</Label>
                    <Select
                      value={selectedRequisitionId}
                      onValueChange={(v) => {
                        setSelectedRequisitionId(v);
                        setQuoteFieldHighlight((prev) => ({ ...prev, requisition: false, noQuoteItems: false }));
                      }}
                      disabled={loadingRequisitions || !selectedVesselId}
                    >
                      <SelectTrigger
                        id="requisition"
                        className={fieldErrorCn(!!quoteFieldHighlight.requisition)}
                        aria-invalid={quoteFieldHighlight.requisition || undefined}
                      >
                        <SelectValue placeholder={loadingRequisitions ? "Loading requisitions..." : "Select a requisition"} />
                      </SelectTrigger>
                      <SelectContent>
                        {requisitions.length === 0 ? (
                          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                            No requisitions found for this vessel
                          </div>
                        ) : (
                          requisitions.map((req) => (
                            <SelectItem key={req.id} value={req.id}>
                              {req.requisitionNumber} - {req.heading}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedRequisition && (
                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Ship className="h-4 w-4 text-foreground" />
                      <span className="text-sm font-medium">Vessel:</span>
                      <span className="text-sm">{selectedRequisition.vessel.name} ({selectedRequisition.vessel.code})</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Status:</span>
                      <Badge className="ml-2">{selectedRequisition.status}</Badge>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Items:</span>
                      <span className="text-sm ml-2">{selectedRequisition.items.length} item(s)</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Vendor Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  Select Vendor
                </CardTitle>
                <CardDescription>Choose a vendor for this quote</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="vendor">Vendor *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => router.push("/purchase/vendor-management")}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add New Vendor
                    </Button>
                  </div>
                  <Popover open={vendorComboboxOpen} onOpenChange={setVendorComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={vendorComboboxOpen}
                        className={fieldErrorCn(!!quoteFieldHighlight.vendor, "w-full justify-between")}
                        disabled={loadingVendors || vendors.length === 0}
                        aria-invalid={quoteFieldHighlight.vendor || undefined}
                      >
                        {selectedVendorId
                          ? vendors.find((vendor) => vendor.id === selectedVendorId)?.name || "Select vendor"
                          : vendors.length === 0 ? "No vendors available - Click 'Add New Vendor' to register" : "Select vendor..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="Search vendors..." 
                          value={vendorSearchValue}
                          onValueChange={setVendorSearchValue}
                        />
                        <CommandList>
                          <CommandEmpty>No vendors found.</CommandEmpty>
                          <CommandGroup>
                            {vendors.map((vendor) => (
                              <CommandItem
                                key={vendor.id}
                                value={`${vendor.name} ${vendor.country} ${vendor.primaryEmail}`}
                                onSelect={() => {
                                  setSelectedVendorId(vendor.id);
                                  setQuoteFieldHighlight((prev) => ({ ...prev, vendor: false }));
                                  setVendorComboboxOpen(false);
                                  setVendorSearchValue("");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedVendorId === vendor.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{vendor.name}</span>
                                  <span className="text-xs text-muted-foreground">{vendor.country} • {vendor.primaryEmail}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {vendors.length === 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No vendors are registered. Please{" "}
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => router.push("/purchase/vendor-management")}
                        className="p-0 h-auto font-semibold text-primary underline"
                      >
                        register a vendor
                      </Button>{" "}
                      to continue creating a quote.
                    </AlertDescription>
                  </Alert>
                )}

                {selectedVendorId && (
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-foreground" />
                      <span className="text-sm font-medium">Email:</span>
                      <span className="text-sm">{vendors.find(v => v.id === selectedVendorId)?.primaryEmail}</span>
                    </div>
                  </div>
                )}

                {/* Declarations and Additional Information Card */}
                <Card className="mt-4 border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Declarations & Additional Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="vendorRemarks" className="mb-2 block">Remarks</Label>
                      <Textarea
                        id="vendorRemarks"
                        value={vendorRemarks}
                        onChange={(e) => setVendorRemarks(e.target.value)}
                        placeholder="Enter any remarks or notes..."
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="attachFiles" className="mb-2 block">Attach Files</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="attachFiles"
                          type="file"
                          multiple
                          onChange={handleFileSelect}
                          className="flex-1"
                        />
                      </div>
                      {attachedFiles.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {attachedFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
                              <div className="flex items-center gap-2">
                                <File className="h-4 w-4 text-foreground" />
                                <span className="text-sm">{file.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({(file.size / 1024).toFixed(2)} KB)
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveFile(index)}
                                className="h-6 w-6"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 pt-2 border-t">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="ihmDeclaration"
                          checked={ihmDeclaration}
                          onCheckedChange={(checked) => setIhmDeclaration(checked === true)}
                        />
                        <Label htmlFor="ihmDeclaration" className="text-sm font-normal cursor-pointer">
                          IHM Declaration
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="socDeclaration"
                          checked={socDeclaration}
                          onCheckedChange={(checked) => setSocDeclaration(checked === true)}
                        />
                        <Label htmlFor="socDeclaration" className="text-sm font-normal cursor-pointer">
                          SOC Declaration
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="paymentTermDeclaration"
                          checked={paymentTermDeclaration}
                          onCheckedChange={(checked) => setPaymentTermDeclaration(checked === true)}
                        />
                        <Label htmlFor="paymentTermDeclaration" className="text-sm font-normal cursor-pointer">
                          Payment Term Declaration
                        </Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </div>

          {/* Quote Details */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Quote Details
              </CardTitle>
              <CardDescription>Enter quote information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="quoteNumber" className="mb-2 block">Quote Number</Label>
                  <Input
                    id="quoteNumber"
                    value={quoteNumber}
                    onChange={(e) => setQuoteNumber(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label htmlFor="totalAmount" className="mb-2 block">Total Amount *</Label>
                  <Input
                    id="totalAmount"
                    type="number"
                    step="0.01"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="0.00"
                    readOnly
                    className="bg-muted"
                  />
                </div>
                <div>
                  <Label htmlFor="currency" className="mb-2 block">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="currency">
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
                <div>
                  <Label htmlFor="validUntil" className="mb-2 block">Valid Until</Label>
                  <Input
                    id="validUntil"
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-4">
                <Label htmlFor="notes" className="mb-2 block">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Additional notes or comments..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Quote Items */}
          {selectedRequisition && quoteItems.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Quote Items</CardTitle>
                <CardDescription>Enter pricing and details for each item</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                      <TableSerialHead />
                        <TableHead>Item Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Unit Price *</TableHead>
                        <TableHead>Total Price *</TableHead>
                        <TableHead>Delivery Time</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quoteItems.map((item, index) => (
                        <TableRow key={item.itemId}>
                          <TableSerialCell serialNo={index + 1} />
                          <TableCell className="font-medium">{item.itemName}</TableCell>
                          <TableCell className="max-w-[200px]">
                            <div className="text-xs text-foreground truncate" title={item.description || ""}>
                              {item.description || "N/A"}
                            </div>
                          </TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
                              placeholder="0.00"
                              className={fieldErrorCn(!!quoteFieldHighlight[`itemPrice-${index}`], "w-24")}
                              aria-invalid={quoteFieldHighlight[`itemPrice-${index}`] || undefined}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.totalPrice}
                              onChange={(e) => updateItem(index, "totalPrice", e.target.value)}
                              placeholder="0.00"
                              className={fieldErrorCn(!!quoteFieldHighlight[`itemPrice-${index}`], "w-24")}
                              aria-invalid={quoteFieldHighlight[`itemPrice-${index}`] || undefined}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.deliveryTime}
                              onChange={(e) => updateItem(index, "deliveryTime", e.target.value)}
                              placeholder="e.g., 2 weeks"
                              className="w-32"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.remarks}
                              onChange={(e) => updateItem(index, "remarks", e.target.value)}
                              placeholder="Optional"
                              className="w-32"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {!selectedRequisition && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please select a requisition to view and edit quote items.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </ProtectedRoute>
    </PageReadyGate>
  );
}

