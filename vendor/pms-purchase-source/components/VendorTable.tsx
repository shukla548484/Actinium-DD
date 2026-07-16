"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TablePageSizeSelect, TablePagination } from "@/components/ui/table-pagination";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Search,
  Star,
  Mail,
  ShieldCheck,
} from "lucide-react";
import ActiniumLoader from "@/components/ActiniumLoader";
import { StarRating } from "@/components/StarRating";
import { TableSerialHead, TableSerialCell } from "@/components/ui/table-serial-column";
import { toast } from "sonner";
import { VENDOR_VERIFICATION_STATUS } from "@/lib/vendor-verification";

interface Vendor {
  id: string;
  name: string;
  primaryEmail: string;
  secondaryEmail?: string;
  phone?: string;
  country: string;
  city?: string;
  contactPerson?: string;
  serviceTypes: string[];
  serviceCountries: string[];
  rating: number;
  isActive: boolean;
  isBlacklisted: boolean;
  registrationComplete?: boolean;
  verificationStatus?: string;
  blacklistReason?: string;
  umbrellaCompany?: {
    id: string;
    name: string;
  };
  createdAt: string;
}

interface VendorFilters {
  search?: string;
  country?: string;
  serviceType?: string;
  isActive?: boolean;
  isBlacklisted?: boolean;
  rating?: number;
}

interface VendorTableProps {
  vendors: Vendor[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onView: (vendor: Vendor) => void;
  onEdit: (vendor: Vendor) => void;
  onDelete: (vendor: Vendor) => void;
  onRate: (vendorId: string, rating: number) => void;
  onFiltersChange: (filters: VendorFilters) => void;
  isLoading?: boolean;
  canVerifyVendors?: boolean;
  onVendorVerified?: () => void;
}

export function VendorTable({
  vendors,
  total,
  page,
  limit,
  onPageChange,
  onLimitChange,
  onView,
  onEdit,
  onDelete,
  onRate,
  onFiltersChange,
  isLoading = false,
  canVerifyVendors = false,
  onVendorVerified,
}: VendorTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [blacklistFilter, setBlacklistFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState<Vendor | null>(null);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [vendorToRate, setVendorToRate] = useState<Vendor | null>(null);
  const [newRating, setNewRating] = useState(0);
  const [resendingVendorId, setResendingVendorId] = useState<string | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [vendorToApprove, setVendorToApprove] = useState<Vendor | null>(null);
  const [approvingVendorId, setApprovingVendorId] = useState<string | null>(null);

  const isPendingVerification = (vendor: Vendor) =>
    vendor.registrationComplete === true &&
    (vendor.verificationStatus ?? VENDOR_VERIFICATION_STATUS.PENDING) ===
      VENDOR_VERIFICATION_STATUS.PENDING;

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    applyFilters({
      search: value || undefined,
    });
  };

  const handleCountryFilter = (value: string) => {
    setCountryFilter(value);
    applyFilters({
      country: value === "all" ? undefined : value,
    });
  };

  const handleServiceTypeFilter = (value: string) => {
    setServiceTypeFilter(value);
    applyFilters({
      serviceType: value === "all" ? undefined : value,
    });
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    applyFilters({
      isActive: value === "all" ? undefined : value === "active",
    });
  };

  const handleBlacklistFilter = (value: string) => {
    setBlacklistFilter(value);
    applyFilters({
      isBlacklisted: value === "all" ? undefined : value === "blacklisted",
    });
  };

  const handleRatingFilter = (value: string) => {
    setRatingFilter(value);
    applyFilters({
      rating: value === "all" ? undefined : parseInt(value),
    });
  };

  const applyFilters = (updates: Partial<VendorFilters>) => {
    onFiltersChange({
      search: searchTerm || undefined,
      country: countryFilter === "all" ? undefined : countryFilter,
      serviceType: serviceTypeFilter === "all" ? undefined : serviceTypeFilter,
      isActive: statusFilter === "all" ? undefined : statusFilter === "active",
      isBlacklisted: blacklistFilter === "all" ? undefined : blacklistFilter === "blacklisted",
      rating: ratingFilter === "all" ? undefined : parseInt(ratingFilter),
      ...updates,
    });
  };

  const handleDeleteClick = (vendor: Vendor) => {
    setVendorToDelete(vendor);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (vendorToDelete) {
      onDelete(vendorToDelete);
      setDeleteDialogOpen(false);
      setVendorToDelete(null);
    }
  };

  const handleRateClick = (vendor: Vendor) => {
    setVendorToRate(vendor);
    setNewRating(vendor.rating);
    setRatingDialogOpen(true);
  };

  const handleRateConfirm = () => {
    if (vendorToRate) {
      onRate(vendorToRate.id, newRating);
      setRatingDialogOpen(false);
      setVendorToRate(null);
      setNewRating(0);
    }
  };

  const handleApproveClick = (vendor: Vendor) => {
    setVendorToApprove(vendor);
    setApproveDialogOpen(true);
  };

  const handleApproveConfirm = async () => {
    if (!vendorToApprove) return;

    setApprovingVendorId(vendorToApprove.id);
    try {
      const res = await fetch(`/api/vendors/${vendorToApprove.id}/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to approve vendor");
      }
      toast.success(data.message || "Vendor registration verified");
      setApproveDialogOpen(false);
      setVendorToApprove(null);
      onVendorVerified?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to approve vendor"
      );
    } finally {
      setApprovingVendorId(null);
    }
  };

  const handleResendRegistration = async (vendor: Vendor) => {
    setResendingVendorId(vendor.id);
    try {
      const res = await fetch(`/api/vendors/${vendor.id}/resend-registration`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to resend registration link");
      }
      toast.success(data.message || "Registration link sent");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to resend registration link"
      );
    } finally {
      setResendingVendorId(null);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Get unique countries and service types from vendors
  const uniqueCountries = Array.from(new Set(vendors.map(v => v.country)));
  const allServiceTypes = ["STORES", "SPARES", "AGENCY", "CREWING", "BUNKERING", "CTM"];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
            style={{ fontSize: "12px" }}
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Select value={countryFilter} onValueChange={handleCountryFilter}>
            <SelectTrigger className="w-36" style={{ fontSize: "12px" }}>
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {uniqueCountries.map((country) => (
                <SelectItem key={country} value={country}>
                  {country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={serviceTypeFilter} onValueChange={handleServiceTypeFilter}>
            <SelectTrigger className="w-36" style={{ fontSize: "12px" }}>
              <SelectValue placeholder="Service Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              {allServiceTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={handleStatusFilter}>
            <SelectTrigger className="w-32" style={{ fontSize: "12px" }}>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Select value={blacklistFilter} onValueChange={handleBlacklistFilter}>
            <SelectTrigger className="w-32" style={{ fontSize: "12px" }}>
              <SelectValue placeholder="Blacklist" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="blacklisted">Blacklisted</SelectItem>
              <SelectItem value="not-blacklisted">Not Blacklisted</SelectItem>
            </SelectContent>
          </Select>

          <Select value={ratingFilter} onValueChange={handleRatingFilter}>
            <SelectTrigger className="w-32" style={{ fontSize: "12px" }}>
              <SelectValue placeholder="Rating" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratings</SelectItem>
              <SelectItem value="5">5 Stars</SelectItem>
              <SelectItem value="4">4+ Stars</SelectItem>
              <SelectItem value="3">3+ Stars</SelectItem>
              <SelectItem value="2">2+ Stars</SelectItem>
              <SelectItem value="1">1+ Stars</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
                      <TableSerialHead />
              <TableHead style={{ fontSize: "12px" }}>Name</TableHead>
              <TableHead style={{ fontSize: "12px" }}>Email</TableHead>
              <TableHead style={{ fontSize: "12px" }}>Country</TableHead>
              <TableHead style={{ fontSize: "12px" }}>Services</TableHead>
              <TableHead style={{ fontSize: "12px" }}>Rating</TableHead>
              <TableHead style={{ fontSize: "12px" }}>Status</TableHead>
              <TableHead style={{ fontSize: "12px" }}>Created</TableHead>
              <TableHead className="w-[120px]" style={{ fontSize: "12px" }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableSerialCell serialNo={1} />
                <TableCell colSpan={9} className="text-center py-8">
                  <ActiniumLoader size="md" text="Loading vendors..." />
                </TableCell>
              </TableRow>
            ) : vendors.length === 0 ? (
              <TableRow>
                <TableSerialCell serialNo={1} />
                <TableCell colSpan={9} className="text-center py-8" style={{ fontSize: "12px" }}>
                  No vendors found
                </TableCell>
              </TableRow>
            ) : (
              vendors.map((vendor, index) => (
                <TableRow key={vendor.id}>
                  <TableSerialCell serialNo={index + 1} />
                  <TableCell style={{ fontSize: "12px" }}>
                    <div className="font-medium">{vendor.name}</div>
                    {vendor.contactPerson && (
                      <div className="text-muted-foreground" style={{ fontSize: "10px" }}>
                        {vendor.contactPerson}
                      </div>
                    )}
                  </TableCell>
                  <TableCell style={{ fontSize: "12px" }}>{vendor.primaryEmail}</TableCell>
                  <TableCell style={{ fontSize: "12px" }}>
                    {vendor.country}
                    {vendor.city && (
                      <div className="text-muted-foreground" style={{ fontSize: "10px" }}>
                        {vendor.city}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {vendor.serviceTypes.slice(0, 2).map((type, index) => (
                        <Badge key={type} variant="outline" style={{ fontSize: "10px" }}>
                          {type}
                        </Badge>
                      ))}
                      {vendor.serviceTypes.length > 2 && (
                        <Badge variant="outline" style={{ fontSize: "10px" }}>
                          +{vendor.serviceTypes.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StarRating rating={vendor.rating} readonly size={16} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={vendor.isActive ? "default" : "secondary"} style={{ fontSize: "10px" }}>
                        {vendor.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {vendor.registrationComplete && vendor.verificationStatus === "PENDING" ? (
                        <Badge variant="outline" className="text-amber-700 border-amber-300" style={{ fontSize: "10px" }}>
                          Pending verification
                        </Badge>
                      ) : null}
                      {vendor.verificationStatus === "VERIFIED" ? (
                        <Badge variant="outline" className="text-green-700 border-green-300" style={{ fontSize: "10px" }}>
                          Verified
                        </Badge>
                      ) : null}
                      {vendor.isBlacklisted && (
                        <Badge variant="destructive" style={{ fontSize: "10px" }}>
                          Blacklisted
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell style={{ fontSize: "12px" }}>{formatDate(vendor.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {canVerifyVendors && isPendingVerification(vendor) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-green-700 border-green-300 hover:bg-green-50"
                          disabled={approvingVendorId === vendor.id}
                          onClick={() => handleApproveClick(vendor)}
                          style={{ fontSize: "11px" }}
                        >
                          <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                          {approvingVendorId === vendor.id ? "Approving…" : "Approve"}
                        </Button>
                      ) : null}
                      <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView(vendor)} style={{ fontSize: "12px" }}>
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(vendor)} style={{ fontSize: "12px" }}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRateClick(vendor)} style={{ fontSize: "12px" }}>
                          <Star className="mr-2 h-4 w-4" />
                          Rate
                        </DropdownMenuItem>
                        {canVerifyVendors && isPendingVerification(vendor) ? (
                          <DropdownMenuItem
                            onClick={() => handleApproveClick(vendor)}
                            disabled={approvingVendorId === vendor.id}
                            style={{ fontSize: "12px" }}
                          >
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            Approve registration
                          </DropdownMenuItem>
                        ) : null}
                        {vendor.registrationComplete === false ? (
                          <DropdownMenuItem
                            onClick={() => void handleResendRegistration(vendor)}
                            disabled={resendingVendorId === vendor.id}
                            style={{ fontSize: "12px" }}
                          >
                            <Mail className="mr-2 h-4 w-4" />
                            {resendingVendorId === vendor.id
                              ? "Sending…"
                              : "Resend registration link"}
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(vendor)}
                          className="text-red-600"
                          style={{ fontSize: "12px" }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
            {/* Empty row for scrollbar spacing */}
            <TableRow>
              <TableSerialCell serialNo={1} />
              <TableCell colSpan={13} className="h-4 p-0"></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <TablePagination
          page={page}
          pageSize={limit}
          total={total}
          onPageChange={onPageChange}
          itemLabel="vendors"
          className="mt-0 flex-1"
          disabled={isLoading}
          hideWhenSinglePage={false}
        />
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page</span>
          <TablePageSizeSelect
            value={limit}
            onValueChange={(size) => onLimitChange(size)}
            optionSuffix=" / page"
            triggerClassName="w-[7.5rem]"
          />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontSize: "14px" }}>Delete Vendor</AlertDialogTitle>
            <AlertDialogDescription style={{ fontSize: "12px" }}>
              Are you sure you want to delete <strong>{vendorToDelete?.name}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ fontSize: "12px" }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
              style={{ fontSize: "12px" }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontSize: "14px" }}>Approve vendor registration</AlertDialogTitle>
            <AlertDialogDescription style={{ fontSize: "12px" }}>
              Confirm verification for <strong>{vendorToApprove?.name}</strong>? This enables vendor
              portal access for quotes, orders, and payments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ fontSize: "12px" }} disabled={!!approvingVendorId}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleApproveConfirm()}
              disabled={!!approvingVendorId}
              style={{ fontSize: "12px" }}
            >
              {approvingVendorId ? "Approving…" : "Confirm approval"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rating Dialog */}
      <AlertDialog open={ratingDialogOpen} onOpenChange={setRatingDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontSize: "14px" }}>Rate Vendor</AlertDialogTitle>
            <AlertDialogDescription style={{ fontSize: "12px" }}>
              Rate <strong>{vendorToRate?.name}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-center py-4">
            <StarRating
              rating={newRating}
              onRatingChange={setNewRating}
              size={32}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ fontSize: "12px" }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRateConfirm} style={{ fontSize: "12px" }}>
              Save Rating
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
