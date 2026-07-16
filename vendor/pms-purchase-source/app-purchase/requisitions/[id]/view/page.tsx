"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RequisitionStatusBadge } from "@/components/requisition/RequisitionStatusBadge";
import { RequisitionTypeBadge } from "@/components/requisition/RequisitionTypeBadge";
import { RequisitionGenerationStatusBadge } from "@/components/requisition/RequisitionGenerationStatusBadge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Ship,
  Package,
  Lock,
  Unlock,
  Edit,
  AlertTriangle,
  Paperclip,
  Download,
  Settings,
} from "lucide-react";
import {
  Requisition,
  RequisitionStatus,
  GenerationStatus,
  RequisitionType,
  REQUISITION_STATUS_LABELS,
  GENERATION_STATUS_LABELS,
  REQUISITION_TYPE_LABELS,
} from "@/lib/types/requisition";
import { toast } from "sonner";
import { TablePagination } from "@/components/ui/table-pagination";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import { RequisitionClarificationsPanel } from "@/components/procurement/RequisitionClarificationsPanel";
import { canManagePurchaseClarifications } from "@/lib/procurement/clarification-notifications-access";
import { RequisitionItemsReadOnlyTable } from "@/components/requisition/RequisitionItemsReadOnlyTable";

export default function RequisitionViewPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromNotification = searchParams.get("from") === "notification";
  const returnTo = searchParams.get("returnTo");
  const requisitionId = params.id as string;

  const isSafeReturnTo = (path: string | null): path is string => {
    if (!path?.trim()) return false;
    const p = path.trim();
    return p.startsWith("/") && !p.startsWith("//");
  };

  const handleBack = () => {
    if (fromNotification) {
      router.push("/notifications");
      return;
    }
    if (isSafeReturnTo(returnTo)) {
      router.push(returnTo);
      return;
    }
    router.back();
  };
  
  const { ready, markSuccess } = usePageBootstrap();
  const [requisition, setRequisition] = useState<Requisition | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [itemsPage, setItemsPage] = useState(1);
  const [spareMachineryDetails, setSpareMachineryDetails] = useState<{
    name: string;
    code?: string;
    make?: string | null;
    model?: string | null;
    serialNumber?: string | null;
    vesselName?: string;
    isManual?: boolean;
  } | null>(null);
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
      if (!requisitionId) {
        setNotFound(true);
        return;
      }

      try {
        const response = await fetch(`/api/requisitions/${requisitionId}`, {
          credentials: "include",
        });

        if (response.status === 401) {
          router.push("/login");
          return;
        }

        if (response.status === 404) {
          setNotFound(true);
          return;
        }

        if (response.status === 403) {
          setAccessDenied(true);
          return;
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          console.error("Failed to load requisition:", errorData);
          toast.error(errorData.error || "Failed to load requisition");
          setNotFound(true);
          return;
        }

        const requisitionData = await response.json();
        if (!requisitionData?.id) {
          setNotFound(true);
          return;
        }
        setRequisition(requisitionData);
      } catch (error) {
        console.error("Error fetching requisition:", error);
        toast.error("Failed to load requisition. Please try again.");
        setNotFound(true);
      } finally {
        markSuccess();
      }
    };

    if (requisitionId) {
      fetchRequisition();
    }
  }, [requisitionId, markSuccess, router]);

  useEffect(() => {
    setItemsPage(1);
  }, [requisition?.id, requisition?.items?.length]);

  useEffect(() => {
    if (requisition?.requisitionType !== RequisitionType.SPR) {
      setSpareMachineryDetails(null);
      return;
    }

    const firstItemWithMachinery = requisition.items?.find(
      (item) => item.machineryInstanceId || item.manualMachineryName?.trim()
    );
    const machineryId = firstItemWithMachinery?.machineryInstanceId?.trim();
    const manualName = firstItemWithMachinery?.manualMachineryName?.trim();

    if (!machineryId && manualName) {
      setSpareMachineryDetails({ name: manualName, isManual: true });
      return;
    }

    if (!machineryId) {
      setSpareMachineryDetails(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/machinery/${machineryId}`, {
          credentials: "include",
        });
        if (!response.ok) {
          if (!cancelled) setSpareMachineryDetails(null);
          return;
        }
        const data = await response.json();
        if (cancelled) return;
        setSpareMachineryDetails({
          name: data.name ?? "—",
          code: data.code,
          make: data.make,
          model: data.model,
          serialNumber: data.serialNumber,
          vesselName: data.vessel?.name,
        });
      } catch {
        if (!cancelled) setSpareMachineryDetails(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [requisition?.requisitionType, requisition?.items]);

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

  // Helper function to parse attachments from remarks (legacy)
  const parseAttachments = (remarks?: string | null): string[] => {
    if (!remarks) return [];
    const attachmentMatch = remarks.match(/Attachments:\s*(.+?)(?:\s*\||$)/i);
    if (attachmentMatch && attachmentMatch[1]) {
      return attachmentMatch[1].split(';').map(a => a.trim()).filter(Boolean);
    }
    return [];
  };

  const renderAttachments = (item: { id: string; remarks?: string | null; attachments?: { id: string; fileName: string; mimeType?: string; fileSize?: number | null }[] }) => {
    const dbAttachments = item.attachments && Array.isArray(item.attachments) ? item.attachments : [];
    if (dbAttachments.length > 0) {
      return (
        <div className="flex flex-col gap-1">
          {dbAttachments.map((att) => (
            <a
              key={att.id}
              href={`/api/requisitions/${requisitionId}/items/${item.id}/attachments/${att.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-info hover:underline text-xs truncate max-w-[180px]"
              title={att.fileName}
            >
              <Paperclip className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{att.fileName}</span>
              <Download className="h-3 w-3 flex-shrink-0" />
            </a>
          ))}
        </div>

      );
    }
    const legacyNames = parseAttachments(item.remarks);
    if (legacyNames.length > 0) {
      return (
        <div className="flex flex-col gap-1">
          {legacyNames.map((name, idx) => (
            <div key={idx} className="flex items-center gap-1 text-foreground">
              <Paperclip className="h-3 w-3" />
              <span className="text-xs truncate max-w-[150px]" title={name}>{name}</span>
            </div>
          ))}
        </div>
      );
    }
    return "-";
  };

  const canEdit = requisition && 
    requisition.isEditable &&
    requisition.status !== RequisitionStatus.NEW_REQ &&
    requisition.status !== RequisitionStatus.QUOTE_CONFIRMED_PO_SENT &&
    requisition.status !== RequisitionStatus.REQ_RECEIVED_DELIVERED &&
    (requisition.status === RequisitionStatus.NOT_READY || 
     requisition.generationStatus === GenerationStatus.SAVED_AS_DRAFT) &&
    (requisition.createdById === currentUser?.id || 
     currentUser?.designationAccessLevel === 25 ||
     isAdminEquivalentAccessLevel(currentUser?.designationAccessLevel));

  const clarificationView: "office" | "vessel" = canManagePurchaseClarifications(
    currentUser?.designationAccessLevel
  )
    ? "office"
    : "vessel";

  const showClarifications =
    canManagePurchaseClarifications(currentUser?.designationAccessLevel) ||
    (currentUser?.designationAccessLevel >= 6 && currentUser?.designationAccessLevel <= 25);

  const requisitionItems = requisition?.items || [];
  const paginatedItems = requisitionItems.slice(
    (itemsPage - 1) * ITEMS_PER_PAGE,
    itemsPage * ITEMS_PER_PAGE
  );

  const subCat = requisition?.subCategoryCode ?? null;

  const handleEdit = () => {
    if (requisition && canEdit) {
      // If it's a draft, go to draft edit page
      if (requisition.generationStatus === GenerationStatus.SAVED_AS_DRAFT) {
        router.push(`/purchase/draft-requisitions/${requisition.id}/edit`);
      } 
      // If it's returned (NOT_READY with CREATED status), also allow editing
      else if (requisition.status === RequisitionStatus.NOT_READY) {
        router.push(`/purchase/draft-requisitions/${requisition.id}/edit`);
      }
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
                <Button onClick={() => router.push("/purchase/draft-requisitions")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Draft Requisitions
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
                  <AlertTriangle className="h-16 w-16 text-destructive" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
                <p className="text-foreground">
                  You don't have permission to view this requisition.
                </p>
                <Button onClick={() => router.push("/purchase/draft-requisitions")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Draft Requisitions
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (!requisition) {
    return <PageReadyGate ready={ready} loadingText="Loading requisition…" />;
  }

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
                  className="text-sm text-primary hover:underline font-medium"
                >
                  ← Return to Notifications
                </Link>
              )}
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
            {canEdit && (
              <Button
                onClick={handleEdit}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit Requisition
              </Button>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Requisition Details</h1>
            <p className="text-foreground">
              View complete information about this requisition
            </p>
          </div>
        </div>

        {/* Requisition summary row: header, machinery (SPR), description */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4 items-stretch">
          <Card className={`flex flex-col h-full ${
            requisition.requisitionType === RequisitionType.SPR && spareMachineryDetails && requisition.description
              ? "lg:col-span-3"
              : requisition.requisitionType === RequisitionType.SPR && spareMachineryDetails
                ? "lg:col-span-4"
                : requisition.description
                  ? "lg:col-span-7"
                  : "lg:col-span-12"
          }`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-lg mb-1 leading-tight">{requisition.heading}</CardTitle>
                  <CardDescription className="text-sm">
                    {requisition.requisitionNumber}
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-1 items-end shrink-0">
                  <RequisitionTypeBadge
                    type={requisition.requisitionType}
                    className="text-xs"
                    suffix={
                      subCat ? (
                        <span className="text-muted-foreground font-normal"> · {subCat}</span>
                      ) : null
                    }
                  />
                  <RequisitionGenerationStatusBadge
                    status={requisition.generationStatus}
                    className="text-xs"
                  />
                  {(currentUser?.designationAccessLevel ?? 0) > 25 && (
                    <RequisitionStatusBadge status={requisition.status} className="text-xs" />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 flex-1">
              <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                <div className="flex items-start gap-2 min-w-0">
                  <Ship className="h-4 w-4 text-info mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-foreground mb-0.5">Vessel</p>
                    <p className="font-semibold text-sm text-foreground leading-snug">
                      {requisition.vessel?.name || "Unknown"} ({requisition.vessel?.code || "N/A"})
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-info mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-foreground mb-0.5">Date Created</p>
                    <p className="font-semibold text-sm text-foreground">
                      {formatDate(requisition.dateOfCreation)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 col-span-2 min-w-0">
                  <User className="h-4 w-4 text-info mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-foreground mb-0.5">Created By</p>
                    <p className="font-semibold text-sm text-foreground">
                      {requisition.createdBy?.firstName} {requisition.createdBy?.lastName}
                    </p>
                    {requisition.createdBy?.designation && (
                      <p className="text-xs text-muted-foreground">{requisition.createdBy.designation}</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {requisition.requisitionType === RequisitionType.SPR && spareMachineryDetails && (
            <Card className={`flex flex-col h-full ${
              requisition.description ? "lg:col-span-6" : "lg:col-span-8"
            }`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Machinery Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 flex-1">
                {spareMachineryDetails.isManual ? (
                  <div>
                    <p className="text-xs text-foreground mb-0.5">Machinery</p>
                    <p className="font-semibold text-sm text-foreground">{spareMachineryDetails.name}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-x-3 gap-y-3">
                    <div className="min-w-0">
                      <p className="text-xs text-foreground mb-0.5">Name</p>
                      <p className="font-semibold text-sm text-foreground truncate" title={spareMachineryDetails.name}>{spareMachineryDetails.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-foreground mb-0.5">Code</p>
                      <p className="font-semibold text-sm text-foreground">{spareMachineryDetails.code ?? "—"}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-foreground mb-0.5">Make</p>
                      <p className="font-semibold text-sm text-foreground truncate" title={spareMachineryDetails.make ?? undefined}>{spareMachineryDetails.make ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-foreground mb-0.5">Model</p>
                      <p className="font-semibold text-sm text-foreground">{spareMachineryDetails.model ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-foreground mb-0.5">Serial Number</p>
                      <p className="font-semibold text-sm text-foreground">{spareMachineryDetails.serialNumber ?? "—"}</p>
                    </div>
                    {spareMachineryDetails.vesselName ? (
                      <div className="min-w-0">
                        <p className="text-xs text-foreground mb-0.5">Vessel</p>
                        <p className="font-semibold text-sm text-foreground truncate" title={spareMachineryDetails.vesselName}>{spareMachineryDetails.vesselName}</p>
                      </div>
                    ) : (
                      <div aria-hidden="true" />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {requisition.description && (
            <Card className={`flex flex-col h-full ${
              requisition.requisitionType === RequisitionType.SPR && spareMachineryDetails
                ? "lg:col-span-3"
                : "lg:col-span-5"
            }`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 flex-1">
                <p className="text-sm text-foreground">{requisition.description}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Additional Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {(currentUser?.designationAccessLevel ?? 0) >= 49 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {requisition.portOfSupply && (
                <div>
                  <p className="text-xs text-foreground mb-0.5">Port of Supply</p>
                  <p className="font-semibold text-sm text-foreground">{requisition.portOfSupply}</p>
                </div>
              )}
              {requisition.manualReqNumber && (
                <div>
                  <p className="text-xs text-foreground mb-0.5">Manual Requisition Number</p>
                  <p className="font-semibold text-sm text-foreground">{requisition.manualReqNumber}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-foreground mb-0.5">Editable</p>
                <div className="flex items-center gap-2">
                  {requisition.isEditable ? (
                    <>
                      <Unlock className="h-3 w-3 text-success" />
                      <span className="text-success font-semibold text-sm">Yes</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-3 w-3 text-destructive" />
                      <span className="text-destructive font-semibold text-sm">No</span>
                    </>
                  )}
                </div>
              </div>
              {requisition.approvedBy && (
                <div>
                  <p className="text-xs text-foreground mb-0.5">Approved By</p>
                  <p className="font-semibold text-sm text-foreground">
                    {requisition.approvedBy.firstName} {requisition.approvedBy.lastName}
                  </p>
                  {requisition.approvedAt && (
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(requisition.approvedAt)}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          )}
        </div>

        {/* Port Agent Details */}
        {requisition.portAgentDetails && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Port Agent Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-foreground whitespace-pre-wrap">{requisition.portAgentDetails}</p>
            </CardContent>
          </Card>
        )}

        {/* Requisition Items */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Requisition Items ({requisition.items?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {requisition.items && requisition.items.length > 0 ? (
              <>
              <div className="overflow-x-auto">
                <RequisitionItemsReadOnlyTable
                  requisitionType={requisition.requisitionType}
                  items={paginatedItems}
                  rowIndexOffset={(itemsPage - 1) * ITEMS_PER_PAGE}
                  showAttachments
                  renderAttachments={renderAttachments}
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

        {showClarifications && (
          <div className="mt-6 space-y-2">
            <div className="flex justify-end">
              <Link
                href={`/purchase/clarifications?requisitionId=${requisitionId}`}
                className="text-sm text-primary hover:underline"
              >
                Open pending clarifications inbox
              </Link>
            </div>
            <RequisitionClarificationsPanel
              requisitionId={requisitionId}
              view={clarificationView}
            />
          </div>
        )}
      </main>
    </div>
    </PageReadyGate>
  );
}

