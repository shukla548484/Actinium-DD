"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Calendar,
  DollarSign,
  Building2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Check,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { format } from "date-fns";
import { useVessels } from "@/hooks/useStaticData";
import { Ship } from "lucide-react";
import { cn } from "@/lib/utils";
import { TablePagination } from "@/components/ui/table-pagination";
import { TableSerialHead, TableSerialCell } from "@/components/ui/table-serial-column";

interface Contract {
  id: string;
  contractNumber: string;
  contractType: string;
  title: string;
  vendor: {
    id: string;
    name: string;
    vendorId: string;
  };
  startDate: string;
  endDate: string;
  contractValue: number;
  currency: string;
  status: string;
  isGlobal: boolean;
  createdAt: string;
  _count: {
    requisitions: number;
    purchaseOrders: number;
  };
}

export default function ContractsPage() {
  const { ready, markSuccess } = usePageBootstrap();
  const { data: vessels = [], isLoading: vesselsLoading } = useVessels({ limit: 100, isActive: true });
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [vesselFilter, setVesselFilter] = useState<string>("all");
  const [vendors, setVendors] = useState<Array<{ id: string; name: string; vendorId?: string }>>([]);
  const [vendorComboboxOpen, setVendorComboboxOpen] = useState(false);
  const initialLoadDone = useRef(false);

  // Initial load: fetch data first, then hide page loader so user never sees empty content
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await loadVendors();
      if (!cancelled) await loadContracts();
      if (!cancelled) {
        initialLoadDone.current = true;
        markSuccess();
      }
    };
    run();
    return () => { cancelled = true; };
  }, [markSuccess]);

  // Refetch when filters or page change (skip first run to avoid double-fetch with initial effect)
  useEffect(() => {
    if (!initialLoadDone.current) return;
    loadContracts();
  }, [page, search, statusFilter, vendorFilter, vesselFilter]);

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

  const loadContracts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      });

      if (search) params.append("search", search);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (vendorFilter !== "all") params.append("vendorId", vendorFilter);
      if (vesselFilter !== "all") params.append("vesselId", vesselFilter);

      const response = await fetch(`/api/contracts?${params}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts || []);
        setTotal(data.total || 0);
      } else {
        const errorData = await response.json().catch(() => ({ error: "Failed to load contracts" }));
        console.error("Error loading contracts:", errorData);
        toast.error(errorData.error || errorData.details || "Failed to load contracts");
      }
    } catch (error: any) {
      console.error("Error loading contracts:", error);
      toast.error(error?.message || "Error loading contracts");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, contractNumber: string) => {
    if (!confirm(`Are you sure you want to delete contract ${contractNumber}?`)) return;

    try {
      const response = await fetch(`/api/contracts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        toast.success("Contract deleted");
        loadContracts();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete contract");
      }
    } catch (error) {
      console.error("Error deleting contract:", error);
      toast.error("Error deleting contract");
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      DRAFT: { label: "Draft", variant: "outline" },
      ACTIVE: { label: "Active", variant: "default" },
      EXPIRED: { label: "Expired", variant: "secondary" },
      TERMINATED: { label: "Terminated", variant: "destructive" },
      PENDING_RENEWAL: { label: "Pending Renewal", variant: "outline" },
      SUSPENDED: { label: "Suspended", variant: "secondary" },
    };

    const config = statusConfig[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (<PageReadyGate ready={ready}>
    <div className="space-y-4">
      <main className="mx-auto py-4" style={{ width: "90%", maxWidth: "90vw" }}>
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Contract Management</h1>
            <p className="text-foreground mt-1">Manage vendor contracts and agreements</p>
          </div>
          <Link href="/purchase/contracts/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Contract
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search contracts..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                  <SelectItem value="TERMINATED">Terminated</SelectItem>
                  <SelectItem value="PENDING_RENEWAL">Pending Renewal</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Popover open={vendorComboboxOpen} onOpenChange={setVendorComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={vendorComboboxOpen}
                    className="w-full justify-between"
                  >
                    <span className="truncate text-left flex-1">
                      {vendorFilter === "all"
                        ? "All Vendors"
                        : vendors.find((vendor) => vendor.id === vendorFilter)?.name || "Select vendor..."}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder="Search vendors..." />
                    <CommandList>
                      <CommandEmpty>No vendors found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all"
                          onSelect={() => {
                            setVendorFilter("all");
                            setPage(1);
                            setVendorComboboxOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              vendorFilter === "all" ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <Building2 className="mr-2 h-4 w-4" />
                          <span>All Vendors</span>
                        </CommandItem>
                        {vendors.map((vendor) => (
                          <CommandItem
                            key={vendor.id}
                            value={`${vendor.name} ${vendor.vendorId || ""}`}
                            onSelect={() => {
                              setVendorFilter(vendor.id);
                              setPage(1);
                              setVendorComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                vendorFilter === vendor.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <Building2 className="mr-2 h-4 w-4" />
                            <span className="truncate">
                              {vendor.name}
                              {vendor.vendorId && ` (${vendor.vendorId})`}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Select value={vesselFilter} onValueChange={(value) => { setVesselFilter(value); setPage(1); }}>
                <SelectTrigger width="vessel">
                  <SelectValue placeholder="Filter by vessel" />
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
              <Button variant="outline" onClick={loadContracts}>
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Contracts Table */}
        <Card>
          <CardHeader>
            <CardTitle>Contracts ({total})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading contracts...</p>
              </div>
            ) : contracts.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No contracts found</p>
                <Link href="/purchase/contracts/create">
                  <Button className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Contract
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                      <TableSerialHead />
                        <TableHead>Contract Number</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Usage</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contracts.map((contract, index) => (
                        <TableRow key={contract.id}>
                          <TableSerialCell serialNo={index + 1} />
                          <TableCell className="font-medium">{contract.contractNumber}</TableCell>
                          <TableCell>{contract.title}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{contract.vendor.name}</div>
                              <div className="text-xs text-muted-foreground">{contract.vendor.vendorId}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {contract.contractType === "INVOICE_BASED"
                              ? "Invoice based"
                              : contract.contractType.replace(/_/g, " ")}
                          </TableCell>
                          <TableCell>{format(new Date(contract.startDate), "MMM dd, yyyy")}</TableCell>
                          <TableCell>{format(new Date(contract.endDate), "MMM dd, yyyy")}</TableCell>
                          <TableCell>{formatCurrency(contract.contractValue, contract.currency)}</TableCell>
                          <TableCell>{getStatusBadge(contract.status)}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{contract._count.requisitions} Reqs</div>
                              <div>{contract._count.purchaseOrders} POs</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Link href={`/purchase/contracts/${contract.id}/view`}>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Link href={`/purchase/contracts/${contract.id}/edit`}>
                                <Button variant="ghost" size="sm">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(contract.id, contract.contractNumber)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <TablePagination
                  page={page}
                  pageSize={15}
                  total={total}
                  onPageChange={setPage}
                  itemLabel="contracts"
                  disabled={loading}
                />
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
        </PageReadyGate>
  );
}





