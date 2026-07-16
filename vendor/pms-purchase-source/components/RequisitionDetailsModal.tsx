"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RequisitionStatusBadge } from "@/components/requisition/RequisitionStatusBadge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Package,
  Ship,
  Calendar,
  User,
  Clock,
  FileText,
  Download,
  MapPin,
  MessageSquare,
  X,
  Send,
  CheckCircle,
  AlertCircle,
  Paperclip,
} from "lucide-react";
import { REQUISITION_STATUS_LABELS, REQUISITION_TYPE_LABELS } from "@/lib/types/requisition";
import { toast } from "sonner";
import ActiniumLoader from "@/components/ActiniumLoader";
import { RequisitionAgentsPanel } from "@/components/RequisitionAgentsPanel";
import { RequisitionItemsReadOnlyTable } from "@/components/requisition/RequisitionItemsReadOnlyTable";
import { canViewPurchaseEntityHistory } from "@/lib/purchase/can-view-purchase-entity-history";
import type { RequisitionItemDisplayRow } from "@/lib/requisition-item-display-columns";

interface RequisitionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  requisitionId: string | null;
  currentUserAccessLevel?: number;
}

interface RequisitionDetails {
  id: string;
  requisitionNumber: string;
  heading: string;
  description?: string;
  requisitionType: string;
  subCategoryCode?: string | null;
  subCategoryName?: string | null;
  status: string;
  generationStatus: string;
  portOfSupply?: string;
  portAgentDetails?: string;
  dateOfCreation: string;
  vessel?: {
    id: string;
    name: string;
    code: string;
  };
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    designation?: string;
  };
  approvedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    designation?: string;
  };
  items?: Array<{
    id: string;
    itemName: string;
    description?: string;
    quantity: number;
    quantityInLiters?: number | null;
    unit: string;
    urgency: string;
    remarks?: string;
    impaNumber?: string | null;
    partNumber?: string | null;
    partName?: string | null;
    itemNumber?: string | null;
    drawingNumber?: string | null;
    oilGrade?: string | null;
    manualMachineryName?: string | null;
    paintBrand?: string | null;
    paintProductName?: string | null;
    paintColorGrade?: string | null;
    paintCategory?: string | null;
    currentRob?: number | null;
    attachments?: Array<{
      id: string;
      fileName: string;
      mimeType?: string;
      fileSize?: number | null;
    }>;
  }>;
}

interface HistoryEntry {
  id: string;
  actionType: string;
  actionDescription?: string;
  previousStatus?: string;
  newStatus?: string;
  comments?: string;
  performedBy: {
    firstName: string;
    lastName: string;
    designation?: string;
  };
  createdAt: string;
}

interface Attachment {
  id: string;
  filename: string;
  fileUrl?: string;
  mimeType?: string;
  size?: number;
  type: "requisition_file" | "attachment" | "item_attachment";
  requisitionItemId?: string;
  itemName?: string;
  downloadUrl?: string;
}

interface Remark {
  id: string;
  remark: string;
  createdBy: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

export function RequisitionDetailsModal({
  isOpen,
  onClose,
  requisitionId,
  currentUserAccessLevel,
}: RequisitionDetailsModalProps) {
  const [activeTab, setActiveTab] = useState("details");
  const [requisition, setRequisition] = useState<RequisitionDetails | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [remarks, setRemarks] = useState<Remark[]>([]);
  const [newRemark, setNewRemark] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmittingRemark, setIsSubmittingRemark] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchaseOrder, setPurchaseOrder] = useState<any>(null);

  const canViewQuoteDownloads =
    currentUserAccessLevel == null || currentUserAccessLevel > 25;

  const canViewHistory = canViewPurchaseEntityHistory(currentUserAccessLevel);

  // Check if user can add remarks (access levels 32,33,37,38,39,40,41,44,45)
  const canAddRemarks = currentUserAccessLevel && 
    [32, 33, 37, 38, 39, 40, 41, 44, 45].includes(currentUserAccessLevel);

  // Anyone who can view this requisition (crew 6–25, office, Master) may manage port agents.
  const canManageAgents =
    currentUserAccessLevel != null && currentUserAccessLevel >= 6;

  const renderItemAttachments = (item: RequisitionItemDisplayRow) => {
    const attachments = (item as unknown as NonNullable<RequisitionDetails["items"]>[number]).attachments;
    const itemAttachments = attachments && attachments.length > 0
      ? attachments
      : [];
    if (itemAttachments.length === 0) return "-";

    return (
      <div className="flex flex-col gap-1">
        {itemAttachments.map((att) => (
          <a
            key={att.id}
            href={`/api/requisitions/${requisitionId}/items/${item.id}/attachments/${att.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-600 hover:underline text-xs truncate max-w-[180px]"
            title={att.fileName}
          >
            <Paperclip className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{att.fileName}</span>
            <Download className="h-3 w-3 flex-shrink-0" />
          </a>
        ))}
      </div>
    );
  };

  useEffect(() => {
    if (!canViewHistory && activeTab === "history") {
      setActiveTab("details");
    }
  }, [canViewHistory, activeTab]);

  useEffect(() => {
    if (isOpen && requisitionId) {
      fetchRequisitionDetails();
      if (canViewHistory) {
        fetchHistory();
      }
      fetchAttachments();
      fetchRemarks();
      fetchPurchaseOrder();
    } else {
      // Reset state when modal closes
      setRequisition(null);
      setHistory([]);
      setAttachments([]);
      setRemarks([]);
      setNewRemark("");
      setActiveTab("details");
      setError(null);
      setPurchaseOrder(null);
    }
  }, [isOpen, requisitionId, canViewHistory]);

  const fetchRequisitionDetails = async () => {
    if (!requisitionId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/requisitions/${requisitionId}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        console.error("Failed to load requisition details:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        setError(errorMessage);
        toast.error(errorMessage);
        return;
      }
      
      const data = await response.json();
      setRequisition(data);
      setError(null);
    } catch (error: any) {
      const errorMessage = error?.message || "Failed to load requisition details. Please try again.";
      console.error("Error fetching requisition details:", error);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!requisitionId) return;
    try {
      const response = await fetch(`/api/requisitions/${requisitionId}/history`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  };

  const fetchAttachments = async () => {
    if (!requisitionId) return;
    try {
      const response = await fetch(`/api/requisitions/${requisitionId}/attachments`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setAttachments(data.attachments || []);
      }
    } catch (error) {
      console.error("Error fetching attachments:", error);
    }
  };

  const fetchRemarks = async () => {
    if (!requisitionId) return;
    try {
      const response = await fetch(`/api/requisitions/${requisitionId}/remarks`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setRemarks(data.remarks || []);
      }
    } catch (error) {
      console.error("Error fetching remarks:", error);
    }
  };

  const fetchPurchaseOrder = async () => {
    if (!requisitionId) return;
    try {
      const response = await fetch(`/api/purchase-orders/list?requisitionId=${requisitionId}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        if (data.purchaseOrders && data.purchaseOrders.length > 0) {
          setPurchaseOrder(data.purchaseOrders[0]); // Get the first PO
        }
      }
    } catch (error) {
      console.error("Error fetching purchase order:", error);
    }
  };

  const handleDownloadRequisitionFile = async () => {
    if (!requisitionId) return;
    try {
      const response = await fetch(`/api/requisitions/${requisitionId}/download-excel`, {
        credentials: "include",
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Requisition_${requisition?.requisitionNumber || requisitionId}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("Requisition file downloaded successfully");
      } else {
        toast.error("Failed to download requisition file");
      }
    } catch (error) {
      console.error("Error downloading requisition file:", error);
      toast.error("Failed to download requisition file");
    }
  };

  const handleSubmitRemark = async () => {
    if (!requisitionId || !newRemark.trim()) {
      toast.error("Please enter a remark");
      return;
    }

    if (!canAddRemarks) {
      toast.error("You don't have permission to add remarks");
      return;
    }

    setIsSubmittingRemark(true);
    try {
      const response = await fetch(`/api/requisitions/${requisitionId}/remarks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          remark: newRemark.trim(),
        }),
      });

      if (response.ok) {
        toast.success("Remark added successfully");
        setNewRemark("");
        fetchRemarks(); // Refresh remarks list
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to add remark");
      }
    } catch (error) {
      console.error("Error submitting remark:", error);
      toast.error("Failed to add remark");
    } finally {
      setIsSubmittingRemark(false);
    }
  };

  const handleDownloadPO = async () => {
    if (!purchaseOrder) return;
    try {
      const response = await fetch(`/api/purchase-orders/${purchaseOrder.id}/pdf`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        if (data.signedUrl) {
          window.open(data.signedUrl, "_blank");
          toast.success("Purchase Order opened successfully");
        } else {
          toast.error("PDF URL not available");
        }
      } else {
        toast.error("Failed to download Purchase Order");
      }
    } catch (error) {
      console.error("Error downloading PO:", error);
      toast.error("Failed to download Purchase Order");
    }
  };

  const handleDownloadAllQuotes = async () => {
    if (!requisitionId) return;
    try {
      const response = await fetch(`/api/requisitions/${requisitionId}/download-quotes`, {
        credentials: "include",
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `All_Quotes_${requisition?.requisitionNumber || requisitionId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("All quotes downloaded successfully");
      } else {
        const errorData = await response.json().catch(() => ({ error: "Failed to download quotes" }));
        toast.error(errorData.error || "Failed to download quotes");
      }
    } catch (error) {
      console.error("Error downloading quotes:", error);
      toast.error("Failed to download quotes");
    }
  };

  const handleDownloadQuoteComparison = async () => {
    // Quote comparison is the same as all quotes PDF
    await handleDownloadAllQuotes();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!h-[70vh] !max-h-[70vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="text-xl font-bold">
            VIEW REQUISITION DETAILS
          </DialogTitle>
          <DialogDescription>
            {requisition?.requisitionNumber || "Loading..."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col px-6 pb-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <ActiniumLoader size="md" text="Loading requisition details..." />
            </div>
          ) : requisition ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
              <TabsList className={`grid w-full flex-shrink-0 mb-4 ${canViewHistory ? "grid-cols-5" : "grid-cols-4"}`}>
                <TabsTrigger value="details">Requisition Details</TabsTrigger>
                {canViewHistory && <TabsTrigger value="history">History</TabsTrigger>}
                <TabsTrigger value="attachments">Attachments</TabsTrigger>
                <TabsTrigger value="agents">Agents</TabsTrigger>
                <TabsTrigger value="remarks">Remarks</TabsTrigger>
              </TabsList>

            {/* Requisition Details Tab */}
            <TabsContent value="details" className="space-y-4 mt-0 flex-1 overflow-y-auto pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">RFQ Number</Label>
                  <p className="text-sm font-semibold">{requisition.requisitionNumber}</p>
                </div>
                {currentUserAccessLevel != null && currentUserAccessLevel > 25 && (
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
                    <RequisitionStatusBadge status={requisition.status} />
                  </div>
                )}
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Department</Label>
                  <p className="text-sm font-semibold">
                    {requisition.subCategoryName ?? "—"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Requisition For</Label>
                  <p className="text-sm font-semibold">{requisition.heading}</p>
                </div>
                {requisition.vessel && (
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">Vessel</Label>
                    <p className="text-sm font-semibold flex items-center gap-1">
                      <Ship className="h-4 w-4" />
                      {requisition.vessel.name} ({requisition.vessel.code})
                    </p>
                  </div>
                )}
                {requisition.portOfSupply && (
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">Expected Delivery Port</Label>
                    <p className="text-sm font-semibold flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {requisition.portOfSupply}
                    </p>
                  </div>
                )}
                {requisition.dateOfCreation && (
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">Date Time of Creation</Label>
                    <p className="text-sm font-semibold flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(requisition.dateOfCreation)}
                    </p>
                  </div>
                )}
                {requisition.createdBy && (
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">Created By</Label>
                    <p className="text-sm font-semibold flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {requisition.createdBy.firstName} {requisition.createdBy.lastName}
                    </p>
                  </div>
                )}
              </div>

              {requisition.description && (
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Description</Label>
                  <p className="text-sm">{requisition.description}</p>
                </div>
              )}

              {/* Items Table */}
              {requisition.items && requisition.items.length > 0 && (
                <div className="mt-4">
                  <Label className="text-sm font-semibold mb-2 block">Items</Label>
                  <div className="border rounded-lg overflow-x-auto">
                    <RequisitionItemsReadOnlyTable
                      requisitionType={requisition.requisitionType}
                      items={requisition.items as unknown as RequisitionItemDisplayRow[]}
                      showAttachments
                      renderAttachments={renderItemAttachments}
                      headerClassName="text-xs whitespace-nowrap px-3 py-2 text-left font-medium"
                      cellClassName="text-xs px-3 py-2"
                      headerRowClassName="bg-muted"
                      bodyRowClassName="border-t"
                    />
                  </div>
                </div>
              )}
            </TabsContent>

            {/* History Tab */}
            {canViewHistory && (
            <TabsContent value="history" className="space-y-4 mt-0 flex-1 overflow-y-auto">
              {history.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No history available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((entry) => (
                    <div
                      key={entry.id}
                      className="border rounded-lg p-4 bg-slate-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{entry.actionType}</Badge>
                            {entry.previousStatus && entry.newStatus && (
                              <span className="text-xs text-gray-600">
                                {entry.previousStatus} → {entry.newStatus}
                              </span>
                            )}
                          </div>
                          {entry.actionDescription && (
                            <p className="text-sm font-medium mb-1">
                              {entry.actionDescription}
                            </p>
                          )}
                          {entry.comments && (
                            <p className="text-sm text-gray-600 mb-2">{entry.comments}</p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <User className="h-3 w-3" />
                            <span>
                              {entry.performedBy.firstName} {entry.performedBy.lastName}
                            </span>
                            <span>•</span>
                            <Clock className="h-3 w-3" />
                            <span>{formatDate(entry.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            )}

            {/* Attachments Tab */}
            <TabsContent value="attachments" className="space-y-4 mt-0 flex-1 overflow-y-auto">
              <div className="space-y-4">
                {/* Requisition File Download */}
                <div className="border rounded-lg p-4 bg-blue-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-semibold">Requisition File</p>
                        <p className="text-xs text-gray-600">
                          Download requisition as Excel file
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadRequisitionFile}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Excel
                    </Button>
                  </div>
                </div>

                {/* Purchase Order Download */}
                {purchaseOrder && (
                  <div className="border rounded-lg p-4 bg-green-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="text-sm font-semibold">Purchase Order</p>
                          <p className="text-xs text-gray-600">
                            PO Number: {purchaseOrder.poNumber}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadPO}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download PO
                      </Button>
                    </div>
                  </div>
                )}

                {/* All Quotes PDF Download */}
                {canViewQuoteDownloads && (
                <div className="border rounded-lg p-4 bg-purple-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-purple-600" />
                      <div>
                        <p className="text-sm font-semibold">All Quotes PDF</p>
                        <p className="text-xs text-gray-600">
                          Download all received quotes as PDF
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadAllQuotes}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download All Quotes
                    </Button>
                  </div>
                </div>
                )}

                {/* Quote Comparison PDF Download - only for access level > 25 */}
                {currentUserAccessLevel != null && currentUserAccessLevel > 25 && (
                  <div className="border rounded-lg p-4 bg-orange-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-orange-600" />
                        <div>
                          <p className="text-sm font-semibold">Quote Comparison PDF</p>
                          <p className="text-xs text-gray-600">
                            Download quote comparison report as PDF
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadQuoteComparison}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Comparison
                      </Button>
                    </div>
                  </div>
                )}

                {/* Other Attachments */}
                {attachments.length > 0 && (
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Other Attachments</Label>
                    <div className="space-y-2">
                      {attachments.map((attachment) => (
                        <div
                          key={`${attachment.type}-${attachment.id}`}
                          className="border rounded-lg p-3 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gray-400" />
                            <div>
                              <p className="text-sm font-medium">{attachment.filename}</p>
                              {attachment.type === "item_attachment" && attachment.itemName && (
                                <p className="text-xs text-gray-500">
                                  Line item: {attachment.itemName}
                                </p>
                              )}
                              {attachment.size && (
                                <p className="text-xs text-gray-500">
                                  {(attachment.size / 1024).toFixed(2)} KB
                                </p>
                              )}
                            </div>
                          </div>
                          {(attachment.fileUrl || attachment.downloadUrl) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                window.open(
                                  attachment.downloadUrl || attachment.fileUrl,
                                  "_blank"
                                )
                              }
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Agents Tab */}
            <TabsContent value="agents" className="space-y-4 mt-0 flex-1 overflow-y-auto">
              {requisitionId && (
                <RequisitionAgentsPanel
                  requisitionId={requisitionId}
                  defaultPortName={requisition?.portOfSupply}
                  canEdit={canManageAgents}
                />
              )}
              {requisition?.portAgentDetails && (
                <div className="border rounded-lg p-4 bg-amber-50">
                  <Label className="text-sm font-semibold mb-2 block">
                    Legacy Agent Notes
                  </Label>
                  <p className="text-sm whitespace-pre-wrap">{requisition.portAgentDetails}</p>
                </div>
              )}
            </TabsContent>

            {/* Remarks Tab */}
            <TabsContent value="remarks" className="space-y-4 mt-0 flex-1 overflow-y-auto">
              {canAddRemarks && (
                <div className="border rounded-lg p-4 bg-slate-50">
                  <Label htmlFor="new-remark" className="text-sm font-semibold mb-2 block">
                    Add Remark
                  </Label>
                  <Textarea
                    id="new-remark"
                    placeholder="Enter your remark..."
                    value={newRemark}
                    onChange={(e) => setNewRemark(e.target.value)}
                    rows={3}
                    className="mb-2"
                  />
                  <Button
                    onClick={handleSubmitRemark}
                    disabled={isSubmittingRemark || !newRemark.trim()}
                    size="sm"
                  >
                    {isSubmittingRemark ? (
                      <>
                        <ActiniumLoader size="sm" className="mr-2" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Submit Remark
                      </>
                    )}
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                {remarks.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No remarks yet</p>
                  </div>
                ) : (
                  remarks.map((remark) => (
                    <div
                      key={remark.id}
                      className="border rounded-lg p-4 bg-white"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">
                            {remark.createdBy.firstName} {remark.createdBy.lastName}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatDate(remark.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{remark.remark}</p>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
            </Tabs>
          ) : error ? (
            <div className="text-center py-12 text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-400" />
              <p className="font-semibold text-red-600 mb-2">Failed to load requisition details</p>
              <p className="text-sm text-gray-600">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={fetchRequisitionDetails}
              >
                Retry
              </Button>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Failed to load requisition details</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
