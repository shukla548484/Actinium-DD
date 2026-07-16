"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShoppingCart,
  Plus,
  Package,
  DollarSign,
  FileText,
  CheckCircle2,
  X,
  Users,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { useVessels } from "@/hooks/useStaticData";
import { TableSerialHead, TableSerialCell } from "@/components/ui/table-serial-column";

interface Requisition {
  id: string;
  requisitionNumber: string;
  heading: string;
  vessel: {
    name: string;
    code: string;
  };
  requisitionType: string;
  status: string;
  items: Array<{
    itemName: string;
    quantity: number;
    unit: string;
  }>;
  contract?: {
    id: string;
    contractNumber: string;
    title: string;
  };
  vendorQuotes?: Array<{
    id: string;
    status: string;
    vendor: {
      id: string;
      name: string;
    };
    quotedItems: Array<{
      itemName: string;
      quantity: number;
      unit: string;
      unitPrice: number | null;
      totalPrice: number | null;
    }>;
  }>;
}

interface VendorGroup {
  vendorId: string;
  vendorName: string;
  requisitions: Requisition[];
  aggregatedItems: Array<{
    itemName: string;
    totalQuantity: number;
    unit: string;
    requisitionNumbers: string[];
  }>;
  totalAmount: number;
  currency: string;
}

export default function BulkPurchasingPage() {
  const { ready, markSuccess } = usePageBootstrap();
  
  // Use optimized hooks for static data with caching
  const { data: vessels = [], isLoading: vesselsLoading } = useVessels({ limit: 100, isActive: true });
  
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [selectedRequisitions, setSelectedRequisitions] = useState<Set<string>>(new Set());
  const [selectedContract, setSelectedContract] = useState<string>("");
  const [contracts, setContracts] = useState<Array<{ id: string; contractNumber: string; title: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVessel, setSelectedVessel] = useState<string>("all");
  const [creating, setCreating] = useState(false);

  // Initialize page once static data is loaded
  useEffect(() => {
    if (!vesselsLoading) {
      loadContracts();
      loadRequisitions();
      markSuccess();
    }
  }, [vesselsLoading, markSuccess]);

  useEffect(() => {
    loadRequisitions();
  }, [selectedVessel]);

  // Group selected requisitions by vendor
  const vendorGroups = useMemo(() => {
    if (selectedRequisitions.size === 0) {
      return [];
    }

    const selectedReqs = requisitions.filter((r) => 
      selectedRequisitions.has(r.id) && 
      r.vendorQuotes && 
      r.vendorQuotes.some(q => q.status === "APPROVED")
    );

    const groups = new Map<string, VendorGroup>();

    for (const req of selectedReqs) {
      const approvedQuote = req.vendorQuotes?.find(q => q.status === "APPROVED");
      if (!approvedQuote) continue;

      const vendorId = approvedQuote.vendor.id;
      const vendorName = approvedQuote.vendor.name;

      if (!groups.has(vendorId)) {
        groups.set(vendorId, {
          vendorId,
          vendorName,
          requisitions: [],
          aggregatedItems: [],
          totalAmount: 0,
          currency: "USD",
        });
      }

      const group = groups.get(vendorId)!;
      group.requisitions.push(req);
      group.currency = approvedQuote.quotedItems?.[0] ? (approvedQuote as any).currency || "USD" : group.currency;

      // Aggregate items
      for (const quotedItem of approvedQuote.quotedItems || []) {
        const key = `${quotedItem.itemName}_${quotedItem.unit}`;
        const existing = group.aggregatedItems.find(
          (item) => item.itemName === quotedItem.itemName && item.unit === quotedItem.unit
        );

        if (existing) {
          existing.totalQuantity += Number(quotedItem.quantity);
          if (!existing.requisitionNumbers.includes(req.requisitionNumber)) {
            existing.requisitionNumbers.push(req.requisitionNumber);
          }
        } else {
          group.aggregatedItems.push({
            itemName: quotedItem.itemName,
            totalQuantity: Number(quotedItem.quantity),
            unit: quotedItem.unit,
            requisitionNumbers: [req.requisitionNumber],
          });
        }
      }

      // Calculate total amount
      const quoteTotal = approvedQuote.quotedItems?.reduce(
        (sum, item) => sum + (Number(item.totalPrice) || 0),
        0
      ) || 0;
      group.totalAmount += quoteTotal;
    }

    return Array.from(groups.values());
  }, [selectedRequisitions, requisitions]);

  const loadContracts = async () => {
    try {
      const response = await fetch("/api/contracts?status=ACTIVE&limit=100", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts || []);
      }
    } catch (error) {
      console.error("Error loading contracts:", error);
    }
  };

  const loadRequisitions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: "REQ_APPROVED",
        limit: "1000",
      });
      if (selectedVessel !== "all") params.append("vesselId", selectedVessel);

      const response = await fetch(`/api/requisitions?${params}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        // Fetch vendor quotes for each requisition
        const reqsWithQuotes = await Promise.all(
          (data.requisitions || []).map(async (req: Requisition) => {
            try {
              const quotesResponse = await fetch(`/api/quotes?requisitionId=${req.id}`, {
                credentials: "include",
              });
              if (quotesResponse.ok) {
                const quotesData = await quotesResponse.json();
                return {
                  ...req,
                  vendorQuotes: quotesData.quotes || [],
                };
              }
            } catch (error) {
              console.error(`Error fetching quotes for requisition ${req.id}:`, error);
            }
            return req;
          })
        );
        setRequisitions(reqsWithQuotes);
      } else {
        toast.error("Failed to load requisitions");
      }
    } catch (error) {
      console.error("Error loading requisitions:", error);
      toast.error("Error loading requisitions");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRequisition = (reqId: string) => {
    const newSelected = new Set(selectedRequisitions);
    if (newSelected.has(reqId)) {
      newSelected.delete(reqId);
    } else {
      newSelected.add(reqId);
    }
    setSelectedRequisitions(newSelected);
  };

  const handleSelectAll = () => {
    const reqsWithQuotes = requisitions.filter(
      (r) => r.vendorQuotes && r.vendorQuotes.some(q => q.status === "APPROVED")
    );
    
    if (selectedRequisitions.size === reqsWithQuotes.length) {
      setSelectedRequisitions(new Set());
    } else {
      setSelectedRequisitions(new Set(reqsWithQuotes.map((r) => r.id)));
    }
  };

  const handleCreateBulkOrder = async () => {
    if (selectedRequisitions.size === 0) {
      toast.error("Please select at least one requisition");
      return;
    }

    if (vendorGroups.length === 0) {
      toast.error("Selected requisitions must have approved quotes");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/purchase/bulk-purchasing/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          requisitionIds: Array.from(selectedRequisitions),
          contractId: selectedContract || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(
          data.message || `Created ${data.purchaseOrders?.length || 0} consolidated purchase order(s)`,
          { duration: 5000 }
        );
        setSelectedRequisitions(new Set());
        loadRequisitions();
      } else {
        toast.error(data.error || "Failed to create bulk order");
        if (data.errors && Array.isArray(data.errors)) {
          data.errors.forEach((err: string) => toast.error(err));
        }
      }
    } catch (error: any) {
      console.error("Error creating bulk order:", error);
      toast.error("Error creating bulk order");
    } finally {
      setCreating(false);
    }
  };

  const reqsWithApprovedQuotes = requisitions.filter(
    (r) => r.vendorQuotes && r.vendorQuotes.some(q => q.status === "APPROVED")
  );

  return (<PageReadyGate ready={ready}>
    <div className="space-y-4">
      <main className="mx-auto py-4" style={{ width: "90%", maxWidth: "90vw" }}>
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Bulk Purchasing</h1>
            <p className="text-foreground mt-1">
              Consolidate multiple requisitions into single purchase orders grouped by vendor
            </p>
          </div>
          <Button
            onClick={handleCreateBulkOrder}
            disabled={selectedRequisitions.size === 0 || creating || vendorGroups.length === 0}
          >
            {creating ? (
              <>
                <Package className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create {vendorGroups.length} Consolidated PO{vendorGroups.length !== 1 ? 's' : ''} ({selectedRequisitions.size} reqs)
              </>
            )}
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Vessel</Label>
                <Select value={selectedVessel} onValueChange={setSelectedVessel}>
                  <SelectTrigger className="mt-2" width="vessel">
                    <SelectValue placeholder="All Vessels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vessels</SelectItem>
                    {vessels.map((vessel) => (
                      <SelectItem key={vessel.id} value={vessel.id}>
                        {vessel.name} ({vessel.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Global Contract (Optional)</Label>
                <Select 
                  value={selectedContract || "none"} 
                  onValueChange={(v) => setSelectedContract(v === "none" ? "" : v)}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select contract" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {contracts.map((contract) => (
                      <SelectItem key={contract.id} value={contract.id}>
                        {contract.contractNumber} - {contract.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Requisitions List */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Approved Requisitions</CardTitle>
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  {selectedRequisitions.size === reqsWithApprovedQuotes.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <CardDescription>
                Select multiple requisitions to consolidate by vendor
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Loading requisitions...</p>
                </div>
              ) : reqsWithApprovedQuotes.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No approved requisitions with quotes found</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {reqsWithApprovedQuotes.map((req) => {
                    const approvedQuote = req.vendorQuotes?.find(q => q.status === "APPROVED");
                    return (
                      <div
                        key={req.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedRequisitions.has(req.id)
                            ? "bg-info border-border"
                            : "bg-white border-border hover:border-border"
                        }`}
                        onClick={() => handleToggleRequisition(req.id)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedRequisitions.has(req.id)}
                            onCheckedChange={() => handleToggleRequisition(req.id)}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{req.requisitionNumber}</span>
                              <Badge variant="outline">{req.requisitionType}</Badge>
                              {req.contract && (
                                <Badge variant="secondary">{req.contract.contractNumber}</Badge>
                              )}
                              {approvedQuote && (
                                <Badge variant="default" className="bg-success">
                                  <Building2 className="h-3 w-3 mr-1" />
                                  {approvedQuote.vendor.name}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-foreground">{req.heading}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {req.vessel.name} • {req.items.length} items
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vendor Groups Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Consolidation Preview</CardTitle>
              <CardDescription>
                Purchase orders will be created grouped by vendor
              </CardDescription>
            </CardHeader>
            <CardContent>
              {vendorGroups.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Select requisitions to see consolidation preview</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {vendorGroups.map((group) => (
                    <Card key={group.vendorId} className="border-2">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-info" />
                            <CardTitle className="text-lg">{group.vendorName}</CardTitle>
                          </div>
                          <Badge variant="outline">
                            {group.requisitions.length} req{group.requisitions.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <CardDescription>
                          Will create 1 consolidated PO
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm font-medium mb-2">Requisitions:</p>
                          <div className="flex flex-wrap gap-1">
                            {group.requisitions.map((req) => (
                              <Badge key={req.id} variant="secondary" className="text-xs">
                                {req.requisitionNumber}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">Aggregated Items ({group.aggregatedItems.length}):</p>
                          <div className="max-h-[200px] overflow-y-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                      <TableSerialHead />
                                  <TableHead className="text-xs">Item</TableHead>
                                  <TableHead className="text-xs text-right">Qty</TableHead>
                                  <TableHead className="text-xs">Unit</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.aggregatedItems.map((item, idx) => (
                                  <TableRow key={idx}>
                                    <TableSerialCell serialNo={idx + 1} />
                                    <TableCell className="text-xs font-medium">{item.itemName}</TableCell>
                                    <TableCell className="text-xs text-right">{item.totalQuantity}</TableCell>
                                    <TableCell className="text-xs">{item.unit}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                        <div className="pt-2 border-t">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-foreground">Total Amount:</span>
                            <span className="font-semibold text-success">
                              {group.currency} {group.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
        </PageReadyGate>
  );
}
