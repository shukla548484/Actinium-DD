"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { signalPendingTasksChanged } from "@/lib/pending-tasks-coordinator";
import { invalidateRequisitionsListQueries } from "@/lib/requisitions-list-invalidation";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RequisitionStatusBadge } from "@/components/requisition/RequisitionStatusBadge";
import { RequisitionTypeBadge } from "@/components/requisition/RequisitionTypeBadge";
import { RequisitionGenerationStatusBadge } from "@/components/requisition/RequisitionGenerationStatusBadge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ArrowLeft, 
  FileText, 
  Calendar, 
  User, 
  Ship,
  Package,
  CheckCircle,
  RotateCcw,
  AlertCircle,
  X,
  AlertTriangle
} from "lucide-react";
import {
  Requisition,
  RequisitionStatus,
  GenerationStatus,
  REQUISITION_STATUS_LABELS,
  GENERATION_STATUS_LABELS,
  REQUISITION_TYPE_LABELS,
  canApproveRequisition,
  canReturnRequisition
} from "@/lib/types/requisition";
import { toast } from "sonner";
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
import { TablePagination } from "@/components/ui/table-pagination";
import { RequisitionItemsReadOnlyTable } from "@/components/requisition/RequisitionItemsReadOnlyTable";

export default function ApproveRequisitionPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const fromNotification = searchParams.get("from") === "notification";
  const requisitionId = params.id as string;
  
  const { ready, markSuccess } = usePageBootstrap();
  const [requisition, setRequisition] = useState<Requisition | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [returnComment, setReturnComment] = useState("");
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itemsPage, setItemsPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // Fetch current user from API
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch("/api/profile/basic", {
          credentials: "include"
        });
        if (response.ok) {
          const data = await response.json();
          setCurrentUser(data.user);
        } else {
          console.error("Failed to fetch user");
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUser();
  }, []);

  // Fetch requisition
  useEffect(() => {
    const fetchRequisition = async () => {
      if (!requisitionId || !currentUser) return;

      try {
        const response = await fetch(`/api/requisitions/${requisitionId}`, {
          credentials: "include"
        });

        if (response.status === 404) {
          setNotFound(true);
          markSuccess();
          return;
        }

        if (response.status === 403) {
          setAccessDenied(true);
          markSuccess();
          return;
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error("Failed to load requisition:", errorData);
          toast.error(errorData.error || "Failed to load requisition");
          markSuccess();
          return;
        }

        const requisitionData = await response.json();
        setRequisition(requisitionData);

        // Check if user can approve or return
        const accessLevel = currentUser.designationAccessLevel;
        if (!canApproveRequisition(accessLevel) && !canReturnRequisition(accessLevel)) {
          setAccessDenied(true);
        }
      } catch (error) {
        console.error("Error fetching requisition:", error);
        toast.error("Failed to load requisition. Please try again.");
        setNotFound(true);
      } finally {
        markSuccess();
      }
    };

    if (requisitionId && currentUser) {
      fetchRequisition();
    }
  }, [requisitionId, currentUser, markSuccess]);

  useEffect(() => {
    setItemsPage(1);
  }, [requisition?.id, requisition?.items?.length]);

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (date: Date | string) => {
    return new Date(date).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleApprove = async () => {
    if (!currentUser?.id) {
      toast.error("User not authenticated");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/requisitions/${requisitionId}/approve`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          approvedById: currentUser.id,
        }),
      });

      if (response.ok) {
        toast.success(`Requisition ${requisition?.requisitionNumber} approved successfully!`);
        await invalidateRequisitionsListQueries(queryClient);
        signalPendingTasksChanged();
        router.push(fromNotification ? "/notifications" : "/purchase/view-requisitions");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to approve requisition");
      }
    } catch (error) {
      console.error("Error approving requisition:", error);
      toast.error("Failed to approve requisition");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturn = async () => {
    if (!currentUser?.id) {
      toast.error("User not authenticated");
      return;
    }

    if (!returnComment.trim()) {
      toast.error("Please provide a reason for returning this requisition");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/requisitions/${requisitionId}/return`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          returnedById: currentUser.id,
          reason: returnComment.trim(),
        }),
      });

      if (response.ok) {
        toast.success(`Requisition ${requisition?.requisitionNumber} returned for editing!`);
        await invalidateRequisitionsListQueries(queryClient);
        signalPendingTasksChanged();
        router.push(fromNotification ? "/notifications" : "/purchase/view-requisitions");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to return requisition");
      }
    } catch (error) {
      console.error("Error returning requisition:", error);
      toast.error("Failed to return requisition");
    } finally {
      setIsSubmitting(false);
      setShowReturnDialog(false);
      setReturnComment("");
    }
  };
  if (notFound) {
    return (
      <div className="space-y-4">
        <main className="mx-auto py-4" style={{ width: "90%", maxWidth: "90vw" }}>
          <Card>
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <AlertTriangle className="h-16 w-16 text-destructive" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Requisition Not Found</h1>
                <p className="text-foreground">
                  The requisition you're looking for doesn't exist or has been deleted.
                </p>
                <Button onClick={() => router.push("/purchase/view-requisitions")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Requisitions
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>

    );
  }

  if (accessDenied) {
    return (
      <div className="space-y-4">
        <main className="mx-auto py-4" style={{ width: "90%", maxWidth: "90vw" }}>
          <Card>
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <AlertCircle className="h-16 w-16 text-warning" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
                <p className="text-foreground">
                  You don't have permission to approve or return this requisition.
                </p>
                <Button onClick={() => router.push("/purchase/view-requisitions")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Requisitions
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }
  if (!requisition) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">Loading requisition...</div>
    );
  }
  const accessLevel = currentUser?.designationAccessLevel;
  const requisitionItems = requisition.items || [];
  const paginatedItems = requisitionItems.slice(
    (itemsPage - 1) * ITEMS_PER_PAGE,
    itemsPage * ITEMS_PER_PAGE
  );
  const canApprove = canApproveRequisition(accessLevel);
  const canReturn = canReturnRequisition(accessLevel) && 
    (requisition.status === RequisitionStatus.NEW_REQ || 
     requisition.status === RequisitionStatus.REQ_APPROVED ||
     requisition.status === RequisitionStatus.SENT_FOR_QUOTE ||
     requisition.status === RequisitionStatus.QUOTE_RECEIVED ||
     requisition.status === RequisitionStatus.PARTIAL_QUOTE_RECEIVED);

  return (<PageReadyGate ready={ready}>
    <div className="space-y-4">
      <main className="mx-auto py-4" style={{ width: "90%", maxWidth: "90vw" }}>
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {fromNotification && (
                <Link
                  href="/notifications"
                  className="text-sm text-primary hover:underline font-medium inline-flex items-center gap-1"
                >
                  ← Return to Notifications
                </Link>
              )}
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Approve Requisition</h1>
            <p className="text-foreground">
              Review the complete requisition details and approve or return for editing
            </p>
          </div>
        </div>

        {/* Requisition Header Info */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl mb-2">{requisition.heading}</CardTitle>
                <CardDescription className="text-base">
                  {requisition.requisitionNumber}
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <RequisitionTypeBadge type={requisition.requisitionType} className="text-sm" />
                <RequisitionGenerationStatusBadge
                  status={requisition.generationStatus}
                  className="text-sm"
                />
                <RequisitionStatusBadge status={requisition.status} className="text-sm" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <Ship className="h-5 w-5 text-info mt-0.5" />
                <div>
                  <p className="text-sm text-foreground mb-1">Vessel</p>
                  <p className="font-semibold text-foreground">
                    {requisition.vessel?.name || "Unknown"} ({requisition.vessel?.code || "N/A"})
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-info mt-0.5" />
                <div>
                  <p className="text-sm text-foreground mb-1">Date Created</p>
                  <p className="font-semibold text-foreground">
                    {formatDate(requisition.dateOfCreation)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-info mt-0.5" />
                <div>
                  <p className="text-sm text-foreground mb-1">Created By</p>
                  <p className="font-semibold text-foreground">
                    {requisition.createdBy?.firstName} {requisition.createdBy?.lastName}
                  </p>
                  {requisition.createdBy?.designation && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {requisition.createdBy.designation}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {requisition.description && (
              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-sm text-foreground mb-2">Description</p>
                <p className="text-foreground">{requisition.description}</p>
              </div>
            )}

            {requisition.portOfSupply && (
              <div className="mt-4">
                <p className="text-sm text-foreground mb-1">Port of Supply</p>
                <p className="text-foreground">{requisition.portOfSupply}</p>
              </div>
            )}

            {requisition.portAgentDetails && (
              <div className="mt-4">
                <p className="text-sm text-foreground mb-1">Port Agent Details</p>
                <p className="text-foreground">{requisition.portAgentDetails}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Requisition Items */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Requisition Items
            </CardTitle>
            <CardDescription>
              {requisition.items?.length || 0} item(s) in this requisition
            </CardDescription>
          </CardHeader>
          <CardContent>
            {requisition.items && requisition.items.length > 0 ? (
              <>
              <div className="overflow-x-auto">
                <RequisitionItemsReadOnlyTable
                  requisitionType={requisition.requisitionType}
                  items={paginatedItems}
                  rowIndexOffset={(itemsPage - 1) * ITEMS_PER_PAGE}
                  headerClassName="px-4 py-3 text-left text-sm font-semibold text-foreground"
                  headerRowClassName="border-b-2 border-border bg-muted"
                />
              </div>
              <TablePagination
                page={itemsPage}
                pageSize={ITEMS_PER_PAGE}
                total={requisitionItems.length}
                onPageChange={(p) => setItemsPage(p)}
                itemLabel="items"
              />
              </>
            ) : (
              <p className="text-foreground text-center py-4">No items found in this requisition.</p>
            )}
          </CardContent>
        </Card>

        {/* Return Comments Section (if previously returned) */}
        {requisition.returnComments && (
          <Card className="mb-6 border-border bg-warning">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-warning">
                <AlertCircle className="h-5 w-5" />
                Previous Return Comments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground whitespace-pre-wrap">{requisition.returnComments}</p>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>
              Approve this requisition or return it for editing with comments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canApprove && (
              <Button
                onClick={handleApprove}
                disabled={isSubmitting}
                className="w-full bg-success hover:bg-success"
                size="lg"
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                {isSubmitting ? "Approving..." : "Approve Requisition"}
              </Button>
            )}

            {canReturn && (
              <Button
                onClick={() => setShowReturnDialog(true)}
                disabled={isSubmitting}
                variant="outline"
                className="w-full border-border text-info hover:bg-info"
                size="lg"
              >
                <RotateCcw className="h-5 w-5 mr-2" />
                Return for Editing
              </Button>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Return Dialog */}
      <AlertDialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return Requisition for Editing</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for returning this requisition. This comment will be visible to users who will edit the requisition.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="return-comment">Return Reason/Comment</Label>
              <Textarea
                id="return-comment"
                placeholder="Enter the reason for returning this requisition..."
                value={returnComment}
                onChange={(e) => setReturnComment(e.target.value)}
                rows={5}
                className="mt-2"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReturnComment("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReturn}
              disabled={!returnComment.trim() || isSubmitting}
              className="bg-info hover:bg-info"
            >
              {isSubmitting ? "Returning..." : "Return Requisition"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </PageReadyGate>
  );
}
