"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useVessels } from "@/hooks/useStaticData";

interface Contract {
  id: string;
  contractNumber: string;
  contractType: string;
  vendorId: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  renewalDate: string | null;
  contractValue: number;
  currency: string;
  termsAndConditions: string | null;
  status: string;
  isGlobal: boolean;
  applicableVesselIds: string[];
  notes: string | null;
  contractItems: any[];
}

export default function EditContractPage() {
  const { ready, markSuccess } = usePageBootstrap();
  const router = useRouter();
  const params = useParams();
  const contractId = params.id as string;
  
  // Use optimized hooks for static data with caching
  const { data: vessels = [], isLoading: vesselsLoading } = useVessels({ limit: 100, isActive: true });
  
  const [loading, setLoading] = useState(false);
  const [contract, setContract] = useState<Contract | null>(null);
  const [vendors, setVendors] = useState<Array<{ id: string; name: string; vendorId: string }>>([]);

  const [formData, setFormData] = useState({
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
    status: "DRAFT",
    isGlobal: false,
    applicableVesselIds: [] as string[],
    notes: "",
  });

  // Initialize page once static data is loaded
  useEffect(() => {
    if (!vesselsLoading) {
      loadContract();
      loadVendors();
      markSuccess();
    }
  }, [contractId, vesselsLoading, markSuccess]);

  const loadContract = async () => {
    try {
      const response = await fetch(`/api/contracts/${contractId}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        const contract = data.contract;
        setContract(contract);
        setFormData({
          contractType: contract.contractType,
          vendorId: contract.vendorId,
          title: contract.title,
          description: contract.description || "",
          startDate: contract.startDate.split("T")[0],
          endDate: contract.endDate.split("T")[0],
          renewalDate: contract.renewalDate ? contract.renewalDate.split("T")[0] : "",
          contractValue: contract.contractValue.toString(),
          currency: contract.currency,
          termsAndConditions: contract.termsAndConditions || "",
          status: contract.status,
          isGlobal: contract.isGlobal,
          applicableVesselIds: contract.applicableVesselIds || [],
          notes: contract.notes || "",
        });
      } else {
        toast.error("Failed to load contract");
        router.push("/purchase/contracts");
      }
    } catch (error) {
      console.error("Error loading contract:", error);
      toast.error("Error loading contract");
    }
  };

  const loadVendors = async () => {
    try {
      const response = await fetch("/api/vendors?limit=100", { credentials: "include" });
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
        renewalDate: formData.renewalDate || null,
        applicableVesselIds: formData.isGlobal ? [] : formData.applicableVesselIds,
      };

      const response = await fetch(`/api/contracts/${contractId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        toast.error(error.error || error.message || `Failed to update contract (${response.status})`);
        throw new Error(error.error || error.message || `HTTP ${response.status}: Failed to update contract`);
      }
      
      // Success
      toast.success("Contract updated successfully");
      router.push(`/purchase/contracts/${contractId}/view`);
    } catch (error: any) {
      console.error("Error updating contract:", error);
      toast.error("Error updating contract");
    } finally {
      setLoading(false);
    }
  };

  return (<PageReadyGate ready={ready}>
    <div className="space-y-4">
      <main className="mx-auto py-4" style={{ width: "90%", maxWidth: "90vw" }}>
        <div className="mb-6 flex items-center gap-4">
          <Link href={`/purchase/contracts/${contractId}/view`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Edit Contract</h1>
            <p className="text-foreground mt-1">Contract #{contract.contractNumber}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Contract Number</Label>
                  <Input value={contract.contractNumber} disabled />
                </div>
                <div>
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
                </div>
                <div>
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
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="EXPIRED">Expired</SelectItem>
                      <SelectItem value="TERMINATED">Terminated</SelectItem>
                      <SelectItem value="PENDING_RENEWAL">Pending Renewal</SelectItem>
                      <SelectItem value="SUSPENDED">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dates & Financial</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="renewalDate">Renewal Date</Label>
                  <Input
                    id="renewalDate"
                    type="date"
                    value={formData.renewalDate}
                    onChange={(e) => setFormData({ ...formData, renewalDate: e.target.value })}
                  />
                </div>
                <div>
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
                <div>
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

          <div className="mt-6 flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Contract"}
            </Button>
          </div>
        </form>
      </main>
    </div>
        </PageReadyGate>
  );
}



