"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Mail, 
  MapPin, 
  User,
  CheckCircle,
  XCircle,
  Ship,
  Building2,
  Phone,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { TablePagination } from "@/components/ui/table-pagination";
import { useVessels } from "@/hooks/useStaticData";
import ActiniumLoader from "@/components/ActiniumLoader";
import { TableSerialHead, TableSerialCell } from "@/components/ui/table-serial-column";

interface VesselPayer {
  id: string;
  vesselId: string;
  companyName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  paymentTerms?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  vessel: {
    id: string;
    code: string;
    name: string;
  };
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    designation?: string;
  };
  updatedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    designation?: string;
  };
}

interface Vessel {
  id: string;
  code: string;
  name: string;
}

interface PaginatedPayers {
  payers: VesselPayer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export default function InvoicerPayerPage() {
  const { ready, markSuccess } = usePageBootstrap();
  
  // Use optimized hooks for static data with caching
  const { data: vessels = [], isLoading: vesselsLoading } = useVessels({ limit: 100, isActive: true });
  
  const [payers, setPayers] = useState<VesselPayer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [vesselFilter, setVesselFilter] = useState("");
  const [showPayerForm, setShowPayerForm] = useState(false);
  const [editingPayer, setEditingPayer] = useState<VesselPayer | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [payerToDelete, setPayerToDelete] = useState<VesselPayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    vesselId: "",
    companyName: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    taxId: "",
    paymentTerms: "",
    notes: "",
    isActive: true,
  });

  const limit = 15;

  // Initialize page once static data is loaded
  useEffect(() => {
    if (!vesselsLoading) {
      fetchPayers();
      markSuccess();
    }
  }, [vesselsLoading, markSuccess]);

  useEffect(() => {
    fetchPayers();
  }, [page, searchTerm, vesselFilter]);

  const fetchPayers = async () => {
    // Don't fetch if no vessel is selected
    if (!vesselFilter || vesselFilter === "" || vesselFilter === "all") {
      setPayers([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (searchTerm) params.append("search", searchTerm);
      if (vesselFilter) params.append("vesselId", vesselFilter);

      const response = await fetch(`/api/vessel-payers?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch payers');
      }
      
      const data: PaginatedPayers = await response.json();

      setPayers(data.payers);
      setTotal(data.pagination.total);
      markSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch payers');
      markSuccess();
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayer = () => {
    setEditingPayer(null);
    setFormData({
      vesselId: "",
      companyName: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      country: "",
      taxId: "",
      paymentTerms: "",
      notes: "",
      isActive: true,
    });
    setShowPayerForm(true);
  };

  const handleEditPayer = (payer: VesselPayer) => {
    setEditingPayer(payer);
    setFormData({
      vesselId: payer.vesselId,
      companyName: payer.companyName,
      contactPerson: payer.contactPerson || "",
      email: payer.email || "",
      phone: payer.phone || "",
      address: payer.address || "",
      city: payer.city || "",
      country: payer.country || "",
      taxId: payer.taxId || "",
      paymentTerms: payer.paymentTerms || "",
      notes: payer.notes || "",
      isActive: payer.isActive,
    });
    setShowPayerForm(true);
  };

  const handleDeleteClick = (payer: VesselPayer) => {
    setPayerToDelete(payer);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!payerToDelete) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/vessel-payers/${payerToDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete payer");
      }

      toast.success("Payer deleted successfully");
      setShowDeleteDialog(false);
      setPayerToDelete(null);
      fetchPayers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete payer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);

      const payload = {
        ...formData,
        email: formData.email || undefined,
      };

      const url = editingPayer
        ? `/api/vessel-payers/${editingPayer.id}`
        : "/api/vessel-payers";
      const method = editingPayer ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save payer");
      }

      toast.success(editingPayer ? "Payer updated successfully" : "Payer created successfully");
      setShowPayerForm(false);
      setEditingPayer(null);
      fetchPayers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save payer");
    } finally {
      setSubmitting(false);
    }
  };
  return (<PageReadyGate ready={ready}>
    <div className="space-y-4">
      <main className="w-full py-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Invoicer/Payer Management</h1>
          <p className="text-foreground">
            Manage invoicing companies (payers) for vessels
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="search">Search</Label>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search by company name, contact, email..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="vessel">Vessel</Label>
                <Select
                  value={vesselFilter || "all"}
                  onValueChange={(value) => {
                    setVesselFilter(value === "all" ? "" : value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger id="vessel" className="mt-2" width="vessel">
                    <SelectValue placeholder="Select a vessel..." />
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
              <div className="flex items-end">
                <Button onClick={handleCreatePayer} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Payer/Invoicer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payers Table */}
        <Card>
          <CardHeader>
            <CardTitle>Invoicers/Payers</CardTitle>
            <CardDescription>
              {total} payer(s) found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-14">
                <ActiniumLoader size="md" text="Loading payers…" />
              </div>
            ) : payers.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No payers found. Click "Add Payer/Invoicer" to create one.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                      <TableSerialHead />
                        <TableHead>Company Name</TableHead>
                        <TableHead>Vessel</TableHead>
                        <TableHead>Contact Person</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payers.map((payer, index) => (
                        <TableRow key={payer.id}>
                          <TableSerialCell serialNo={index + 1} />
                          <TableCell className="font-medium">
                            {payer.companyName}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Ship className="h-4 w-4 text-info" />
                              <span>{payer.vessel.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {payer.vessel.code}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            {payer.contactPerson || "-"}
                          </TableCell>
                          <TableCell>
                            {payer.email ? (
                              <div className="flex items-center gap-1">
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                <span>{payer.email}</span>
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {payer.phone ? (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                <span>{payer.phone}</span>
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>{payer.country || "-"}</TableCell>
                          <TableCell>
                            {payer.isActive ? (
                              <Badge variant="default" className="bg-success">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <XCircle className="h-3 w-3 mr-1" />
                                Inactive
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditPayer(payer)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDeleteClick(payer)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <TablePagination
                  page={page}
                  pageSize={limit}
                  total={total}
                  onPageChange={setPage}
                  itemLabel="payers"
                  disabled={loading}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={showPayerForm} onOpenChange={setShowPayerForm}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPayer ? "Edit Payer/Invoicer" : "Add Payer/Invoicer"}
              </DialogTitle>
              <DialogDescription>
                {editingPayer
                  ? "Update the payer/invoicer information"
                  : "Add a new invoicing company (payer) for a vessel"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                <div className="md:col-span-2">
                  <Label htmlFor="vesselId">Vessel *</Label>
                  <Select
                    value={formData.vesselId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, vesselId: value })
                    }
                    required
                  >
                    <SelectTrigger id="vesselId" className="mt-2" width="vessel">
                      <SelectValue placeholder="Select vessel" />
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
                <div className="md:col-span-2">
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) =>
                      setFormData({ ...formData, companyName: e.target.value })
                    }
                    required
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="contactPerson">Contact Person</Label>
                  <Input
                    id="contactPerson"
                    value={formData.contactPerson}
                    onChange={(e) =>
                      setFormData({ ...formData, contactPerson: e.target.value })
                    }
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) =>
                      setFormData({ ...formData, country: e.target.value })
                    }
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    className="mt-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="taxId">Tax ID</Label>
                  <Input
                    id="taxId"
                    value={formData.taxId}
                    onChange={(e) =>
                      setFormData({ ...formData, taxId: e.target.value })
                    }
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="paymentTerms">Payment Terms</Label>
                  <Input
                    id="paymentTerms"
                    value={formData.paymentTerms}
                    onChange={(e) =>
                      setFormData({ ...formData, paymentTerms: e.target.value })
                    }
                    className="mt-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    rows={3}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="isActive" className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData({ ...formData, isActive: e.target.checked })
                      }
                      className="rounded"
                    />
                    Active
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowPayerForm(false);
                    setEditingPayer(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting
                    ? "Saving..."
                    : editingPayer
                    ? "Update"
                    : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Payer/Invoicer</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{payerToDelete?.companyName}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setPayerToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={submitting}
              >
                {submitting ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
        </PageReadyGate>
  );
}

