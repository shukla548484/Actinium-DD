"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useVessels } from "@/hooks/useStaticData";
import { useRouter } from "next/navigation";
import { FileText, Plus, X } from "lucide-react";
import { format } from "date-fns";

interface Vendor {
  id: string;
  name: string;
  vendorId: string;
}

interface Vessel {
  id: string;
  name: string;
  code: string;
}

interface ContractItem {
  itemName: string;
  description: string;
  unit: string;
  unitPrice: number;
  currency: string;
  minQuantity?: number;
  maxQuantity?: number;
  leadTime?: number;
  notes: string;
}

export default function CreateContractPage() {
  const { ready, markSuccess } = usePageBootstrap();
  const router = useRouter();
  
  // Use optimized hooks for static data with caching
  const { data: vessels = [], isLoading: vesselsLoading } = useVessels({ limit: 100, isActive: true });
  
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [contractItems, setContractItems] = useState<ContractItem[]>([]);

  const [formData, setFormData] = useState({
    contractNumber: "",
    contractType: "ANNUAL",
    vendorId: "",
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    renewalDate: "",
    contractValue: "",
    currency: "USD",
    termsAndConditions: "",
    isGlobal: false,
    applicableVesselIds: [] as string[],
    notes: "",
  });

  const [itemForm, setItemForm] = useState<ContractItem>({
    itemName: "",
    description: "",
    unit: "",
    unitPrice: 0,
    currency: "USD",
    minQuantity: undefined,
    maxQuantity: undefined,
    leadTime: undefined,
    notes: "",
  });

  // Initialize page once static data is loaded
  useEffect(() => {
    if (!vesselsLoading) {
      loadVendors();
      markSuccess();
    }
  }, [vesselsLoading, markSuccess]);

  const loadVendors = async () => {
    try {
      const response = await fetch("/api/vendors?limit=50&page=1", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setVendors(data.vendors || []);
      }
    } catch (error) {
      console.error("Error loading vendors:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        contractValue: parseFloat(formData.contractValue),
        renewalDate: formData.renewalDate || undefined,
        applicableVesselIds: formData.isGlobal ? [] : formData.applicableVesselIds,
      };

      const response = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        console.error("Contract creation error:", error);
        const errorMsg = error.details || error.actualError || error.error || error.message || `Failed to create contract (${response.status})`;
        toast.error(errorMsg, { duration: 5000 });
        throw new Error(errorMsg);
      }
      
      // Success
      const data = await response.json();
      const contractId = data.contract.id;

      // Add contract items
      if (contractItems.length > 0) {
        for (const item of contractItems) {
          await fetch(`/api/contracts/${contractId}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(item),
          });
        }
      }

      toast.success("Contract created successfully");
      router.push(`/purchase/contracts/${contractId}/view`);
    } catch (error: any) {
      console.error("Error creating contract:", error);
      toast.error("Error creating contract");
    } finally {
      setLoading(false);
    }
  };

  const addContractItem = () => {
    if (!itemForm.itemName || !itemForm.unit || !itemForm.unitPrice) {
      toast.error("Please fill in required item fields");
      return;
    }
    setContractItems([...contractItems, { ...itemForm }]);
    setItemForm({
      itemName: "",
      description: "",
      unit: "",
      unitPrice: 0,
      currency: "USD",
      minQuantity: undefined,
      maxQuantity: undefined,
      leadTime: undefined,
      notes: "",
    });
  };

  const removeContractItem = (index: number) => {
    setContractItems(contractItems.filter((_, i) => i !== index));
  };

  return (<PageReadyGate ready={ready}>
    <div className="space-y-4">
      <main className="mx-auto py-4" style={{ width: "90%", maxWidth: "90vw" }}>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Create Contract</h1>
          <p className="text-foreground mt-1">Create a new vendor contract</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="contractNumber">Contract Number *</Label>
                  <Input
                    id="contractNumber"
                    value={formData.contractNumber}
                    onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contractType">Contract Type *</Label>
                  <Select
                    value={formData.contractType}
                    onValueChange={(value) => setFormData({ ...formData, contractType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ANNUAL">Annual</SelectItem>
                      <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="ONE_TIME">One Time</SelectItem>
                      <SelectItem value="BLANKET">Blanket</SelectItem>
                      <SelectItem value="FRAMEWORK">Framework</SelectItem>
                      <SelectItem value="INVOICE_BASED">Invoice based</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.contractType === "INVOICE_BASED" && (
                    <p className="text-xs text-muted-foreground">
                      Contractor invoices are uploaded on Purchase → Invoices against this contract.
                      Set the contract to <strong>ACTIVE</strong> after creation so uploads are allowed.
                      A PO is created automatically per invoice (no PO approval); invoices are approved at access level 37+.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vendorId">Vendor *</Label>
                  <Select
                    value={formData.vendorId}
                    onValueChange={(value) => setFormData({ ...formData, vendorId: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.name} ({vendor.vendorId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Dates & Financial */}
            <Card>
              <CardHeader>
                <CardTitle>Dates & Financial</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endDate">End Date *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="renewalDate">Renewal Date</Label>
                  <Input
                    id="renewalDate"
                    type="date"
                    value={formData.renewalDate}
                    onChange={(e) => setFormData({ ...formData, renewalDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contractValue">Contract Value *</Label>
                  <Input
                    id="contractValue"
                    type="number"
                    step="0.01"
                    value={formData.contractValue}
                    onChange={(e) => setFormData({ ...formData, contractValue: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="currency">Currency *</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="JPY">JPY</SelectItem>
                      <SelectItem value="SGD">SGD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Terms & Conditions */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Terms & Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.termsAndConditions}
                onChange={(e) => setFormData({ ...formData, termsAndConditions: e.target.value })}
                rows={5}
                placeholder="Enter contract terms and conditions..."
              />
            </CardContent>
          </Card>

          {/* Vessel Assignment */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Vessel Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isGlobal"
                  checked={formData.isGlobal}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isGlobal: checked as boolean, applicableVesselIds: [] })
                  }
                />
                <Label htmlFor="isGlobal" className="cursor-pointer">
                  Global Contract (All Vessels)
                </Label>
              </div>
              {!formData.isGlobal && (
                <div className="space-y-1.5">
                  <Label>Applicable Vessels</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {vessels.map((vessel) => (
                      <div key={vessel.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`vessel-${vessel.id}`}
                          checked={formData.applicableVesselIds.includes(vessel.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData({
                                ...formData,
                                applicableVesselIds: [...formData.applicableVesselIds, vessel.id],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                applicableVesselIds: formData.applicableVesselIds.filter((id) => id !== vessel.id),
                              });
                            }
                          }}
                        />
                        <Label htmlFor={`vessel-${vessel.id}`} className="cursor-pointer text-sm">
                          {vessel.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contract Items */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Contract Items</CardTitle>
              <CardDescription>Add items covered by this contract</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label>Item Name *</Label>
                  <Input
                    value={itemForm.itemName}
                    onChange={(e) => setItemForm({ ...itemForm, itemName: e.target.value })}
                    placeholder="Item name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Unit *</Label>
                  <Input
                    value={itemForm.unit}
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                    placeholder="pcs, kg, etc."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Unit Price *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={itemForm.unitPrice || ""}
                    onChange={(e) => setItemForm({ ...itemForm, unitPrice: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-end">
                  <Button type="button" onClick={addContractItem}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>
              </div>

              {contractItems.length > 0 && (
                <div className="mt-4">
                  <div className="space-y-2">
                    {contractItems.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded">
                        <div className="flex-1">
                          <div className="font-medium">{item.itemName}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.unit} @ {item.currency} {item.unitPrice.toFixed(2)}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeContractItem(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Additional notes..."
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Contract"}
            </Button>
          </div>
        </form>
      </main>
    </div>
        </PageReadyGate>
  );
}



