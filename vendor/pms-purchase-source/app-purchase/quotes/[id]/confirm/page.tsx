'use client';
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import ActiniumLoader from '@/components/ActiniumLoader';
import { PurchaseApprovalMatrix } from '@/components/purchase/PurchaseApprovalMatrix';
import type { PurchaseWorkflowStep } from '@/lib/procurement/purchase-workflow-step';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Send, ArrowLeft, FileText, Plus, X, RotateCcw, CheckCircle2, Undo2 } from 'lucide-react';
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import { PurchaseOrderWorkflowStatus, poWorkflowStatusLabel } from "@/lib/types/purchase-order-workflow";
import { quoteCreatePoPath } from "@/lib/procurement/quote-po-navigation";
import { clearPoNavBounce, recordPoNavBounce } from "@/lib/navigation/po-redirect-loop-guard";
import { canSendPoToVendor, canUserApprovePendingPoLevel } from "@/lib/procurement/po-confirm-access";
import { NOTIFICATION_TASKS_TAB_PATH } from "@/lib/notifications/notification-routes";

const PO_FROM_EMAIL = "po@actinium-sm.com";

interface RequisitionLineItem {
  lineNumber: number;
  itemName: string;
  description?: string | null;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  totalPrice: number | null;
  impaNumber?: string | null;
}

interface QuoteData {
  quoteId: string;
  requisitionId: string;
  requisitionNumber: string;
  heading: string;
  budgetCode?: string | null;
  isBudgeted?: boolean | null;
  isSplitChild?: boolean;
  parentRequisitionId?: string | null;
  lineItems?: RequisitionLineItem[];
  vessel: {
    id: string;
    name: string;
    code: string;
  };
  quote: {
    id: string;
    totalAmount: number | null;
    currency: string;
    vendor: {
      id: string;
      name: string;
      primaryEmail: string;
      secondaryEmail: string | null;
    };
  };
}

interface ApprovalStatus {
  level: number;
  status: 'PENDING' | 'APPROVED' | 'NOT_REQUIRED';
  approverName?: string;
  approvedAt?: string;
}

function pdfPreviewUrl(url: string): string {
  const params = 'navpanes=0&toolbar=1&view=FitH&zoom=page-width';
  return url.includes('#') ? url : `${url}#${params}`;
}

const PAGE_WIDTH_CLASS = 'app-shell-95vw min-w-0 py-4 overflow-x-hidden';
/** Table body viewport: header + 8 data rows (~44px each). */
const REQUISITION_ITEMS_SCROLL_MAX_PX = 40 + 8 * 44;

export default function ConfirmQuotePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromNotification = searchParams.get('from') === 'notification';
  const childRequisitionId = searchParams.get('childRequisitionId')?.trim() || '';
  const quoteId = params.id as string;
  const { markSuccess, markFailure, reset } = usePageBootstrap();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [poNumber, setPoNumber] = useState<string>('');
  const [poId, setPoId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus[]>([]);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [requiresThreeApprovals, setRequiresThreeApprovals] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState<string | null>(null);
  const [readyToSend, setReadyToSend] = useState(false);
  const [ccEmails, setCcEmails] = useState<string[]>(['']);
  const [customMessage, setCustomMessage] = useState('');
  const [isBudgetedSelection, setIsBudgetedSelection] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<{ email: string; designationAccessLevel?: number; id?: string } | null>(null);
  const [approving, setApproving] = useState(false);
  const [workflowSteps, setWorkflowSteps] = useState<PurchaseWorkflowStep[]>([]);
  const [canReturnToQuoteSelection, setCanReturnToQuoteSelection] = useState(false);
  const [canSendToVendor, setCanSendToVendor] = useState(true);
  const [pendingApprovalLevel, setPendingApprovalLevel] = useState<number | null>(null);
  const [canApproveNow, setCanApproveNow] = useState(false);
  const [canRejectNow, setCanRejectNow] = useState(false);
  const [rejectableLevel, setRejectableLevel] = useState<number | null>(null);
  const [rejectTargetStatusLabel, setRejectTargetStatusLabel] = useState<string | null>(null);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [returning, setReturning] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [sessionAccessLevel, setSessionAccessLevel] = useState<number | null>(null);

  useEffect(() => {
    fetchQuoteData();
    fetchCurrentUser();
  }, [quoteId, childRequisitionId]);

  useEffect(() => {
    const level = sessionAccessLevel ?? currentUser?.designationAccessLevel;
    if (level == null || approvalStatus.length === 0) return;
    const { canApprove, level: pending } = canUserApprovePendingPoLevel(level, approvalStatus);
    if (canApprove) {
      setCanApproveNow(true);
      setPendingApprovalLevel(pending);
    }
  }, [sessionAccessLevel, currentUser?.designationAccessLevel, approvalStatus]);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/profile/basic', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentUser({
          email: data.user?.email,
          designationAccessLevel: data.user?.designationAccessLevel,
          id: data.user?.id,
        });
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchPdfUrl = async (poId: string) => {
    try {
      const response = await fetch(`/api/purchase-orders/${poId}/pdf`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setPdfUrl(data.signedUrl);
      } else {
        console.error('Failed to fetch PDF URL');
        setPdfUrl(null);
      }
    } catch (error) {
      console.error('Error fetching PDF URL:', error);
      setPdfUrl(null);
    }
  };

  const fetchQuoteData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      reset();
      console.log(`🔵 [CONFIRM PAGE] Fetching quote data for quote ID: ${quoteId}`);
      
      const confirmDataUrl = childRequisitionId
        ? `/api/quotes/${quoteId}/confirm-data?childRequisitionId=${encodeURIComponent(childRequisitionId)}`
        : `/api/quotes/${quoteId}/confirm-data`;

      const response = await fetch(confirmDataUrl, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`🔵 [CONFIRM PAGE] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch (e) {
          // If response is not JSON, use status text
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        console.error('❌ [CONFIRM PAGE] Error response:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
        });
        
        const errorMessage = errorData.error || errorData.details || `Failed to fetch quote data (${response.status})`;
        setLoadError(errorMessage);
        markFailure(errorMessage);
        toast.error(errorMessage, {
          description: errorData.details || errorData.message,
          duration: 8000,
        });
        return;
      }

      const data = await response.json();
      console.log('✅ [CONFIRM PAGE] Quote data received:', {
        hasQuoteData: !!data.quoteData,
        poNumber: data.poNumber,
        hasPdfUrl: !!data.pdfUrl,
        approvalStatusCount: data.approvalStatus?.length || 0,
      });
      
      if (!data.quoteData) {
        throw new Error('Quote data is missing from response');
      }

      if (!data.poId) {
        const createPath =
          typeof data.createPoPath === 'string' && data.createPoPath.length > 0
            ? data.createPoPath
            : quoteCreatePoPath(quoteId, {
                from: fromNotification ? 'notification' : undefined,
                childRequisitionId: childRequisitionId || undefined,
                revision: true,
              });
        if (recordPoNavBounce(quoteId)) {
          const loopMessage =
            'Could not open this quote — purchase order state is inconsistent. Use Purchase → Create PO and select the quote manually.';
          setLoadError(loopMessage);
          markFailure(loopMessage);
          toast.error(loopMessage);
          return;
        }
        toast.info('Create the Purchase Order before sending to the vendor.');
        router.replace(createPath);
        return;
      }

      clearPoNavBounce(quoteId);
      
      setQuoteData(data.quoteData);
      setPoNumber(data.poNumber || '');
      setPoId(data.poId || null);
      setApprovalStatus(data.approvalStatus || []);
      setWorkflowStatus(data.workflowStatus ?? null);
      setReadyToSend(Boolean(data.readyToSend));
      setRequiresApproval(Boolean(data.requiresApproval));
      setRequiresThreeApprovals(Boolean(data.requiresThreeApprovals));
      setWorkflowSteps(data.workflowSteps ?? []);
      setCanReturnToQuoteSelection(Boolean(data.canReturnToQuoteSelection));
      setCanSendToVendor(
        typeof data.canSendToVendor === 'boolean'
          ? data.canSendToVendor
          : canSendPoToVendor(currentUser?.designationAccessLevel)
      );
      setPendingApprovalLevel(
        typeof data.pendingApprovalLevel === 'number' ? data.pendingApprovalLevel : null
      );
      setCanApproveNow(Boolean(data.canApproveNow));
      setCanRejectNow(Boolean(data.canRejectNow));
      setRejectableLevel(typeof data.rejectableLevel === 'number' ? data.rejectableLevel : null);
      setRejectTargetStatusLabel(
        typeof data.rejectTargetStatusLabel === 'string' ? data.rejectTargetStatusLabel : null
      );
      if (typeof data.sessionUserId === 'string') {
        setSessionUserId(data.sessionUserId);
      }
      if (typeof data.userAccessLevel === 'number') {
        setSessionAccessLevel(data.userAccessLevel);
      }
      setIsBudgetedSelection(
        data.quoteData.isBudgeted === true
          ? true
          : data.quoteData.isBudgeted === false
            ? false
            : data.quoteData.budgetCode
              ? true
              : null
      );
      
      // Fetch signed URL for PDF if PO ID exists
      if (data.poId) {
        fetchPdfUrl(data.poId);
      } else {
        setPdfUrl(null);
      }
      
      // Pre-fill CC with secondary email if available
      if (data.quoteData?.quote?.vendor?.secondaryEmail) {
        setCcEmails([data.quoteData.quote.vendor.secondaryEmail]);
      }
      
      markSuccess();
    } catch (error: any) {
      console.error('❌ [CONFIRM PAGE] Error fetching quote data:', error);
      const errorMessage = error?.message || error?.error || 'Failed to fetch quote data';
      setLoadError(errorMessage);
      markFailure(errorMessage);
      console.error('❌ [CONFIRM PAGE] Error details:', {
        message: errorMessage,
        name: error?.name,
        stack: error?.stack,
      });
      
      toast.error(errorMessage, {
        description: 'Use Try again or return to requisitions.',
        duration: 8000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePO = async (level: number) => {
    const actorUserId = currentUser?.id ?? sessionUserId;
    if (!quoteData || !actorUserId) {
      toast.error('User not authenticated');
      return;
    }

    try {
      setApproving(true);
      
      if (!poId) {
        toast.error('Purchase Order ID not found. Please refresh the page.');
        return;
      }

      const approveResponse = await fetch(`/api/purchase-orders/${poId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          comments: `Approved at Level ${level}`,
        }),
      });

      const approveData = await approveResponse.json();

      if (!approveResponse.ok) {
        toast.error(approveData.error || 'Failed to approve Purchase Order', {
          description: approveData.message,
        });
        return;
      }

      toast.success(`Purchase Order approved at Level ${level}`);
      if (fromNotification) {
        router.push(NOTIFICATION_TASKS_TAB_PATH);
        return;
      }
      // Refresh approval status
      await fetchQuoteData();
    } catch (error) {
      console.error('Error approving PO:', error);
      toast.error('Failed to approve Purchase Order');
    } finally {
      setApproving(false);
    }
  };

  const canReturnToQuotes = (): boolean => {
    if (!canReturnToQuoteSelection || workflowStatus === PurchaseOrderWorkflowStatus.PO_SENT) {
      return false;
    }
    const userLevel = currentUser?.designationAccessLevel ?? 0;
    const allowedLevels = [32, 33, 50, 99, 100];
    return allowedLevels.includes(userLevel) || isAdminEquivalentAccessLevel(userLevel);
  };

  const handleReturnToQuoteSelection = async () => {
    if (!returnReason.trim()) {
      toast.error('Please provide a reason for returning to quote selection');
      return;
    }

    try {
      setReturning(true);
      const response = await fetch(`/api/quotes/${quoteId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          returnToSelection: true,
          reason: returnReason.trim(),
          ...(childRequisitionId ? { childRequisitionId } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to return to quote selection');
        return;
      }

      toast.success(data.message || 'Returned to quote selection');
      setShowReturnDialog(false);
      setReturnReason('');
      const quotesPath =
        typeof data.quotesPath === 'string'
          ? data.quotesPath
          : quoteData
            ? `/purchase/requisitions/${
                quoteData.isSplitChild && quoteData.parentRequisitionId
                  ? quoteData.parentRequisitionId
                  : quoteData.requisitionId
              }/quotes`
            : '/purchase/view-requisitions';
      router.push(quotesPath);
    } catch (error) {
      console.error('Error returning to quote selection:', error);
      toast.error('Failed to return to quote selection');
    } finally {
      setReturning(false);
    }
  };

  const handleRejectPO = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for returning this PO');
      return;
    }
    if (!poId) {
      toast.error('Purchase Order ID not found');
      return;
    }

    const comments = rejectReason.trim();
    setShowRejectDialog(false);
    setRejectReason('');
    setRejecting(true);

    try {
      const response = await fetch(`/api/purchase-orders/${poId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ comments }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to return PO');
        return;
      }

      toast.success(
        data.message ||
          (data.returnedToPurchaser || data.removed
            ? 'PO returned to purchaser to re-create'
            : `PO returned to ${rejectTargetStatusLabel || poWorkflowStatusLabel(data.workflowStatus)}`)
      );
      if (fromNotification) {
        router.push(NOTIFICATION_TASKS_TAB_PATH);
        return;
      }
      await fetchQuoteData();
    } catch (error) {
      console.error('Error returning PO:', error);
      toast.error('Failed to return PO');
    } finally {
      setRejecting(false);
    }
  };

  const handleSendPO = async () => {
    if (!quoteData) {
      toast.error('Quote data not available');
      return;
    }

    if (isBudgetedSelection !== true && isBudgetedSelection !== false) {
      toast.error('Select Budgeted or Un-Budgeted before sending the PO');
      return;
    }

    if (!currentUser?.email?.trim()) {
      toast.error('Your account must have an email address to send a PO (required for CC)');
      return;
    }

    try {
      setSending(true);
      const response = await fetch(`/api/quotes/${quoteId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          poNumber,
          isBudgeted: isBudgetedSelection,
          ccEmails: ccEmails.filter(email => email.trim()).join(', ') || undefined,
          customMessage: customMessage.trim() || undefined,
          ...(childRequisitionId ? { childRequisitionId } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to send Purchase Order');
        return;
      }

      toast.success('Purchase Order sent successfully!');
      router.push(fromNotification ? NOTIFICATION_TASKS_TAB_PATH : '/purchase/view-requisitions');
    } catch (error) {
      console.error('Error sending PO:', error);
      toast.error('Failed to send Purchase Order');
    } finally {
      setSending(false);
    }
  };

  const addCcEmail = () => {
    setCcEmails([...ccEmails, '']);
  };

  const removeCcEmail = (index: number) => {
    if (ccEmails.length > 1) {
      setCcEmails(ccEmails.filter((_, i) => i !== index));
    }
  };

  const updateCcEmail = (index: number, value: string) => {
    const updated = [...ccEmails];
    updated[index] = value;
    setCcEmails(updated);
  };

  const pageReady = !loading && !!quoteData;

  return (
    <ProtectedRoute>
      <PageReadyGate
        ready={pageReady}
        error={!loading && !quoteData ? loadError || 'Unable to load quote confirmation data' : null}
        onRetry={() => fetchQuoteData()}
        loadingText="Loading quote confirmation…"
        className="flex min-h-[60vh] w-full items-center justify-center p-6"
        render={() => {
          if (!quoteData) return null;

          const totalAmount = quoteData.quote.totalAmount || 0;
          const currency = quoteData.quote.currency || 'USD';
          const lineItems = quoteData.lineItems ?? [];
          const approverOnlyView = !canSendToVendor;
          const effectiveAccessLevel =
            sessionAccessLevel ?? currentUser?.designationAccessLevel ?? null;
          const clientApproval = canUserApprovePendingPoLevel(
            effectiveAccessLevel,
            approvalStatus
          );
          const activeApprovalLevel =
            pendingApprovalLevel ?? clientApproval.level ?? null;
          const showApproveButton =
            activeApprovalLevel != null &&
            (canApproveNow || clientApproval.canApprove);

          return (
            <>
            {rejecting && (
              <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
                <ActiniumLoader size="lg" text="Returning PO…" showDots />
              </div>
            )}
            <div className={PAGE_WIDTH_CLASS}>
              <div className="mb-4 min-w-0">
                {fromNotification && (
                  <Link
                    href={NOTIFICATION_TASKS_TAB_PATH}
                    className="mb-2 inline-block text-sm font-medium text-primary hover:underline"
                  >
                    ← Return to Tasks
                  </Link>
                )}

                <h1 className="text-2xl font-bold leading-tight">
                  {approverOnlyView ? 'Approve Purchase Order' : 'Send Purchase Order to Vendor'}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {approverOnlyView
                    ? 'Review the PO details and PDF, then approve using the button above.'
                    : 'Review the PO and email the vendor when all approvals are complete.'}
                </p>

                <div className="mt-3 flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {showApproveButton ? (
                      <Button
                        size="sm"
                        className="bg-info hover:bg-info"
                        disabled={approving}
                        onClick={() => handleApprovePO(activeApprovalLevel!)}
                      >
                        {approving ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            Approving…
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                            Approve PO (Level {activeApprovalLevel})
                          </>
                        )}
                      </Button>
                    ) : null}
                    {canReturnToQuotes() ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-border text-info hover:bg-info"
                        onClick={() => setShowReturnDialog(true)}
                        disabled={returning}
                      >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                      Return to Quotes
                    </Button>
                  ) : null}
                    {canRejectNow ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-destructive/40 text-destructive hover:bg-destructive/10"
                        onClick={() => setShowRejectDialog(true)}
                        disabled={rejecting}
                      >
                        <Undo2 className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                        Return PO
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(
                          fromNotification ? NOTIFICATION_TASKS_TAB_PATH : '/purchase/view-requisitions'
                        )
                      }
                    >
                      <ArrowLeft className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                      Back
                    </Button>
                  </div>

                  {workflowSteps.length > 0 ? (
                    <div className="min-w-0 flex-1 overflow-x-auto lg:flex lg:justify-end">
                      <PurchaseApprovalMatrix
                        variant="inline"
                        className="lg:ml-auto"
                        steps={workflowSteps}
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid w-full min-w-0 grid-cols-1 gap-6 xl:grid-cols-12">
                {/* Left Column - Details and Email */}
                <div className="min-w-0 space-y-6 xl:col-span-5">
            {/* PO Details Card */}
            <Card>
              <CardHeader>
                <CardTitle>Purchase Order Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">PO Number</Label>
                    <p className="text-lg font-semibold">{poNumber || 'Generating...'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Requisition Number</Label>
                    <p className="text-lg font-semibold">{quoteData.requisitionNumber}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Vessel</Label>
                    <p className="text-lg">{quoteData.vessel.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Total Amount</Label>
                    <p className="text-lg font-semibold">
                      {quoteData.quote.currency} {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Requisition line items</CardTitle>
                <CardDescription>
                  {lineItems.length} item{lineItems.length !== 1 ? 's' : ''} on{' '}
                  {quoteData.requisitionNumber}
                  {quoteData.heading ? ` · ${quoteData.heading}` : ''}
                  {lineItems.length > 8 ? ' — scroll to view all rows' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {lineItems.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-muted-foreground">No line items found.</p>
                ) : (
                  <div
                    className="overflow-y-auto overflow-x-auto border-t"
                    style={{ maxHeight: REQUISITION_ITEMS_SCROLL_MAX_PX }}
                  >
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                        <TableRow>
                          <TableHead className="w-12">S.No.</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead className="w-20 text-right">Qty</TableHead>
                          <TableHead className="w-16">Unit</TableHead>
                          <TableHead className="w-28 text-right">Unit price</TableHead>
                          <TableHead className="w-28 text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lineItems.map((line) => (
                          <TableRow key={line.lineNumber}>
                            <TableCell className="text-muted-foreground">{line.lineNumber}</TableCell>
                            <TableCell>
                              <p className="font-medium leading-snug">{line.itemName}</p>
                              {line.impaNumber ? (
                                <p className="text-xs text-muted-foreground">IMPA/Part: {line.impaNumber}</p>
                              ) : null}
                              {line.description ? (
                                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                  {line.description}
                                </p>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-right">{line.quantity}</TableCell>
                            <TableCell>{line.unit}</TableCell>
                            <TableCell className="text-right">
                              {line.unitPrice != null
                                ? `${currency} ${line.unitPrice.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}`
                                : '—'}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {line.totalPrice != null
                                ? `${currency} ${line.totalPrice.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}`
                                : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {canSendToVendor ? (
            <>
            <Card>
              <CardHeader>
                <CardTitle>Budget classification</CardTitle>
                <CardDescription>
                  Required for Budget Performance reporting. Same choice as on the quote comparison page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {quoteData.budgetCode && (
                  <p className="text-sm text-muted-foreground">
                    Budget code: <span className="font-medium text-foreground">{quoteData.budgetCode}</span>
                  </p>
                )}
                <div className="flex flex-wrap gap-6">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={isBudgetedSelection === true}
                      onCheckedChange={(c) => setIsBudgetedSelection(c === true ? true : null)}
                    />
                    Budgeted
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={isBudgetedSelection === false}
                      onCheckedChange={(c) => setIsBudgetedSelection(c === true ? false : null)}
                    />
                    Un-Budgeted
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Email Configuration Card */}
            <Card>
              <CardHeader>
                <CardTitle>Email Configuration</CardTitle>
                <CardDescription>
                  PO emails are sent via Resend from {PO_FROM_EMAIL}. Your login email is always CC&apos;d.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="fromEmail">From</Label>
                  <Input id="fromEmail" value={PO_FROM_EMAIL} disabled className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="toEmail">To</Label>
                  <Input
                    id="toEmail"
                    value={quoteData.quote.vendor.primaryEmail}
                    disabled
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="senderCcEmail">CC — you (required)</Label>
                  <Input
                    id="senderCcEmail"
                    value={currentUser?.email ?? ''}
                    disabled
                    placeholder="Your account email (required to send PO)"
                    className="mt-1"
                  />
                  {!currentUser?.email ? (
                    <p className="mt-1 text-xs text-destructive">
                      Your user profile has no email. PO cannot be sent until this is set.
                    </p>
                  ) : null}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Additional CC (optional)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addCcEmail}
                      className="h-7 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add CC
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {ccEmails.map((email, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          type="email"
                          placeholder="email@example.com"
                          value={email}
                          onChange={(e) => updateCcEmail(index, e.target.value)}
                          className="flex-1"
                        />
                        {ccEmails.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeCcEmail(index)}
                            className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="customMessage">Custom Message (Optional)</Label>
                  <Textarea
                    id="customMessage"
                    placeholder="Add any additional notes or instructions..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={4}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                onClick={handleSendPO}
                disabled={
                  sending ||
                  !poNumber ||
                  !currentUser?.email?.trim() ||
                  workflowStatus === PurchaseOrderWorkflowStatus.PO_SENT ||
                  !readyToSend ||
                  approvalStatus.some((s) => s.status === 'PENDING')
                }
                className="flex-1 bg-success hover:bg-success disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  workflowStatus === PurchaseOrderWorkflowStatus.PO_SENT
                    ? 'Purchase Order has already been sent to the vendor'
                    : !readyToSend
                      ? `Current stage: ${poWorkflowStatusLabel(workflowStatus)}`
                    : approvalStatus.some((s) => s.status === 'PENDING')
                    ? 'All approval levels must be completed before sending'
                    : undefined
                }
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Purchase Order
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(fromNotification ? NOTIFICATION_TASKS_TAB_PATH : '/purchase/view-requisitions')}
              >
                Cancel
              </Button>
            </div>
            </>
            ) : (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => router.push(fromNotification ? NOTIFICATION_TASKS_TAB_PATH : '/purchase/view-requisitions')}
                >
                  {fromNotification ? 'Back to Tasks' : 'Done'}
                </Button>
              </div>
            )}
          </div>

          {/* Right Column - PDF Preview */}
          <div className="min-w-0 xl:col-span-7">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Purchase Order PDF</CardTitle>
              </CardHeader>
              <CardContent className="min-w-0">
                {pdfUrl ? (
                  <div className="space-y-4">
                    <div className="overflow-auto rounded-lg border">
                      <iframe
                        src={pdfPreviewUrl(pdfUrl)}
                        className="block h-[min(85vh,900px)] w-full min-w-0"
                        title="PO PDF Preview"
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => window.open(pdfUrl, '_blank')}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Open in New Tab
                    </Button>
                  </div>
                ) : (
                  <div className="flex h-[min(85vh,900px)] min-h-[420px] items-center justify-center rounded-lg border">
                    <ActiniumLoader size="md" text="Refreshing PDF…" showDots />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return to Quote Selection</AlertDialogTitle>
            <AlertDialogDescription>
              This cancels the current Purchase Order and reopens quote comparison so another vendor quote can be
              selected and approved. A reason is required.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="return-reason">Reason</Label>
              <Textarea
                id="return-reason"
                placeholder="Explain why you are returning to quote selection..."
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                rows={4}
                className="mt-2"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReturnReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReturnToQuoteSelection}
              disabled={!returnReason.trim() || returning}
              className="bg-info hover:bg-info"
            >
              {returning ? 'Returning...' : 'Return to Quotes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return PO for revision</AlertDialogTitle>
            <AlertDialogDescription>
              {rejectableLevel != null ? (
                <>
                  This rejects the PO at Level {rejectableLevel} and returns it to the purchaser
                  (access levels 32/33) to{' '}
                  <span className="font-medium text-foreground">re-create the purchase order</span>.
                  Level 1 and Level 2 approvers are not notified — only the purchasing team receives
                  a task to issue a new PO.
                </>
              ) : (
                'This returns the PO to the purchaser for revision. A reason is required.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="reject-reason">Reason</Label>
              <Textarea
                id="reject-reason"
                placeholder="Explain why you are returning this PO..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                className="mt-2"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectPO}
              disabled={!rejectReason.trim() || rejecting}
              className="bg-destructive hover:bg-destructive"
            >
              {rejecting ? 'Returning...' : 'Return PO'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
            </>
          );
        }}
      />
    </ProtectedRoute>
  );
}

