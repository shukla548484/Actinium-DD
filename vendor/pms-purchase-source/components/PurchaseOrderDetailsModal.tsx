"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Edit,
  Ban,
  Paperclip,
  Loader2,
  Truck,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import { canViewPurchaseEntityHistory } from "@/lib/purchase/can-view-purchase-entity-history";
import { ORDER_READINESS_OPTIONS, formatOrderReadinessLabel } from "@/lib/order-readiness";
import { useVendorChat } from "@/lib/hooks/useVendorChat";
import ActiniumLoader from "@/components/ActiniumLoader";
import { ChatMessageItem } from "@/components/ChatMessageItem";
import { PurchaseEntityHistoryPanel } from "@/components/purchase/PurchaseEntityHistoryPanel";
import type { PurchaseEntityHistoryEntry } from "@/lib/purchase/build-entity-history";

interface PurchaseOrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrderId: string | null;
  currentUserAccessLevel?: number;
  onRefresh?: () => void;
  initialTab?: string;
}

interface PurchaseOrderDetails {
  id: string;
  poNumber: string;
  poType?: string;
  dateOfIssue: string;
  status: string;
  totalAmount: number | null;
  currency: string;
  originalPdfUrl: string | null;
  mergedPdfUrl: string | null;
  requisition: {
    id: string;
    requisitionNumber: string;
    heading: string;
    description?: string;
    requisitionType: string;
    portOfSupply?: string;
    vessel: {
      id: string;
      name: string;
      code: string;
    };
  };
  quote: {
    id: string;
    quoteNumber: string | null;
    vendor: {
      name: string;
      primaryEmail: string;
    };
    totalAmount: number | null;
    currency: string;
    deliveryCharges?: number | null;
    deliveryChargesAttachment?: string | null;
    otherChargesBreakdown?: Record<string, number> | null;
  };
  attachments: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
    description: string | null;
    createdAt: string;
  }>;
  orderTracking?: {
    orderReadiness: string;
    readinessDate: string | null;
    dispatchedDate: string | null;
    awb: string | null;
    awbAttachmentUrl: string | null;
    transportCompanyName: string | null;
    expectedDeliveryDate: string | null;
    expectedDeliveryDateToAgent: string | null;
    actualDeliveryDate: string | null;
    trackingNotes: string | null;
  } | null;
}

interface HistoryEntry extends PurchaseEntityHistoryEntry {}

export function PurchaseOrderDetailsModal({
  isOpen,
  onClose,
  purchaseOrderId,
  currentUserAccessLevel,
  onRefresh,
  initialTab = "details",
}: PurchaseOrderDetailsModalProps) {
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrderDetails | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [modifyComments, setModifyComments] = useState("");
  const [cancelComments, setCancelComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const DELIVERY_CHARGE_FIELDS = [
    { key: "deliveryCharges", label: "Delivery Charges" },
    { key: "courierCharges", label: "Courier Charges" },
    { key: "handlingCharges", label: "Handling Charges" },
    { key: "transportCharges", label: "Transport Charges" },
    { key: "customClearanceCharges", label: "Custom Clearance Charges" },
    { key: "warehouseCharges", label: "Warehouse Charges" },
  ] as const;
  const [showDeliveryChargesModal, setShowDeliveryChargesModal] = useState(false);
  const [chargesBreakdown, setChargesBreakdown] = useState<Record<string, string>>({});
  const [deliveryChargesFile, setDeliveryChargesFile] = useState<File | null>(null);
  const [updatingDeliveryCharges, setUpdatingDeliveryCharges] = useState(false);
  
  // Chat state - using the new chat hook
  const [chatMessage, setChatMessage] = useState("");
  const [chatFiles, setChatFiles] = useState<File[]>([]);
  
  // Memoize onError callback to prevent hook re-initialization
  const handleChatError = useCallback((error: string) => {
    // Only show error toast for non-initial load errors and non-unauthorized errors
    // Note: We can't check loadingChat here as it's not available yet
    if (!error.includes("Unauthorized")) {
      console.error("Chat error:", error);
    }
  }, []); // Stable callback - no dependencies
  
  const {
    messages: chatMessages,
    loading: loadingChat,
    sending: sendingMessage,
    error: chatError,
    sendMessage: sendChatMessage,
    refreshMessages: refreshChatMessages,
    clearError: clearChatError,
  } = useVendorChat({
    purchaseOrderId: isOpen && activeTab === "chat" ? purchaseOrderId : null,
    enabled: isOpen && activeTab === "chat",
    onError: handleChatError,
  });
  
  // Only show loading on true initial load (no messages yet and first time loading)
  // This prevents showing "Loading messages..." during background refreshes
  const initialChatLoad = loadingChat && chatMessages.length === 0 && isOpen && activeTab === "chat";
  
  // Track if we've ever loaded messages to distinguish initial load from background refresh
  const [hasLoadedMessages, setHasLoadedMessages] = useState(false);
  const hasLoadedMessagesRef = useRef(false); // Use ref to prevent infinite loops
  
  // Update hasLoadedMessages when messages are received
  // FIXED: Removed hasLoadedMessages from deps to prevent infinite loop
  useEffect(() => {
    if (chatMessages.length > 0 && !hasLoadedMessagesRef.current) {
      hasLoadedMessagesRef.current = true;
      setHasLoadedMessages(true);
    }
  }, [chatMessages.length]); // Only depend on chatMessages.length
  
  // Agent request state
  const [agentRequests, setAgentRequests] = useState<any[]>([]);
  const [loadingAgentRequests, setLoadingAgentRequests] = useState(false);
  const [showAgentResponseModal, setShowAgentResponseModal] = useState(false);
  const [selectedAgentRequest, setSelectedAgentRequest] = useState<any>(null);
  const [agentDetails, setAgentDetails] = useState("");
  const [responseMessage, setResponseMessage] = useState("");
  const [submittingAgentResponse, setSubmittingAgentResponse] = useState(false);

  // Check if user can modify/cancel (access levels 32, 33, 50)
  const canModify = currentUserAccessLevel && [32, 33, 50].includes(currentUserAccessLevel);
  const canCancel = currentUserAccessLevel && [32, 33, 50].includes(currentUserAccessLevel);
  const canEditOrderTracking =
    currentUserAccessLevel != null &&
    (currentUserAccessLevel === 32 ||
      currentUserAccessLevel === 33 ||
      isAdminEquivalentAccessLevel(currentUserAccessLevel));

  const canViewHistory = canViewPurchaseEntityHistory(currentUserAccessLevel);

  const [trackingForm, setTrackingForm] = useState({
    orderReadiness: "NOT_READY",
    readinessDate: "",
    dispatchedDate: "",
    awb: "",
    transportCompanyName: "",
    expectedDeliveryDate: "",
    expectedDeliveryDateToAgent: "",
    actualDeliveryDate: "",
    trackingNotes: "",
  });
  const [savingTracking, setSavingTracking] = useState(false);

  useEffect(() => {
    if (!purchaseOrder) return;
    const t = purchaseOrder.orderTracking;
    setTrackingForm({
      orderReadiness: t?.orderReadiness ?? "NOT_READY",
      readinessDate: t?.readinessDate ? String(t.readinessDate).split("T")[0] : "",
      dispatchedDate: t?.dispatchedDate ? String(t.dispatchedDate).split("T")[0] : "",
      awb: t?.awb ?? "",
      transportCompanyName: t?.transportCompanyName ?? "",
      expectedDeliveryDate: t?.expectedDeliveryDate ? String(t.expectedDeliveryDate).split("T")[0] : "",
      expectedDeliveryDateToAgent: t?.expectedDeliveryDateToAgent
        ? String(t.expectedDeliveryDateToAgent).split("T")[0]
        : "",
      actualDeliveryDate: t?.actualDeliveryDate ? String(t.actualDeliveryDate).split("T")[0] : "",
      trackingNotes: t?.trackingNotes ?? "",
    });
  }, [purchaseOrder?.id, purchaseOrder?.orderTracking]);

  useEffect(() => {
    if (!canViewHistory && activeTab === "history") {
      setActiveTab("details");
    }
  }, [canViewHistory, activeTab]);

  useEffect(() => {
    if (isOpen && purchaseOrderId) {
      fetchPurchaseOrderDetails();
      if (canViewHistory) {
        fetchHistory();
      }
      // Chat is handled by useVendorChat hook
      if (activeTab === "agent-requests") {
        loadAgentRequests();
      }
    } else {
      setPurchaseOrder(null);
      setHistory([]);
      setActiveTab(initialTab);
      setModifyComments("");
      setCancelComments("");
      setChatMessage("");
      setChatFiles([]);
      setAgentRequests([]);
      clearChatError();
    }
  }, [isOpen, purchaseOrderId, activeTab, initialTab, canViewHistory]);

  // Chat polling is handled by useVendorChat hook - no separate useEffect needed

  // Update active tab when initialTab prop changes
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const fetchPurchaseOrderDetails = async () => {
    if (!purchaseOrderId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/purchase-orders/${purchaseOrderId}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setPurchaseOrder(data.purchaseOrder);
      } else {
        toast.error("Failed to load purchase order details");
      }
    } catch (error) {
      console.error("Error fetching purchase order details:", error);
      toast.error("Failed to load purchase order details");
    } finally {
      setIsLoading(false);
    }
  };

  const saveOrderTracking = async () => {
    if (!purchaseOrderId || !canEditOrderTracking) return;
    setSavingTracking(true);
    try {
      const res = await fetch(`/api/purchase-orders/${purchaseOrderId}/tracking`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderReadiness: trackingForm.orderReadiness,
          readinessDate: trackingForm.readinessDate || null,
          dispatchedDate: trackingForm.dispatchedDate || null,
          awb: trackingForm.awb.trim() || null,
          transportCompanyName: trackingForm.transportCompanyName.trim() || null,
          expectedDeliveryDate: trackingForm.expectedDeliveryDate || null,
          expectedDeliveryDateToAgent: trackingForm.expectedDeliveryDateToAgent || null,
          actualDeliveryDate: trackingForm.actualDeliveryDate || null,
          trackingNotes: trackingForm.trackingNotes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          typeof data.error === "string"
            ? data.error
            : typeof data.message === "string"
              ? data.message
              : "Failed to save order tracking"
        );
        return;
      }
      toast.success("Order tracking saved");
      await fetchPurchaseOrderDetails();
      if (onRefresh) onRefresh();
    } catch {
      toast.error("Failed to save order tracking");
    } finally {
      setSavingTracking(false);
    }
  };

  const fetchHistory = async () => {
    if (!purchaseOrderId) return;
    try {
      const response = await fetch(`/api/purchase-orders/${purchaseOrderId}/history`, {
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

  const handleModify = async () => {
    if (!purchaseOrderId || !modifyComments.trim()) {
      toast.error("Please provide a reason for modification");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/purchase-orders/${purchaseOrderId}/modify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          comments: modifyComments.trim(),
        }),
      });

      if (response.ok) {
        toast.success("Purchase Order modified successfully");
        setShowModifyModal(false);
        setModifyComments("");
        await fetchPurchaseOrderDetails();
        if (canViewHistory) {
          await fetchHistory();
        }
        if (onRefresh) onRefresh();
      } else {
        const errorData = await response.json().catch(() => ({ error: "Failed to modify PO" }));
        toast.error(errorData.error || "Failed to modify purchase order");
      }
    } catch (error) {
      console.error("Error modifying purchase order:", error);
      toast.error("Failed to modify purchase order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!purchaseOrderId || !cancelComments.trim()) {
      toast.error("Please provide a reason for cancellation");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/purchase-orders/${purchaseOrderId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          comments: cancelComments.trim(),
        }),
      });

      if (response.ok) {
        toast.success("Purchase Order cancelled successfully");
        setShowCancelModal(false);
        setCancelComments("");
        await fetchPurchaseOrderDetails();
        if (canViewHistory) {
          await fetchHistory();
        }
        if (onRefresh) onRefresh();
      } else {
        const errorData = await response.json().catch(() => ({ error: "Failed to cancel PO" }));
        toast.error(errorData.error || "Failed to cancel purchase order");
      }
    } catch (error) {
      console.error("Error cancelling purchase order:", error);
      toast.error("Failed to cancel purchase order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const chargesTotal = DELIVERY_CHARGE_FIELDS.reduce((sum, { key }) => sum + (parseFloat(chargesBreakdown[key] || "0") || 0), 0);

  const handleUpdateDeliveryCharges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseOrderId) return;

    setUpdatingDeliveryCharges(true);
    try {
      const formData = new FormData();
      DELIVERY_CHARGE_FIELDS.forEach(({ key }) => {
        formData.append(key, chargesBreakdown[key]?.trim() || "0");
      });
      formData.append("deliveryCharges", String(chargesTotal));
      if (deliveryChargesFile) {
        formData.append("file", deliveryChargesFile);
      }

      const response = await fetch(`/api/purchase-orders/${purchaseOrderId}/delivery-charges`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (response.ok) {
        toast.success("Delivery and other charges updated successfully");
        setShowDeliveryChargesModal(false);
        setChargesBreakdown({});
        setDeliveryChargesFile(null);
        await fetchPurchaseOrderDetails();
        if (onRefresh) onRefresh();
      } else {
        const errorData = await response.json().catch(() => ({ error: "Failed to update delivery charges" }));
        toast.error(errorData.error || "Failed to update delivery charges");
      }
    } catch (error) {
      console.error("Error updating delivery charges:", error);
      toast.error("Failed to update delivery charges");
    } finally {
      setUpdatingDeliveryCharges(false);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      if (url.includes('storage.googleapis.com')) {
        // Use the purchase order download endpoint to serve file directly
        const downloadUrl = `/api/purchase-orders/download?fileUrl=${encodeURIComponent(url)}`;
        // Open in new tab to display in browser
        window.open(downloadUrl, '_blank');
      } else {
        // For non-GCS URLs, open directly
        window.open(url, '_blank');
      }
    } catch (err) {
      console.error("Error downloading file:", err);
      toast.error("Failed to download file");
    }
  };

  // Stable formatDate function using useCallback to prevent re-renders and hydration errors
  // Uses consistent formatting to prevent server/client mismatches
  const formatDate = useCallback((dateString: string) => {
    try {
    const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return dateString; // Return original if invalid
      }
      // Use consistent format that works on both server and client
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const year = date.getFullYear();
    const month = months[date.getMonth()];
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month} ${day}, ${year} ${hours}:${minutes}`;
    } catch (error) {
      // Fallback to ISO string if formatting fails
      return new Date(dateString).toISOString().split('T')[0];
    }
  }, []); // Empty deps - function is pure and doesn't depend on any props/state

  // Helper function to format date header (e.g., "Today", "Yesterday", "Dec 3, 2025")
  const formatDateHeader = useCallback((dateString: string) => {
    try {
      const date = new Date(dateString);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const messageDate = new Date(date);
      messageDate.setHours(0, 0, 0, 0);
      
      const diffTime = today.getTime() - messageDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return "Today";
      } else if (diffDays === 1) {
        return "Yesterday";
      } else {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
      }
    } catch (error) {
      return dateString;
    }
  }, []);

  // Group messages by date and create memoized list with date headers
  const memoizedChatMessages = useMemo(() => {
    if (!chatMessages || chatMessages.length === 0) return [];
    
    // Filter out any invalid messages (safety check)
    const validMessages = chatMessages.filter((msg) => {
      return msg && 
             msg.id && 
             msg.createdAt && 
             typeof msg.createdAt === 'string' &&
             msg.message !== undefined &&
             msg.senderType;
    });
    
    if (validMessages.length === 0) return [];
    
    // Group messages by date
    const groupedMessages: { [key: string]: typeof validMessages } = {};
    validMessages.forEach((msg) => {
      try {
        const dateKey = new Date(msg.createdAt).toDateString();
        if (!groupedMessages[dateKey]) {
          groupedMessages[dateKey] = [];
        }
        groupedMessages[dateKey].push(msg);
      } catch (error) {
        console.error('Error processing message date:', error, msg);
        // Skip invalid messages
      }
    });
    
    // Sort dates and render with headers
    const sortedDates = Object.keys(groupedMessages).sort((a, b) => {
      try {
        return new Date(a).getTime() - new Date(b).getTime();
      } catch {
        return 0;
      }
    });
    
    const result: React.ReactNode[] = [];
    sortedDates.forEach((dateKey) => {
      const messagesForDate = groupedMessages[dateKey];
      if (!messagesForDate || messagesForDate.length === 0) return;
      
      // Add date header
      const firstMessage = messagesForDate[0];
      if (firstMessage && firstMessage.createdAt) {
        const dateHeaderText = formatDateHeader(firstMessage.createdAt);
        if (dateHeaderText && typeof dateHeaderText === 'string') {
          result.push(
            <div key={`date-${dateKey}`} className="flex items-center justify-center my-4">
              <div className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">
                {dateHeaderText}
              </div>
            </div>
          );
        }
      }
      
      // Add messages for this date
      messagesForDate.forEach((msg) => {
        if (msg && msg.id) {
          result.push(
            <ChatMessageItem
              key={msg.id}
              message={msg}
              formatDate={formatDate}
            />
          );
        }
      });
    });
    
    return result;
  }, [chatMessages, formatDate, formatDateHeader]);

  const formatCurrency = (amount: number | null, currency: string) => {
    if (amount === null) return "N/A";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  // Chat functions are now handled by useVendorChat hook
  const handleSendChatMessage = async () => {
    // Clear input immediately for optimistic UI (hook handles message display)
    const messageToSend = chatMessage;
    const filesToSend = [...chatFiles];
      setChatMessage("");
      setChatFiles([]);
    
    // Send message in background (hook handles optimistic update)
    await sendChatMessage(messageToSend, filesToSend);
  };

  const handleChatFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setChatFiles((prev) => [...prev, ...files]);
  };

  const removeChatFile = (index: number) => {
    setChatFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const loadAgentRequests = async () => {
    if (!purchaseOrderId) return;
    try {
      setLoadingAgentRequests(true);
      const response = await fetch(`/api/purchase-orders/${purchaseOrderId}/agent-request`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setAgentRequests(data.agentRequests || []);
      }
    } catch (error) {
      console.error("Error loading agent requests:", error);
    } finally {
      setLoadingAgentRequests(false);
    }
  };

  const openAgentResponseModal = (request: any) => {
    setSelectedAgentRequest(request);
    setAgentDetails("");
    setResponseMessage("");
    setShowAgentResponseModal(true);
  };

  const submitAgentResponse = async () => {
    if (!purchaseOrderId || !selectedAgentRequest || !agentDetails.trim()) {
      toast.error("Agent details are required");
      return;
    }

    try {
      setSubmittingAgentResponse(true);
      const response = await fetch(
        `/api/purchase-orders/${purchaseOrderId}/agent-request/${selectedAgentRequest.id}/respond`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            agentDetails: agentDetails.trim(),
            responseMessage: responseMessage.trim() || null,
          }),
        }
      );

      if (response.ok) {
        toast.success("Agent details provided successfully");
        setShowAgentResponseModal(false);
        await loadAgentRequests();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to submit agent details");
      }
    } catch (error) {
      console.error("Error submitting agent response:", error);
      toast.error("Failed to submit agent details");
    } finally {
      setSubmittingAgentResponse(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    if (status === 'CANCELLED') return 'destructive';
    if (status === 'ACTIVE') return 'default';
    return 'secondary';
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="min-h-[60vh] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Purchase Order Details</DialogTitle>
            <DialogDescription>
              {purchaseOrder ? `PO Number: ${purchaseOrder.poNumber}` : "Loading..."}
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <ActiniumLoader size="md" text="Loading purchase order details..." />
            </div>
          ) : purchaseOrder ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
              <TabsList className={`grid w-full flex-shrink-0 mb-4 ${canViewHistory ? "grid-cols-5" : "grid-cols-4"}`}>
                <TabsTrigger value="details">PO Details</TabsTrigger>
                {canViewHistory && <TabsTrigger value="history">History</TabsTrigger>}
                <TabsTrigger value="attachments">Attachments</TabsTrigger>
                <TabsTrigger value="chat">
                  Chat
                  {chatMessages.filter((m) => !m.isRead && m.senderType === "VENDOR").length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                      {chatMessages.filter((m) => !m.isRead && m.senderType === "VENDOR").length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="agent-requests">
                  Agent Requests
                  {agentRequests.filter((ar) => ar.status === "PENDING").length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 bg-orange-600 text-white text-xs rounded-full">
                      {agentRequests.filter((ar) => ar.status === "PENDING").length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* PO Details Tab */}
              <TabsContent value="details" className="space-y-4 mt-0 flex-1 overflow-y-auto pr-2">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-2">
                    {purchaseOrder.poType !== "FREIGHT" && (
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/purchase/freight/${purchaseOrder.requisition.id}?parentPoId=${purchaseOrder.id}`}
                        >
                          <Truck className="h-4 w-4 mr-2" />
                          Freight
                        </Link>
                      </Button>
                    )}
                    {canModify && purchaseOrder.status === 'ACTIVE' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowModifyModal(true)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Modify
                      </Button>
                    )}
                    {canCancel && purchaseOrder.status === 'ACTIVE' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowCancelModal(true)}
                      >
                        <Ban className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">PO Number</Label>
                    <p className="text-sm font-semibold">{purchaseOrder.poNumber}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
                    <Badge variant={getStatusBadgeVariant(purchaseOrder.status)}>
                      {purchaseOrder.status}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">Date of Issue</Label>
                    <p className="text-sm font-semibold flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(purchaseOrder.dateOfIssue)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">Total Amount</Label>
                    <p className="text-sm font-semibold">
                      {formatCurrency(purchaseOrder.totalAmount, purchaseOrder.currency)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">Requisition Number</Label>
                    <p className="text-sm font-semibold">{purchaseOrder.requisition.requisitionNumber}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">Requisition Heading</Label>
                    <p className="text-sm font-semibold">{purchaseOrder.requisition.heading}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">Vessel</Label>
                    <p className="text-sm font-semibold flex items-center gap-1">
                      <Ship className="h-4 w-4" />
                      {purchaseOrder.requisition.vessel.name} ({purchaseOrder.requisition.vessel.code})
                    </p>
                  </div>
                  {purchaseOrder.requisition.portOfSupply && (
                    <div>
                      <Label className="text-xs text-gray-600 mb-1 block">Port of Supply</Label>
                      <p className="text-sm font-semibold flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {purchaseOrder.requisition.portOfSupply}
                      </p>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">Vendor</Label>
                    <p className="text-sm font-semibold">{purchaseOrder.quote.vendor.name}</p>
                    <p className="text-xs text-gray-500">{purchaseOrder.quote.vendor.primaryEmail}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs text-gray-600 block">Delivery Charges</Label>
                      {canModify && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-5 px-1 text-xs text-blue-600"
                          onClick={() => {
                            const breakdown = purchaseOrder.quote.otherChargesBreakdown;
                            const initial: Record<string, string> = {};
                            DELIVERY_CHARGE_FIELDS.forEach(({ key }) => {
                              const val = breakdown?.[key] ?? (key === "deliveryCharges" ? purchaseOrder.quote.deliveryCharges : undefined);
                              initial[key] = val != null ? String(val) : "";
                            });
                            setChargesBreakdown(initial);
                            setShowDeliveryChargesModal(true);
                          }}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                    <p className="text-sm font-semibold">
                      {purchaseOrder.quote.deliveryCharges 
                        ? formatCurrency(purchaseOrder.quote.deliveryCharges, purchaseOrder.quote.currency)
                        : "Not specified"}
                    </p>
                    {purchaseOrder.quote.deliveryChargesAttachment && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs text-blue-600 mt-1"
                        onClick={() => handleDownload(purchaseOrder.quote.deliveryChargesAttachment!, "delivery-charges.pdf")}
                      >
                        <Paperclip className="h-3 w-3 mr-1" />
                        View Attachment
                      </Button>
                    )}
                  </div>
                </div>

                {/* Vendor tracking (read-only; visible to users with access level 26–100) */}
                {(purchaseOrder.orderTracking || canEditOrderTracking) && (
                  <div className="border rounded-lg p-4 bg-amber-50 border-amber-200">
                    <Label className="text-xs text-gray-600 mb-2 block font-semibold">
                      Order tracking
                      {canEditOrderTracking
                        ? " — editable (access level 32 / 33 or administrator)"
                        : " — read-only"}
                    </Label>
                    {canEditOrderTracking ? (
                      <div className="space-y-3 text-sm">
                        <div>
                          <Label className="text-xs text-gray-600">Readiness status</Label>
                          <Select
                            value={trackingForm.orderReadiness}
                            onValueChange={(v) => setTrackingForm((f) => ({ ...f, orderReadiness: v }))}
                          >
                            <SelectTrigger className="mt-1 h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ORDER_READINESS_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-gray-600">Readiness date</Label>
                            <Input
                              type="date"
                              className="mt-1 h-9"
                              value={trackingForm.readinessDate}
                              onChange={(e) => setTrackingForm((f) => ({ ...f, readinessDate: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">Dispatched date</Label>
                            <Input
                              type="date"
                              className="mt-1 h-9"
                              value={trackingForm.dispatchedDate}
                              onChange={(e) => setTrackingForm((f) => ({ ...f, dispatchedDate: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">AWB / tracking no.</Label>
                            <Input
                              className="mt-1 h-9"
                              value={trackingForm.awb}
                              onChange={(e) => setTrackingForm((f) => ({ ...f, awb: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">Transport company</Label>
                            <Input
                              className="mt-1 h-9"
                              value={trackingForm.transportCompanyName}
                              onChange={(e) =>
                                setTrackingForm((f) => ({ ...f, transportCompanyName: e.target.value }))
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">Expected delivery (scheduled)</Label>
                            <Input
                              type="date"
                              className="mt-1 h-9"
                              value={trackingForm.expectedDeliveryDate}
                              onChange={(e) =>
                                setTrackingForm((f) => ({ ...f, expectedDeliveryDate: e.target.value }))
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">Expected delivery date to agent</Label>
                            <Input
                              type="date"
                              className="mt-1 h-9"
                              value={trackingForm.expectedDeliveryDateToAgent}
                              onChange={(e) =>
                                setTrackingForm((f) => ({ ...f, expectedDeliveryDateToAgent: e.target.value }))
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">Actual delivery date</Label>
                            <Input
                              type="date"
                              className="mt-1 h-9"
                              value={trackingForm.actualDeliveryDate}
                              onChange={(e) =>
                                setTrackingForm((f) => ({ ...f, actualDeliveryDate: e.target.value }))
                              }
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600">Notes</Label>
                          <Textarea
                            className="mt-1 min-h-[72px]"
                            value={trackingForm.trackingNotes}
                            onChange={(e) => setTrackingForm((f) => ({ ...f, trackingNotes: e.target.value }))}
                          />
                        </div>
                        {purchaseOrder.orderTracking?.awbAttachmentUrl && (
                          <p className="text-xs">
                            <a
                              href={purchaseOrder.orderTracking.awbAttachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              View AWB document (uploaded by supplier)
                            </a>
                          </p>
                        )}
                        <Button type="button" size="sm" onClick={saveOrderTracking} disabled={savingTracking}>
                          {savingTracking ? "Saving…" : "Save tracking"}
                        </Button>
                      </div>
                    ) : purchaseOrder.orderTracking ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">Status</span>
                          <p className="font-medium">
                            {formatOrderReadinessLabel(purchaseOrder.orderTracking.orderReadiness)}
                          </p>
                        </div>
                        {purchaseOrder.orderTracking.readinessDate && (
                          <div>
                            <span className="text-gray-500">Readiness Date</span>
                            <p className="font-medium">{formatDate(purchaseOrder.orderTracking.readinessDate)}</p>
                          </div>
                        )}
                        {purchaseOrder.orderTracking.dispatchedDate && (
                          <div>
                            <span className="text-gray-500">Dispatched</span>
                            <p className="font-medium">{formatDate(purchaseOrder.orderTracking.dispatchedDate)}</p>
                          </div>
                        )}
                        {purchaseOrder.orderTracking.awb && (
                          <div>
                            <span className="text-gray-500">AWB</span>
                            <p className="font-medium">{purchaseOrder.orderTracking.awb}</p>
                          </div>
                        )}
                        {purchaseOrder.orderTracking.awbAttachmentUrl && (
                          <div className="sm:col-span-2">
                            <span className="text-gray-500">AWB Document</span>
                            <p>
                              <a
                                href={purchaseOrder.orderTracking.awbAttachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline font-medium"
                              >
                                View AWB document
                              </a>
                            </p>
                          </div>
                        )}
                        {purchaseOrder.orderTracking.transportCompanyName && (
                          <div>
                            <span className="text-gray-500">Transport Company</span>
                            <p className="font-medium">{purchaseOrder.orderTracking.transportCompanyName}</p>
                          </div>
                        )}
                        {purchaseOrder.orderTracking.expectedDeliveryDate && (
                          <div>
                            <span className="text-gray-500">Expected Delivery</span>
                            <p className="font-medium">{formatDate(purchaseOrder.orderTracking.expectedDeliveryDate)}</p>
                          </div>
                        )}
                        {purchaseOrder.orderTracking.expectedDeliveryDateToAgent && (
                          <div>
                            <span className="text-gray-500">Expected Delivery to Agent</span>
                            <p className="font-medium">
                              {formatDate(purchaseOrder.orderTracking.expectedDeliveryDateToAgent)}
                            </p>
                          </div>
                        )}
                        {purchaseOrder.orderTracking.actualDeliveryDate && (
                          <div>
                            <span className="text-gray-500">Actual Delivery</span>
                            <p className="font-medium">{formatDate(purchaseOrder.orderTracking.actualDeliveryDate)}</p>
                          </div>
                        )}
                        {purchaseOrder.orderTracking.trackingNotes && (
                          <div className="sm:col-span-2">
                            <span className="text-gray-500">Notes</span>
                            <p className="font-medium whitespace-pre-wrap">{purchaseOrder.orderTracking.trackingNotes}</p>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}

                {purchaseOrder.requisition.description && (
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">Description</Label>
                    <p className="text-sm">{purchaseOrder.requisition.description}</p>
                  </div>
                )}

                {purchaseOrder.originalPdfUrl && (
                  <div className="border rounded-lg p-4 bg-blue-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="text-sm font-semibold">Original PO PDF</p>
                          <p className="text-xs text-gray-600">Download original purchase order</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(purchaseOrder.originalPdfUrl!, `${purchaseOrder.poNumber}_original.pdf`)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                )}

                {purchaseOrder.mergedPdfUrl && (
                  <div className="border rounded-lg p-4 bg-green-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="text-sm font-semibold">Merged PO PDF</p>
                          <p className="text-xs text-gray-600">Download PO with all attachments</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(purchaseOrder.mergedPdfUrl!, `${purchaseOrder.poNumber}_merged.pdf`)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* History Tab */}
              {canViewHistory && (
              <TabsContent value="history" className="space-y-4 mt-0 flex-1 overflow-y-auto">
                <PurchaseEntityHistoryPanel history={history} />
              </TabsContent>
              )}

              {/* Attachments Tab */}
              <TabsContent value="attachments" className="space-y-4 mt-0 flex-1 overflow-y-auto">
                {purchaseOrder.attachments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Paperclip className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No attachments</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {purchaseOrder.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Paperclip className="h-4 w-4 text-slate-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                            <p className="text-xs text-gray-500">{attachment.fileType}</p>
                            {attachment.description && (
                              <p className="text-xs text-gray-400">{attachment.description}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(attachment.fileUrl, attachment.fileName)}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Chat Tab */}
              <TabsContent value="chat" className="mt-0 flex-1 flex flex-col overflow-hidden min-h-0">
                {/* Reference Information Card */}
                {purchaseOrder && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <p className="text-sm font-semibold text-blue-900">Reference Information</p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <p className="text-gray-600 font-medium mb-1">Requisition Number</p>
                          <p className="text-gray-900 font-semibold">{purchaseOrder.requisition.requisitionNumber}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 font-medium mb-1">PO Number</p>
                          <p className="text-gray-900 font-semibold">{purchaseOrder.poNumber}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 font-medium mb-1">Vendor Ref Number</p>
                          <p className="text-gray-900 font-semibold">
                            {purchaseOrder.quote?.quoteNumber || "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600 font-medium mb-1">Requisition Type</p>
                          <p className="text-gray-900 font-semibold">{purchaseOrder.requisition.requisitionType}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* MODERN CHAT UI - WhatsApp/Viber Pattern: Stable structure, background loading */}
                <div 
                  className="relative flex-1 min-h-0 flex flex-col"
                  style={{ 
                    width: '100%',
                    contain: 'layout style paint', // CSS containment - isolates layout
                    position: 'relative',
                  }}
                >
                  {/* Loading overlay - COMPLETELY SEPARATE, never affects layout */}
                  <div 
                    className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm z-30 rounded-md pointer-events-none"
                    style={{ 
                      display: initialChatLoad && loadingChat && !hasLoadedMessages ? 'flex' : 'none',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                    }}
                  >
                    <div className="flex items-center gap-2 text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <p>Loading messages...</p>
                  </div>
                  </div>
                  
                  {/* Error overlay - COMPLETELY SEPARATE, never affects layout */}
                  <div 
                    className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm z-30 rounded-md"
                    style={{ 
                      display: chatError && chatError.includes("Unauthorized") ? 'flex' : 'none',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                    }}
                  >
                    <p className="text-red-600 mb-2 font-medium">Authentication Error</p>
                    <p className="text-sm text-gray-500 mb-4">Your session may have expired. Please refresh the page.</p>
                    <Button
                      onClick={() => window.location.reload()}
                      variant="outline"
                      size="sm"
                    >
                      Refresh Page
                    </Button>
                        </div>
                  
                  {/* MESSAGES CONTAINER - ALWAYS RENDERED, FIXED STRUCTURE, NEVER CHANGES - SCROLLABLE */}
                  <div 
                    id="chat-messages-container"
                    ref={(el) => {
                      // Store ref for auto-scroll
                      if (el) {
                        const hook = (window as any).__chatHookRef;
                        if (hook && hook.setContainerRef) {
                          hook.setContainerRef(el);
                        }
                      }
                    }}
                    className="flex-1 overflow-y-auto pr-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    style={{ 
                      width: '100%',
                      contain: 'layout style paint', // Isolate from parent
                      position: 'relative',
                      // Prevent any layout shifts
                      willChange: 'scroll-position',
                      minHeight: 0, // Important for flex scrolling
                    }}
                  >
                    {/* SINGLE STABLE CONTAINER - Structure never changes */}
                    <div 
                      className="space-y-4 py-2"
                      style={{
                        minHeight: '100%', // Always fill container
                      }}
                    >
                      {/* Empty state - positioned absolutely, doesn't affect flow */}
                      <div 
                        className="absolute inset-0 flex items-center justify-center text-gray-500"
                        style={{ 
                          display: chatMessages.length === 0 && !loadingChat ? 'flex' : 'none',
                          pointerEvents: 'none', // Don't block clicks
                        }}
                      >
                        <div className="text-center">
                          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <p>No messages yet. Start the conversation!</p>
                                  </div>
                                </div>
                      
                      {/* MESSAGES - Always rendered, even if empty array */}
                      {memoizedChatMessages}
                              </div>
                            </div>
                    </div>
                
                {/* Chat input section - FIXED AT BOTTOM, ALWAYS VISIBLE */}
                <div className="border-t pt-4 space-y-2 flex-shrink-0 bg-white z-10 sticky bottom-0">
                      {chatFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {chatFiles.map((file, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-2 bg-gray-100 px-2 py-1 rounded text-sm"
                            >
                              <FileText className="h-4 w-4" />
                              <span className="max-w-[200px] truncate">{file.name}</span>
                              <button
                                onClick={() => removeChatFile(index)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Type your message..."
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                            handleSendChatMessage();
                            }
                          }}
                          className="flex-1"
                        />
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            multiple
                            onChange={handleChatFileSelect}
                            className="hidden"
                          />
                          <Button type="button" variant="outline" size="icon" asChild>
                            <span>
                              <Paperclip className="h-4 w-4" />
                            </span>
                          </Button>
                        </label>
                        <Button
                          onClick={handleSendChatMessage}
                          disabled={sendingMessage || (!chatMessage.trim() && chatFiles.length === 0)}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
              </TabsContent>

              {/* Agent Requests Tab */}
              <TabsContent value="agent-requests" className="space-y-4 mt-0 flex-1 overflow-y-auto">
                {loadingAgentRequests ? (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-gray-500">Loading agent requests...</p>
                  </div>
                ) : agentRequests.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <User className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No agent detail requests</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {agentRequests.map((request) => (
                      <Card key={request.id} className={request.status === "PENDING" ? "border-orange-300 bg-orange-50" : ""}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">
                              Request from {request.vendor?.name || "Vendor"}
                            </CardTitle>
                            <Badge
                              className={
                                request.status === "PENDING"
                                  ? "bg-orange-600 text-white"
                                  : request.status === "RESPONDED"
                                  ? "bg-green-600 text-white"
                                  : "bg-gray-600 text-white"
                              }
                            >
                              {request.status}
                            </Badge>
                          </div>
                          <CardDescription className="text-xs">
                            Requested: {formatDate(request.createdAt)}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {request.requestMessage && (
                            <div className="mb-4">
                              <Label className="text-xs text-gray-600 mb-1 block">Request Message</Label>
                              <p className="text-sm bg-white p-2 rounded border">{request.requestMessage}</p>
                            </div>
                          )}
                          {request.status === "RESPONDED" && request.agentDetails && (
                            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
                              <Label className="text-xs text-gray-600 mb-1 block">Agent Details Provided</Label>
                              <p className="text-sm whitespace-pre-wrap">{request.agentDetails}</p>
                              {request.responseMessage && (
                                <p className="text-xs text-gray-600 mt-2 italic">
                                  Note: {request.responseMessage}
                                </p>
                              )}
                              {request.respondedBy && (
                                <p className="text-xs text-gray-500 mt-2">
                                  Responded by: {request.respondedBy.firstName} {request.respondedBy.lastName} on {request.respondedAt ? formatDate(request.respondedAt) : ""}
                                </p>
                              )}
                            </div>
                          )}
                          {request.status === "PENDING" && canModify && (
                            <Button
                              size="sm"
                              onClick={() => openAgentResponseModal(request)}
                            >
                              Provide Agent Details
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Purchase order not found</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modify Modal */}
      {showModifyModal && (
        <Dialog open={showModifyModal} onOpenChange={setShowModifyModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modify Purchase Order</DialogTitle>
              <DialogDescription>
                Provide a reason for modifying this purchase order. This action will be recorded in the history.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="modifyComments">Reason for Modification</Label>
                <Textarea
                  id="modifyComments"
                  value={modifyComments}
                  onChange={(e) => setModifyComments(e.target.value)}
                  placeholder="Enter reason for modification..."
                  rows={4}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowModifyModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleModify} disabled={isSubmitting || !modifyComments.trim()}>
                  {isSubmitting ? "Modifying..." : "Modify"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Purchase Order</DialogTitle>
              <DialogDescription>
                Provide a reason for cancelling this purchase order. This action cannot be undone and will be recorded in the history.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="cancelComments">Reason for Cancellation</Label>
                <Textarea
                  id="cancelComments"
                  value={cancelComments}
                  onChange={(e) => setCancelComments(e.target.value)}
                  placeholder="Enter reason for cancellation..."
                  rows={4}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowCancelModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={isSubmitting || !cancelComments.trim()}
                >
                  {isSubmitting ? "Cancelling..." : "Cancel PO"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Update Delivery & Other Charges Modal */}
      {showDeliveryChargesModal && (
        <Dialog open={showDeliveryChargesModal} onOpenChange={setShowDeliveryChargesModal}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Update Delivery & Other Charges</DialogTitle>
              <DialogDescription>
                Manually update delivery and other charges and attachment for this purchase order.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateDeliveryCharges} className="space-y-4">
              {DELIVERY_CHARGE_FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <Label htmlFor={key}>{label}</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-2.5 text-gray-500 text-sm">
                      {purchaseOrder?.currency || "$"}
                    </span>
                    <Input
                      id={key}
                      type="number"
                      step="0.01"
                      min={0}
                      value={chargesBreakdown[key] ?? ""}
                      onChange={(e) => setChargesBreakdown((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="pl-8"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t">
                <p className="text-sm font-medium text-gray-700">
                  Total: {purchaseOrder?.currency || "$"} {chargesTotal.toFixed(2)}
                </p>
              </div>
              <div>
                <Label htmlFor="deliveryChargesFile">Attachment (Optional)</Label>
                <Input
                  id="deliveryChargesFile"
                  type="file"
                  onChange={(e) => setDeliveryChargesFile(e.target.files?.[0] || null)}
                  className="mt-1"
                />
                {deliveryChargesFile && (
                  <p className="text-xs text-gray-500 mt-1">
                    Selected: {deliveryChargesFile.name}
                  </p>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowDeliveryChargesModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updatingDeliveryCharges}>
                  {updatingDeliveryCharges ? "Updating..." : "Update Charges"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Agent Response Modal */}
      {showAgentResponseModal && selectedAgentRequest && (
        <Dialog open={showAgentResponseModal} onOpenChange={setShowAgentResponseModal}>
          <DialogContent >
            <DialogHeader>
              <DialogTitle>Provide Agent Details</DialogTitle>
              <DialogDescription>
                Provide receiving agent details for PO: {purchaseOrder?.poNumber}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedAgentRequest.requestMessage && (
                <div className="p-3 bg-gray-50 rounded border">
                  <Label className="text-xs text-gray-600 mb-1 block">Vendor Request</Label>
                  <p className="text-sm">{selectedAgentRequest.requestMessage}</p>
                </div>
              )}
              <div>
                <Label htmlFor="agentDetails" className="mb-2 block">
                  Agent Details <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="agentDetails"
                  placeholder="Enter receiving agent details (name, address, contact information, etc.)..."
                  value={agentDetails}
                  onChange={(e) => setAgentDetails(e.target.value)}
                  rows={6}
                  required
                />
              </div>
              <div>
                <Label htmlFor="responseMessage" className="mb-2 block">
                  Additional Message (Optional)
                </Label>
                <Textarea
                  id="responseMessage"
                  placeholder="Add any additional notes or instructions..."
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAgentResponseModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={submitAgentResponse}
                  disabled={submittingAgentResponse || !agentDetails.trim()}
                >
                  {submittingAgentResponse ? "Submitting..." : "Submit Agent Details"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}


