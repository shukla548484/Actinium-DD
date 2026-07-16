"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ActiniumLoader from "@/components/ActiniumLoader";
import { Plus, Download, Upload, Store, AlertCircle, CheckCircle, Users, Mail } from "lucide-react";
import { toast } from "sonner";
import { VendorTable } from "@/components/VendorTable";
import { VendorBulkUploadDialog } from "@/components/VendorBulkUploadDialog";
import { VendorInviteDialog } from "@/components/vendor/VendorInviteDialog";
import { useRouter } from "next/navigation";
import { canVerifyVendorRegistration } from "@/lib/vendor-verification";

interface Vendor {
  id: string;
  vendorId?: string;
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

interface PaginatedVendors {
  vendors: Vendor[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function PurchaseVendorManagementPage() {
  const router = useRouter();
  // Don't block page rendering - set to false immediately
  const [pageLoading, setPageLoading] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<VendorFilters>({});
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [canVerifyVendors, setCanVerifyVendors] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const level =
          data.user?.designationAccessLevel ?? data.designationAccessLevel ?? null;
        setCanVerifyVendors(canVerifyVendorRegistration(level));
      } catch {
        // Non-blocking — approve controls stay hidden if session fetch fails
      }
    })();
  }, []);

  // Fetch vendors
  const fetchVendors = async (pageNum: number = page, currentFilters: VendorFilters = filters) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString(),
        ...(currentFilters.search && { search: currentFilters.search }),
        ...(currentFilters.country && { country: currentFilters.country }),
        ...(currentFilters.serviceType && { serviceType: currentFilters.serviceType }),
        ...(currentFilters.isActive !== undefined && { isActive: currentFilters.isActive.toString() }),
        ...(currentFilters.isBlacklisted !== undefined && { isBlacklisted: currentFilters.isBlacklisted.toString() }),
        ...(currentFilters.rating && { rating: currentFilters.rating.toString() }),
      });

      const { fetchJsonWithTimeout } = await import('@/lib/utils/fetch-with-timeout');
      const data = await fetchJsonWithTimeout<PaginatedVendors>(`/api/vendors?${params}`, {
        timeout: 15000,
        credentials: "include",
      });
      setVendors(data.vendors || []);
      setTotal(data.total || 0);
      setPage(data.page || 1);
    } catch (error: any) {
      console.error("Error fetching vendors:", error);
      if (error.message?.includes('timeout')) {
        toast.error("Request timed out. Please try again.");
      } else {
        const errorMessage = error.message || "Failed to fetch vendors";
        toast.error(errorMessage);
      }
      setVendors([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    // Page already loads immediately - just fetch vendors
    fetchVendors();
  }, [page, limit]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const handleFiltersChange = (newFilters: VendorFilters) => {
    setFilters(newFilters);
    setPage(1);
    fetchVendors(1, newFilters);
  };

  const handleViewVendor = (vendor: Vendor) => {
    router.push(`/purchase/vendor-management/view/${vendor.id}`);
  };

  const handleEditVendor = (vendor: Vendor) => {
    router.push(`/purchase/vendor-management/edit/${vendor.id}`);
  };

  const handleDeleteVendor = async (vendor: Vendor) => {
    if (!confirm(`Are you sure you want to delete vendor "${vendor.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/vendors/${vendor.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Vendor deleted successfully");
        fetchVendors(page, filters);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete vendor");
      }
    } catch (error) {
      console.error("Error deleting vendor:", error);
      toast.error("Failed to delete vendor");
    }
  };

  const handleRateVendor = async (vendorId: string, rating: number) => {
    try {
      const response = await fetch(`/api/vendors/${vendorId}/rate`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rating }),
      });

      if (response.ok) {
        toast.success("Vendor rating updated successfully");
        fetchVendors(page, filters);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update vendor rating");
      }
    } catch (error) {
      console.error("Error rating vendor:", error);
      toast.error("Failed to update vendor rating");
    }
  };

  // Handle download template
  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch("/api/vendors/template");
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "vendor-template.xlsx";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("Template downloaded successfully");
      } else {
        toast.error("Failed to download template");
      }
    } catch (error) {
      console.error("Error downloading template:", error);
      toast.error("Failed to download template");
    }
  };

  // Handle export vendors
  const handleExportVendors = async () => {
    try {
      const response = await fetch("/api/vendors/export");
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `vendors-export-${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("Vendors exported successfully");
      } else {
        toast.error("Failed to export vendors");
      }
    } catch (error) {
      console.error("Error exporting vendors:", error);
      toast.error("Failed to export vendors");
    }
  };

  // Handle bulk upload success
  const handleBulkUploadSuccess = () => {
    setIsBulkUploadOpen(false);
    fetchVendors(page, filters);
  };

  // Calculate statistics
  const stats = {
    total: total,
    active: vendors.filter(v => v.isActive).length,
    blacklisted: vendors.filter(v => v.isBlacklisted).length,
    highRated: vendors.filter(v => v.rating >= 4).length,
  };

  // Show page loader while initial data is loading
  // Page structure renders immediately - no blocking loader
  // Data loads in background and displays when ready

  return (
    <div className="w-full space-y-4">
      <div className="w-full py-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ fontSize: "22px" }} className="font-bold tracking-tight">
              Vendor Management
            </h1>
            <p style={{ fontSize: "12px" }} className="text-muted-foreground">
              Manage vendors, ratings, and bulk operations
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
            <Button variant="outline" onClick={() => setIsBulkUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Bulk Upload
            </Button>
            <Button variant="outline" onClick={handleExportVendors}>
              <Download className="mr-2 h-4 w-4" />
              Export All
            </Button>
            <Button variant="outline" onClick={() => setIsInviteOpen(true)}>
              <Mail className="mr-2 h-4 w-4" />
              Invite vendor for registration
            </Button>
            <Button onClick={() => router.push("/purchase/vendor-management/create")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Vendor
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 mb-4">
          <Card variant="compact">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 py-2 pb-1">
              <CardTitle style={{ fontSize: "14px" }} className="font-medium">
                Total Vendors
              </CardTitle>
              <Store className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0 pb-2">
              <div className="text-xl font-bold leading-none">{stats.total}</div>
              <p style={{ fontSize: "10px" }} className="text-muted-foreground mt-1">
                All registered vendors
              </p>
            </CardContent>
          </Card>

          <Card variant="compact">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 py-2 pb-1">
              <CardTitle style={{ fontSize: "14px" }} className="font-medium">
                Active Vendors
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0 pb-2">
              <div className="text-xl font-bold leading-none">{stats.active}</div>
              <p style={{ fontSize: "10px" }} className="text-muted-foreground mt-1">
                Currently active
              </p>
            </CardContent>
          </Card>

          <Card variant="compact">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 py-2 pb-1">
              <CardTitle style={{ fontSize: "14px" }} className="font-medium">
                Blacklisted
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0 pb-2">
              <div className="text-xl font-bold leading-none">{stats.blacklisted}</div>
              <p style={{ fontSize: "10px" }} className="text-muted-foreground mt-1">
                Blocked vendors
              </p>
            </CardContent>
          </Card>

          <Card variant="compact">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 py-2 pb-1">
              <CardTitle style={{ fontSize: "14px" }} className="font-medium">
                High Rated (4+)
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0 pb-2">
              <div className="text-xl font-bold leading-none">{stats.highRated}</div>
              <p style={{ fontSize: "10px" }} className="text-muted-foreground mt-1">
                Top performers
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Vendor Table */}
        <Card>
          <CardHeader>
            <CardTitle style={{ fontSize: "15px" }}>Vendors</CardTitle>
            <CardDescription style={{ fontSize: "13px" }}>
              Manage all vendors in your system. Create, update, rate, and bulk import vendors.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VendorTable
              vendors={vendors}
              total={total}
              page={page}
              limit={limit}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
              onView={handleViewVendor}
              onEdit={handleEditVendor}
              onDelete={handleDeleteVendor}
              onRate={handleRateVendor}
              onFiltersChange={handleFiltersChange}
              isLoading={isLoading}
              canVerifyVendors={canVerifyVendors}
              onVendorVerified={() => void fetchVendors(page, filters)}
            />
          </CardContent>
        </Card>

        {/* Bulk Upload Dialog */}
        <VendorBulkUploadDialog
          isOpen={isBulkUploadOpen}
          onClose={() => setIsBulkUploadOpen(false)}
          onSuccess={handleBulkUploadSuccess}
        />
        <VendorInviteDialog
          open={isInviteOpen}
          onOpenChange={setIsInviteOpen}
          onInvited={() => void fetchVendors()}
        />
      </div>
    </div>
  );
}
