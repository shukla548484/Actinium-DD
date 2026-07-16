"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signalPendingTasksChanged } from "@/lib/pending-tasks-coordinator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RequisitionTable } from "@/components/RequisitionTable";
import ActiniumLoader from "@/components/ActiniumLoader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  CheckCircle, 
  Shield, 
  Clock,
  UserCheck,
  FileText,
  Ship,
  User,
  ArrowLeft,
} from "lucide-react";
import {
  Requisition,
  RequisitionFilters,
  PaginatedRequisitions,
  GenerationStatus,
  RequisitionStatus,
  isMaster,
} from "@/lib/types/requisition";
import { toast } from "sonner";
import { navigateWithReturnTo } from "@/lib/navigation/safe-return-to";

// Mock current user - In real app, this would come from session/auth
// NOTE: This is a mock page - in production, fetch real user from API
const MOCK_CURRENT_USER = {
  id: "current-user-id",
  firstName: "John",
  lastName: "Doe",
  designation: "Master",
  designationAccessLevel: 25, // Use database field directly
  email: "john.doe@example.com"
};

export default function MasterApprovalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const { ready, markSuccess } = usePageBootstrap();
  const [pendingRequisitions, setPendingRequisitions] = useState<Requisition[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(0);
  const [isTableLoading, setIsTableLoading] = useState(true);
  const [filters, setFilters] = useState<RequisitionFilters>({});
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [requisitionToApprove, setRequisitionToApprove] = useState<Requisition | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // Check user access level - use database field
  const userAccessLevel = MOCK_CURRENT_USER.designationAccessLevel;
  const isUserMaster = isMaster(userAccessLevel);

  const handleBack = () => {
    navigateWithReturnTo(router, returnTo);
  };

  // Fetch pending requisitions that need approval
  const fetchPendingRequisitions = async (pageNum: number = page, currentFilters: RequisitionFilters = filters) => {
    setIsTableLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString(),
        generationStatus: GenerationStatus.CREATED,
        status: RequisitionStatus.NOT_READY,
        ...(currentFilters.search && { search: currentFilters.search }),
        ...(currentFilters.requisitionType && { requisitionType: currentFilters.requisitionType }),
        ...(currentFilters.status && { status: currentFilters.status }),
        ...(currentFilters.vesselId && { vesselId: currentFilters.vesselId }),
        ...(currentFilters.dateFrom && { dateFrom: currentFilters.dateFrom }),
        ...(currentFilters.dateTo && { dateTo: currentFilters.dateTo }),
      });

      const response = await fetch(`/api/requisitions?${params}`);
      if (response.ok) {
        const data: PaginatedRequisitions = await response.json();
        
        // Filter only requisitions that need Master approval (starting with 'V')
        const needsApproval = data.requisitions?.filter(req => 
          req.requisitionNumber.startsWith('V')
        ) || [];
        
        setPendingRequisitions(needsApproval);
        setTotal(needsApproval.length);
        setPage(data.page || 1);
        setTotalPages(Math.ceil(needsApproval.length / limit));
      } else {
        toast.error("Failed to fetch pending requisitions");
        setPendingRequisitions([]);
        setTotal(0);
        setTotalPages(0);
      }
    } catch (error) {
      console.error("Error fetching pending requisitions:", error);
      toast.error("Failed to fetch pending requisitions");
      setPendingRequisitions([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setIsTableLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      try {
        // Check access first
        if (!isUserMaster) {
          setAccessDenied(true);
          markSuccess();
          return;
        }

        // Fetch pending requisitions
        await fetchPendingRequisitions();
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load page data");
      } finally {
        markSuccess();
      }
    };

    loadData();
  }, [isUserMaster, markSuccess]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    fetchPendingRequisitions(newPage, filters);
  };

  // Handle filters change
  const handleFiltersChange = (newFilters: RequisitionFilters) => {
    setFilters(newFilters);
    fetchPendingRequisitions(1, newFilters);
  };

  // Handle view requisition - Navigate to view page
  const handleViewRequisition = (requisition: Requisition) => {
    window.location.href = `/purchase/requisitions/${requisition.id}/view`;
  };

  // Handle approve click
  const handleApproveClick = (requisition: Requisition) => {
    setRequisitionToApprove(requisition);
    setApprovalDialogOpen(true);
  };

  // Handle approve confirmation
  const handleApproveConfirm = async () => {
    if (!requisitionToApprove) return;

    setIsApproving(true);
    try {
      const response = await fetch(`/api/requisitions/${requisitionToApprove.id}/approve`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          approvedById: MOCK_CURRENT_USER.id,
        }),
      });

      if (response.ok) {
        toast.success(`Requisition ${requisitionToApprove.requisitionNumber} approved successfully!`);
        signalPendingTasksChanged();
        setApprovalDialogOpen(false);
        setRequisitionToApprove(null);
        fetchPendingRequisitions(page, filters); // Refresh the list
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to approve requisition");
      }
    } catch (error) {
      console.error("Error approving requisition:", error);
      toast.error("Failed to approve requisition");
    } finally {
      setIsApproving(false);
    }
  };
  if (accessDenied) {
    return (
      <div className="space-y-4">
        <main className="mx-auto py-4" style={{ width: "90%", maxWidth: "90vw" }}>
          <Card>
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <Shield className="h-16 w-16 text-destructive" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
                <p className="text-foreground">
                  This page is restricted to Masters only. Only users with Master designation (access level 25) can approve requisitions.
                </p>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-foreground">
                    <strong>Your Current Designation:</strong> {MOCK_CURRENT_USER.designation || "Not Set"}
                    <br />
                    <strong>Your Access Level:</strong> {userAccessLevel || "Unknown"}
                    <br />
                    <strong>Required:</strong> Master (Access Level 25)
                  </p>
                </div>
                <Button onClick={handleBack}>
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>

    );
  }

  return (<PageReadyGate ready={ready}>
    <div className="w-full space-y-4">
      <main className="w-full py-4">
        {/* Header Section */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="mb-2 h-7 -ml-1 px-2 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Master Approval</h1>
              <p className="text-foreground">
                Review and approve draft requisitions that require Master authorization.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-success px-4 py-2 rounded-lg">
              <UserCheck className="h-5 w-5 text-success" />
              <span className="text-sm font-medium text-success">Master Access</span>
            </div>
          </div>
        </div>

        {/* Main Content Layout — stats ~1/6 width (50% narrower than prior 1/3), table fills remainder */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,5fr)] gap-4 lg:gap-5">
          {/* Left Column - Statistics Cards */}
          <div className="space-y-3 min-w-0">
            <Card>
              <CardHeader className="px-3 py-2.5 pb-1">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-warning shrink-0" />
                  Pending Approval
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0">
                <div className="text-xl font-bold text-foreground">{total}</div>
                <p className="text-xs text-foreground">Requisitions waiting</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="px-3 py-2.5 pb-1">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-info shrink-0" />
                  High Priority
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0">
                <div className="text-xl font-bold text-foreground">
                  {pendingRequisitions.filter(req => 
                    req.items?.some(item => item.urgency === 'URGENT')
                  ).length}
                </div>
                <p className="text-xs text-foreground">Urgent items</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="px-3 py-2.5 pb-1">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Ship className="h-4 w-4 text-info shrink-0" />
                  Vessels Involved
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0">
                <div className="text-xl font-bold text-foreground">
                  {new Set(pendingRequisitions.map(req => req.vesselId)).size}
                </div>
                <p className="text-xs text-foreground">Different vessels</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="px-3 py-2.5 pb-1">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <User className="h-4 w-4 text-success shrink-0" />
                  Requestors
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0">
                <div className="text-xl font-bold text-foreground">
                  {new Set(pendingRequisitions.map(req => req.createdById)).size}
                </div>
                <p className="text-xs text-foreground">Different users</p>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Requisitions Table */}
          <div className="min-w-0 w-full">
            <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Requisitions Pending Master Approval
            </CardTitle>
            <CardDescription>
              All draft requisitions that require Master authorization before becoming active.
            </CardDescription>
          </CardHeader>
          <CardContent className="w-full min-w-0">
            <RequisitionTable
              requisitions={pendingRequisitions}
              total={total}
              page={page}
              limit={limit}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              onEdit={() => {}} // Masters don't edit, they approve
              onDelete={() => {}} // Masters don't delete in approval view
              onView={handleViewRequisition}
              onApprove={handleApproveClick}
              onFiltersChange={handleFiltersChange}
              isLoading={isTableLoading}
              currentUser={{
                id: MOCK_CURRENT_USER.id,
                designation: MOCK_CURRENT_USER.designation,
              }}
              showDraftsOnly={true}
              showApprovalActions={true}
            />
          </CardContent>
        </Card>

            {/* Empty State */}
            {!isTableLoading && pendingRequisitions.length === 0 && (
              <Card className="mt-6">
                <CardContent className="p-12">
                  <div className="text-center space-y-4">
                    <div className="flex justify-center">
                      <CheckCircle className="h-16 w-16 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground">No Pending Approvals</h3>
                    <p className="text-foreground max-w-md mx-auto">
                      There are currently no draft requisitions waiting for Master approval. 
                      All requisitions have been processed or none require approval.
                    </p>
                    <div className="flex justify-center gap-4 mt-6">
                      <Button 
                        variant="outline"
                        onClick={() => window.location.href = '/purchase/draft-requisitions'}
                      >
                        View All Drafts
                      </Button>
                      <Button 
                        onClick={() => window.location.href = '/purchase/view-requisitions'}
                      >
                        View All Requisitions
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Approval Confirmation Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              Approve Requisition
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to approve requisition "{requisitionToApprove?.requisitionNumber}"?
              This action will activate the requisition and start the procurement workflow.
            </DialogDescription>
          </DialogHeader>
          
          {requisitionToApprove && (
            <div className="py-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Heading:</span>
                    <p className="text-foreground">{requisitionToApprove.heading}</p>
                  </div>
                  <div>
                    <span className="font-medium">Vessel:</span>
                    <p className="text-foreground">{requisitionToApprove.vessel?.name}</p>
                  </div>
                  <div>
                    <span className="font-medium">Created By:</span>
                    <p className="text-foreground">
                      {requisitionToApprove.createdBy?.firstName} {requisitionToApprove.createdBy?.lastName}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium">Items:</span>
                    <p className="text-foreground">{requisitionToApprove.items?.length || 0} items</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setApprovalDialogOpen(false)}
              disabled={isApproving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleApproveConfirm}
              disabled={isApproving}
            >
              {isApproving ? (
                <ActiniumLoader size="sm" showText={false} showDots={false} />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Approve Requisition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PageReadyGate>
  );
}