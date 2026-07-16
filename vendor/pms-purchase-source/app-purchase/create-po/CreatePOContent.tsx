'use client';
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FilterFieldShell,
  filterTriggerClearPadding,
} from '@/components/ui/clearable-input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Loader2, Send, Download, CheckCircle2, FileText, Plus, GitBranch, Mail, ShieldCheck } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useVessels } from '@/hooks/useStaticData';
import { fieldErrorCn } from '@/lib/form-field-highlight';
import ActiniumLoader from '@/components/ActiniumLoader';
import { quoteSendPoPath } from '@/lib/procurement/quote-po-navigation';
import { clearPoNavBounce, recordPoNavBounce } from '@/lib/navigation/po-redirect-loop-guard';
import { PurchaseApprovalMatrix } from '@/components/purchase/PurchaseApprovalMatrix';
import { buildPoCreatePreviewSteps } from '@/lib/procurement/po-create-preview';
import { usePurchaseOrdersHubOptional } from '@/components/purchase/purchase-orders-hub-context';

const PO_FROM_EMAIL = 'po@actinium-sm.com';

interface Vessel {
  id: string;
  name: string;
  code: string;
  imoNumber: string | null;
}

interface QuoteLineItem {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  totalPrice: number | null;
}

interface PendingSingleQuote {
  kind: 'single';
  quoteId: string;
  requisitionId: string;
  requisitionNumber: string;
  manualReqNumber: string | null;
  heading: string;
  description: string | null;
  portOfSupply: string | null;
  requisitionType: string;
  vessel: Vessel;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  requiresApproval?: boolean;
  requiresThreeApprovals?: boolean;
  quote: {
    id: string;
    totalAmount: number | null;
    currency: string;
    validUntil: Date | null;
    receivedAt: Date | null;
    vendor: {
      id: string;
      name: string;
      primaryEmail: string;
      secondaryEmail: string | null;
      contactPerson: string | null;
      phone: string | null;
      address: string | null;
    };
    quotedItems: QuoteLineItem[];
  };
}

interface SplitChildPending {
  childRequisitionId: string;
  childRequisitionNumber: string;
  childStatus: string;
  quoteId: string;
  vendorId: string;
  vendorName: string;
  vendorEmail: string;
  totalAmount: number | null;
  currency: string;
  poIssued: boolean;
  poId: string | null;
  poNumber: string | null;
  poWorkflowStatus: string | null;
  poSentToVendor: boolean;
  quotedItems: QuoteLineItem[];
}

const PO_TIER_APPROVAL_THRESHOLD = 3000;

interface PendingSplitGroup {
  kind: 'split';
  parentRequisitionId: string;
  parentRequisitionNumber: string;
  manualReqNumber: string | null;
  heading: string;
  description: string | null;
  portOfSupply: string | null;
  requisitionType: string;
  vessel: Vessel;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  vendorCount: number;
  pendingPoCount: number;
  issuedPoCount: number;
  totalAmount: number;
  currency: string;
  children: SplitChildPending[];
}

type PendingPOItem = PendingSingleQuote | PendingSplitGroup;

function pendingItemKey(item: PendingPOItem): string {
  return item.kind === 'single'
    ? `single:${item.quoteId}`
    : `split:${item.parentRequisitionId}`;
}

function findPendingItemByQuoteId(
  items: PendingPOItem[],
  quoteId: string
): { item: PendingPOItem; vesselId: string } | null {
  for (const item of items) {
    if (item.kind === 'single' && item.quoteId === quoteId) {
      return { item, vesselId: item.vessel.id };
    }
    if (item.kind === 'split') {
      const child = item.children.find((c) => c.quoteId === quoteId);
      if (child) return { item, vesselId: item.vessel.id };
    }
  }
  return null;
}

export type CreatePOContentProps = {
  embedded?: boolean;
};

export function CreatePOContent({ embedded = false }: CreatePOContentProps = {}) {
  
  const { ready, markSuccess } = usePageBootstrap();
  const hub = usePurchaseOrdersHubOptional();

const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkQuoteId = searchParams.get('quoteId')?.trim() || '';
  const fromNotification = searchParams.get('from') === 'notification';
  const revisionMode = searchParams.get('revision') === '1';
  const deepLinkChildRequisitionId = searchParams.get('childRequisitionId')?.trim() || '';
  
  // Use optimized hooks for static data with caching
  const { data: vessels = [], isLoading: vesselsLoading } = useVessels({ limit: 100, isActive: true });
  
  const [loading, setLoading] = useState(true);
  const [selectedVesselId, setSelectedVesselId] = useState<string>('');
  const [pendingItems, setPendingItems] = useState<PendingPOItem[]>([]);
  const [filteredPendingItems, setFilteredPendingItems] = useState<PendingPOItem[]>([]);
  const [selectedItemKey, setSelectedItemKey] = useState<string>('');
  const [ccEmails, setCcEmails] = useState('');
  const [includeUserEmailInCc, setIncludeUserEmailInCc] = useState(true); // kept for API compat; server always CCs sender
  const [userRemarks, setUserRemarks] = useState('');
  const [vendorRemarks, setVendorRemarks] = useState('');
  const [conditions, setConditions] = useState('');
  const [leadTime, setLeadTime] = useState('');
  const [portOfDelivery, setPortOfDelivery] = useState('');
  const [agentDetails, setAgentDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingChildId, setSendingChildId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ email: string; designationAccessLevel?: number } | null>(null);
  
  // Standalone PO states
  const [poCreationMode, setPoCreationMode] = useState<'requisition' | 'standalone'>('requisition');
  const [vendors, setVendors] = useState<Array<{ id: string; name: string; primaryEmail: string; phone?: string; address?: string }>>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [manualVendorName, setManualVendorName] = useState('');
  const [manualVendorEmail, setManualVendorEmail] = useState('');
  const [manualVendorPhone, setManualVendorPhone] = useState('');
  const [manualVendorAddress, setManualVendorAddress] = useState('');
  const [useManualVendor, setUseManualVendor] = useState(false);
  const [standaloneOrderDetails, setStandaloneOrderDetails] = useState('');
  const [standaloneCreatedDate, setStandaloneCreatedDate] = useState(new Date().toISOString().split('T')[0]);
  const [standaloneAmount, setStandaloneAmount] = useState('');
  const [standaloneCurrency, setStandaloneCurrency] = useState('USD');
  const [standalonePort, setStandalonePort] = useState('');
  const [standaloneAgentDetails, setStandaloneAgentDetails] = useState('');
  const [standaloneVesselId, setStandaloneVesselId] = useState<string>('');
  const [previewPONumber, setPreviewPONumber] = useState<string | null>(null);
  const [loadingPONumber, setLoadingPONumber] = useState(false);
  const [standaloneQuoteId, setStandaloneQuoteId] = useState<string | null>(null);
  const [quoteAttachmentFile, setQuoteAttachmentFile] = useState<File | null>(null);
  const [quoteNumber, setQuoteNumber] = useState('');
  const [quoteValidUntil, setQuoteValidUntil] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [poFieldHighlight, setPoFieldHighlight] = useState<Record<string, boolean>>({});
  const accessDeniedRedirectRef = useRef(false);
  const deepLinkAppliedRef = useRef(false);

  const applyDeepLinkSelection = useCallback(
    (items: PendingPOItem[]) => {
      if (!deepLinkQuoteId || deepLinkAppliedRef.current) return false;

      const match = findPendingItemByQuoteId(items, deepLinkQuoteId);
      if (!match) return false;

      deepLinkAppliedRef.current = true;
      setSelectedVesselId(match.vesselId);
      setFilteredPendingItems(items.filter((q) => q.vessel.id === match.vesselId));
      setSelectedItemKey(pendingItemKey(match.item));
      return true;
    },
    [deepLinkQuoteId]
  );

  useEffect(() => {
    if (!vesselsLoading) {
      // Stop the initial page loader once vessels are loaded
      // The page can render while other data loads in the background
      markSuccess();
      
      // Fetch other data in parallel
      fetchCurrentUser();
      fetchConfirmedQuotes();
      fetchVendors();
      setLoading(false);
    }
  }, [vesselsLoading, markSuccess]);

  // Generate PO number preview instantly on client side, then verify with server
  useEffect(() => {
    if (poCreationMode === 'standalone' && standaloneVesselId && standaloneVesselId !== 'all' && vessels.length > 0) {
      generateInstantPONumberPreview();
      // Also fetch from server in background to verify
      fetchPreviewPONumber();
    } else {
      setPreviewPONumber(null);
    }
  }, [standaloneVesselId, poCreationMode, vessels]);

  useEffect(() => {
    if (deepLinkQuoteId && pendingItems.length > 0) {
      applyDeepLinkSelection(pendingItems);
      return;
    }

    if (selectedVesselId && selectedVesselId !== '') {
      setFilteredPendingItems(pendingItems.filter((q) => q.vessel.id === selectedVesselId));
    } else {
      setFilteredPendingItems([]);
    }

    if (!deepLinkQuoteId) {
      setSelectedItemKey('');
    }
  }, [selectedVesselId, pendingItems, deepLinkQuoteId, applyDeepLinkSelection]);

  useEffect(() => {
    if (!embedded || !hub) return;
    const ids = hub.filters.vesselIds;
    if (ids.length === 1) setSelectedVesselId(ids[0]!);
    else if (ids.length === 0) setSelectedVesselId('');
  }, [embedded, hub, hub?.filters.vesselIds.join(',')]);

  // Generate PO number preview instantly using client-side calculation
  const generateInstantPONumberPreview = () => {
    if (!standaloneVesselId || standaloneVesselId === 'all') {
      setPreviewPONumber(null);
      return;
    }

    const vessel = vessels.find(v => v.id === standaloneVesselId);
    if (!vessel || !vessel.code) {
      setPreviewPONumber(null);
      return;
    }

    // Generate preview instantly
    const vesselCode = vessel.code.toUpperCase().substring(0, 4).padEnd(4, 'X');
    const currentYear = new Date().getFullYear().toString().slice(-2);
    const typeCode = 'OTR'; // Default for standalone
    
    // Show preview immediately (will be verified/updated by server)
    const previewNumber = `${vesselCode}.${currentYear}.${typeCode}.0001`;
    setPreviewPONumber(previewNumber);
  };

  const fetchPreviewPONumber = async () => {
    if (!standaloneVesselId || standaloneVesselId === 'all') {
      return;
    }

    try {
      // Don't show loading state - we already have instant preview
      const response = await fetch(`/api/purchase-orders/preview-po-number?vesselId=${standaloneVesselId}&requisitionType=OTR`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        // Update with actual server-generated number
        setPreviewPONumber(data.poNumber);
      }
    } catch (error) {
      console.error('Error fetching PO number preview:', error);
      // Keep the instant preview if server call fails
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await fetch('/api/vendors', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setVendors(data.vendors || []);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        const user = data.user || data;
        setCurrentUser(user);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const redirectAccessDenied = (message?: string) => {
    if (accessDeniedRedirectRef.current) return;
    accessDeniedRedirectRef.current = true;
    if (deepLinkQuoteId) {
      toast.info('Opening purchase order status…');
      router.replace(
        quoteSendPoPath(deepLinkQuoteId, {
          from: fromNotification ? 'notification' : undefined,
          childRequisitionId: deepLinkChildRequisitionId || undefined,
        })
      );
      return;
    }
    toast.error(message || 'You do not have permission to access this page');
    router.push(fromNotification ? '/notifications' : '/purchase/view-requisitions');
  };

  const fetchConfirmedQuotes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (deepLinkQuoteId) {
        params.set('quoteId', deepLinkQuoteId);
        if (deepLinkChildRequisitionId) {
          params.set('childRequisitionId', deepLinkChildRequisitionId);
        }
        if (revisionMode) {
          params.set('revision', '1');
        }
      }
      const apiUrl = params.toString()
        ? `/api/purchase-orders/confirmed-quotes?${params.toString()}`
        : '/api/purchase-orders/confirmed-quotes';

      const response = await fetch(apiUrl, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 403) {
          redirectAccessDenied();
          return;
        }
        throw new Error('Failed to fetch confirmed quotes');
      }

      const data = await response.json();

      if (typeof data.deepLink?.redirectPath === 'string' && data.deepLink.redirectPath.length > 0) {
        if (revisionMode) {
          if (data.pendingItems?.length) {
            clearPoNavBounce(deepLinkQuoteId);
          } else {
            toast.error(
              'This purchase order cannot be revised from here. Contact support if the rejected PO still appears.'
            );
          }
          return;
        }
        if (deepLinkQuoteId && recordPoNavBounce(deepLinkQuoteId)) {
          toast.error(
            'Could not open the send page automatically. The purchase order may need to be recreated from this screen.'
          );
          return;
        }
        toast.info('Purchase Order already exists — opening send page.');
        router.replace(data.deepLink.redirectPath);
        return;
      }

      if (deepLinkQuoteId) {
        clearPoNavBounce(deepLinkQuoteId);
      }

      const items: PendingPOItem[] = data.pendingItems || data.confirmedQuotes || [];
      setPendingItems(items);

      if (deepLinkQuoteId) {
        const applied = applyDeepLinkSelection(items);
        if (!applied && data.deepLink?.found === false) {
          toast.error('This quote is no longer awaiting PO creation. It may already be processed.');
        }
      } else if (selectedVesselId) {
        setFilteredPendingItems(items.filter((q) => q.vessel.id === selectedVesselId));
      }
    } catch (error: any) {
      console.error('Error fetching confirmed quotes:', error);
      toast.error(error.message || 'Failed to fetch confirmed quotes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStandaloneQuote = async () => {
    const h: Record<string, boolean> = {};
    if (!standaloneVesselId || standaloneVesselId === 'all') h.standaloneVessel = true;
    if (!standaloneOrderDetails.trim()) h.orderDetails = true;
    if (!standaloneAmount.trim()) h.amount = true;
    if (!useManualVendor && !selectedVendorId) h.vendorSelect = true;
    if (useManualVendor && !manualVendorName.trim()) h.manualVendorName = true;
    if (useManualVendor && !manualVendorEmail.trim()) h.manualVendorEmail = true;

    if (!standaloneVesselId || standaloneVesselId === 'all') {
      setPoFieldHighlight((prev) => ({ ...prev, ...h }));
      toast.error('Please select a vessel');
      return;
    }
    if (!standaloneOrderDetails.trim()) {
      setPoFieldHighlight((prev) => ({ ...prev, ...h }));
      toast.error('Please enter order details');
      return;
    }
    if (!standaloneAmount.trim()) {
      setPoFieldHighlight((prev) => ({ ...prev, ...h }));
      toast.error('Please enter amount');
      return;
    }
    if (!useManualVendor && !selectedVendorId) {
      setPoFieldHighlight((prev) => ({ ...prev, ...h }));
      toast.error('Please select a vendor or enter manual vendor details');
      return;
    }
    if (useManualVendor && (!manualVendorName.trim() || !manualVendorEmail.trim())) {
      setPoFieldHighlight((prev) => ({ ...prev, ...h }));
      toast.error('Please enter vendor name and email');
      return;
    }

    setPoFieldHighlight((prev) => {
      const n = { ...prev };
      ['standaloneVessel', 'orderDetails', 'amount', 'vendorSelect', 'manualVendorName', 'manualVendorEmail'].forEach((k) => {
        delete n[k];
      });
      return n;
    });

    try {
      setCreatingQuote(true);
      console.log('🔵 [FRONTEND] Creating Standalone Quote...');

      const formData = new FormData();
      formData.append('vesselId', standaloneVesselId);
      formData.append('orderDetails', standaloneOrderDetails.trim());
      formData.append('totalAmount', standaloneAmount);
      formData.append('currency', standaloneCurrency);
      
      if (useManualVendor) {
        formData.append('manualVendorName', manualVendorName.trim());
        formData.append('manualVendorEmail', manualVendorEmail.trim());
        if (manualVendorPhone.trim()) formData.append('manualVendorPhone', manualVendorPhone.trim());
        if (manualVendorAddress.trim()) formData.append('manualVendorAddress', manualVendorAddress.trim());
      } else {
        formData.append('vendorId', selectedVendorId);
      }
      
      if (quoteNumber.trim()) formData.append('quoteNumber', quoteNumber.trim());
      if (quoteValidUntil) formData.append('validUntil', quoteValidUntil);
      if (quoteNotes.trim()) formData.append('notes', quoteNotes.trim());
      if (quoteAttachmentFile) formData.append('attachmentFile', quoteAttachmentFile);

      const response = await fetch('/api/quotes/create-standalone', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to create quote');
        return;
      }

      toast.success('Quote created successfully', {
        description: `Quote Number: ${data.quote.quoteNumber || 'N/A'}`,
        duration: 5000,
      });

      setStandaloneQuoteId(data.quote.id);
      setPoFieldHighlight((prev) => ({ ...prev, needStandaloneQuote: false }));
    } catch (err: any) {
      console.error('❌ [FRONTEND] Error creating quote:', err);
      toast.error(err.message || 'Failed to create quote', { duration: 5000 });
    } finally {
      setCreatingQuote(false);
    }
  };

  const handleCreatePO = async () => {
    if (poCreationMode === 'requisition') {
      if (!selectedItemKey) {
        setPoFieldHighlight((prev) => ({ ...prev, selectedQuote: true }));
        toast.error('Please select a quote or split requisition to issue PO(s)');
        return;
      }
      setPoFieldHighlight((prev) => ({ ...prev, selectedQuote: false }));

      const selectedSplit = filteredPendingItems.find(
        (item): item is PendingSplitGroup =>
          item.kind === 'split' && pendingItemKey(item) === selectedItemKey
      );
      const selectedSingle = filteredPendingItems.find(
        (item): item is PendingSingleQuote =>
          item.kind === 'single' && pendingItemKey(item) === selectedItemKey
      );

      try {
        setSending(true);

        if (selectedSplit) {
          console.log('🔵 [FRONTEND] Issuing split POs for', selectedSplit.parentRequisitionNumber);
          const response = await fetch(
            `/api/requisitions/${selectedSplit.parentRequisitionId}/split-and-confirm`,
            {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                allocations: [],
                ...buildSplitPoEmailPayload(),
              }),
            }
          );
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Failed to create split POs');
          }
          toast.success(data.message || 'Split POs created successfully', {
            description: data.purchaseOrders?.map((p: { poNumber: string }) => p.poNumber).join(', '),
            duration: 6000,
          });
          setSelectedItemKey('');
          await fetchConfirmedQuotes();
          return;
        }

        if (!selectedSingle) {
          toast.error('Selected item not found');
          return;
        }

        console.log('🔵 [FRONTEND] Creating Purchase Order from Requisition...');

        const response = await fetch('/api/purchase-orders/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            quoteId: selectedSingle.quoteId,
            ccEmails: ccEmails.trim() || undefined,
            includeUserEmailInCc,
            userRemarks: userRemarks.trim() || undefined,
            vendorRemarks: vendorRemarks.trim() || undefined,
            conditions: conditions.trim() || undefined,
            leadTime: leadTime.trim() || undefined,
            portOfDelivery: portOfDelivery.trim() || undefined,
            agentDetails: agentDetails.trim() || undefined,
            revision: revisionMode || undefined,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          const errorMessage = data.error || 'Failed to create Purchase Order';
          const errorDetails = data.details || {};
          const errorStep = data.step || 'Unknown';

          console.error('❌ [FRONTEND] Purchase Order creation failed:', {
            status: response.status,
            error: errorMessage,
            step: errorStep,
            details: errorDetails,
          });

          let userMessage = errorMessage;
          if (errorStep && errorStep !== 'Unknown') {
            userMessage += ` (Error at: ${errorStep})`;
          }
          if (errorDetails.message) {
            userMessage += ` - ${errorDetails.message}`;
          }

          if (
            /already exists/i.test(errorMessage) &&
            (data.poId || selectedSingle.quoteId)
          ) {
            toast.info('Purchase order already exists — opening status page.');
            router.push(
              quoteSendPoPath(data.quoteId || selectedSingle.quoteId, {
                from: fromNotification ? 'notification' : undefined,
                childRequisitionId: deepLinkChildRequisitionId || undefined,
              })
            );
            return;
          }

          toast.error(userMessage, { duration: 5000 });
          throw new Error(data.message || errorMessage);
        }

        console.log('✅ [FRONTEND] Purchase Order created successfully:', data);
        const desc = data.readyToSend
          ? `PO ${data.poNumber} — ready to send to vendor`
          : `PO ${data.poNumber} — submitted for tier approval`;
        toast.success(data.message || 'Purchase Order created', {
          description: desc,
          duration: 6000,
        });

        if (data.quoteId) {
          const sendPath = quoteSendPoPath(data.quoteId, {
            from: fromNotification ? 'notification' : undefined,
            childRequisitionId: deepLinkChildRequisitionId || undefined,
          });
          router.push(sendPath);
          return;
        }

        setSelectedItemKey('');
        setSelectedVesselId('');
        setCcEmails('');
        setUserRemarks('');
        setVendorRemarks('');
        setConditions('');
        setLeadTime('');
        setPortOfDelivery('');
        setAgentDetails('');

        // Refresh quotes
        await fetchConfirmedQuotes();
      } catch (err: any) {
        console.error('❌ [FRONTEND] Error creating Purchase Order:', err);
        toast.error(err.message || 'Failed to create Purchase Order', { duration: 5000 });
      } finally {
        setSending(false);
      }
    } else {
      // Standalone PO creation - requires quote to be created first
      if (!standaloneQuoteId) {
        setPoFieldHighlight((prev) => ({ ...prev, needStandaloneQuote: true }));
        toast.error('Please create a quote first before creating the Purchase Order');
        return;
      }
      setPoFieldHighlight((prev) => ({ ...prev, needStandaloneQuote: false }));

      try {
        setSending(true);
        console.log('🔵 [FRONTEND] Creating Standalone Purchase Order...');

        const response = await fetch('/api/purchase-orders/create-standalone', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            quoteId: standaloneQuoteId,
            createdDate: standaloneCreatedDate,
            ccEmails: ccEmails.trim() || undefined,
            includeUserEmailInCc,
            userRemarks: userRemarks.trim() || undefined,
            vendorRemarks: vendorRemarks.trim() || undefined,
            conditions: conditions.trim() || undefined,
            leadTime: leadTime.trim() || undefined,
            portOfDelivery: portOfDelivery.trim() || undefined,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          toast.error(data.error || 'Failed to create Purchase Order');
          return;
        }

        const desc = data.readyToSend
          ? `PO ${data.poNumber} — ready to send to vendor`
          : `PO ${data.poNumber} — submitted for tier approval`;
        toast.success(data.message || 'Purchase Order created', {
          description: desc,
          duration: 6000,
        });

        if (data.quoteId) {
          router.push(quoteSendPoPath(data.quoteId));
          return;
        }

        setSelectedItemKey('');
        await fetchConfirmedQuotes();
      } catch (err: any) {
        console.error('❌ [FRONTEND] Error creating Standalone Purchase Order:', err);
        toast.error(err.message || 'Failed to create Purchase Order', { duration: 5000 });
      } finally {
        setSending(false);
      }
    }
  };

  const buildSplitPoEmailPayload = () => ({
    ccEmails: ccEmails.trim() || undefined,
    includeUserEmailInCc,
    userRemarks: userRemarks.trim() || undefined,
    vendorRemarks: vendorRemarks.trim() || undefined,
    conditions: conditions.trim() || undefined,
    leadTime: leadTime.trim() || undefined,
    portOfDelivery: portOfDelivery.trim() || undefined,
    agentDetails: agentDetails.trim() || undefined,
  });

  const handleSplitChildPO = async (
    child: SplitChildPending,
    parentRequisitionId: string,
    resend: boolean
  ) => {
    const actionKey = `${child.childRequisitionId}:${child.quoteId}`;
    try {
      setSendingChildId(actionKey);
      const response = await fetch(
        `/api/requisitions/${parentRequisitionId}/split-issue-po`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quoteId: child.quoteId,
            childRequisitionId: child.childRequisitionId,
            resend,
            ...buildSplitPoEmailPayload(),
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create split PO');
      }
      toast.success(
        data.message ||
          (resend
            ? `PO email resent to ${child.vendorName}`
            : data.readyToSend
              ? `PO created — ready to send to vendor`
              : `PO created — submitted for tier approval`),
        {
          description: resend ? child.vendorEmail : data.purchaseOrder?.poNumber,
          duration: 5000,
        }
      );
      await fetchConfirmedQuotes();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create split PO';
      toast.error(message, { duration: 5000 });
    } finally {
      setSendingChildId(null);
    }
  };

  const handleDownloadSplitChildPO = async (poId: string, poNumber: string) => {
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/pdf`, { credentials: 'include' });
      if (!res.ok) {
        toast.error('Failed to open purchase order');
        return;
      }
      const data = await res.json();
      if (data.signedUrl) {
        window.open(data.signedUrl, '_blank');
        toast.success(`PO ${poNumber} opened in new tab`);
      } else {
        toast.error('PDF not available');
      }
    } catch {
      toast.error('Failed to open purchase order');
    }
  };

  const selectedSingleQuote = filteredPendingItems.find(
    (item): item is PendingSingleQuote =>
      item.kind === 'single' && pendingItemKey(item) === selectedItemKey
  );
  const selectedSplitGroup = filteredPendingItems.find(
    (item): item is PendingSplitGroup =>
      item.kind === 'split' && pendingItemKey(item) === selectedItemKey
  );
  const hasSelection = Boolean(selectedSingleQuote || selectedSplitGroup);
  const requiresMultiTierApproval = Boolean(
    selectedSingleQuote &&
      (selectedSingleQuote.requiresApproval ??
        (selectedSingleQuote.quote.totalAmount ?? 0) >= PO_TIER_APPROVAL_THRESHOLD)
  );
  const requiresThreePoApprovals = Boolean(
    selectedSingleQuote &&
      (selectedSingleQuote.requiresThreeApprovals ??
        (selectedSingleQuote.quote.totalAmount ?? 0) >= 10000)
  );
  const createPreviewSteps = useMemo(() => {
    if (!selectedSingleQuote) return [];
    return buildPoCreatePreviewSteps(
      requiresMultiTierApproval,
      requiresThreePoApprovals,
      selectedSingleQuote.quote.vendor.name
    );
  }, [selectedSingleQuote, requiresMultiTierApproval, requiresThreePoApprovals]);

  return (<PageReadyGate ready={ready}>
    <ProtectedRoute allowedAccessLevels={[32, 33]}>
      <div className="space-y-4">
        <div className="mx-auto w-[95%] max-w-[95vw] overflow-x-auto py-4">
          {!embedded && (
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground">Create Purchase Order</h1>
            <p className="text-foreground mt-2">
              {selectedSplitGroup
                ? 'Create purchase order records for each split child requisition. POs are submitted for tier approval when required — they are not emailed to vendors from this screen.'
                : selectedSingleQuote
                ? 'Create the purchase order record and submit it for L1 approval before it can be sent to the vendor.'
                : 'Create a Purchase Order from an approved quote or create a standalone PO'}
            </p>
          </div>
          )}

          {/* PO mode + vessel filter (one row) */}
          <Card className="mb-6" variant="filter">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <span className="text-sm font-medium text-foreground whitespace-nowrap">
                  PO creation mode
                </span>
                <RadioGroup
                  value={poCreationMode}
                  onValueChange={(value) => setPoCreationMode(value as 'requisition' | 'standalone')}
                  className="flex flex-row flex-wrap items-center gap-x-6 gap-y-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="requisition" id="requisition" />
                    <Label htmlFor="requisition" className="cursor-pointer font-normal whitespace-nowrap">
                      From Requisition
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="standalone" id="standalone" />
                    <Label htmlFor="standalone" className="cursor-pointer font-normal whitespace-nowrap">
                      Create Standalone PO (Without Requisition)
                    </Label>
                  </div>
                </RadioGroup>

                {poCreationMode === 'requisition' && !loading && !embedded ? (
                  <>
                    <div className="hidden sm:block h-5 w-px shrink-0 bg-border" aria-hidden="true" />
                    <Label
                      htmlFor="vessel"
                      className="mb-0 shrink-0 text-sm font-medium text-foreground whitespace-nowrap"
                    >
                      Select Vessel
                    </Label>
                    <FilterFieldShell
                      showClear={Boolean(selectedVesselId)}
                      onClear={() => setSelectedVesselId('')}
                      hasDropdownChevron
                      className="w-full min-w-[12rem] max-w-xs shrink-0 sm:w-auto"
                    >
                      <Select value={selectedVesselId} onValueChange={setSelectedVesselId}>
                        <SelectTrigger
                          id="vessel"
                          width="vessel"
                          className={filterTriggerClearPadding(Boolean(selectedVesselId), true)}
                        >
                          <SelectValue placeholder="All Vessels" />
                        </SelectTrigger>
                        <SelectContent>
                          {vessels.map((vessel) => (
                            <SelectItem key={vessel.id} value={vessel.id}>
                              {vessel.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FilterFieldShell>
                  </>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="flex min-h-[40vh] items-center justify-center py-12">
              <ActiniumLoader size="lg" text="Loading quotes…" />
            </div>
          ) : poCreationMode === 'standalone' ? (
            // Standalone PO Form
            <Card>
              <CardHeader>
                <CardTitle>Create Standalone Purchase Order</CardTitle>
                <CardDescription>Enter the details to create a Purchase Order without a requisition</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="standaloneVessel">Vessel *</Label>
                    <Select
                      value={standaloneVesselId}
                      onValueChange={(v) => {
                        setStandaloneVesselId(v);
                        setPoFieldHighlight((prev) => ({ ...prev, standaloneVessel: false }));
                      }}
                    >
                      <SelectTrigger
                        id="standaloneVessel"
                        className={fieldErrorCn(!!poFieldHighlight.standaloneVessel, "mt-2")}
                        width="vessel"
                        aria-invalid={poFieldHighlight.standaloneVessel || undefined}
                      >
                        <SelectValue placeholder="Select Vessel" />
                      </SelectTrigger>
                      <SelectContent>
                        {vessels.map((vessel) => (
                          <SelectItem key={vessel.id} value={vessel.id}>
                            {vessel.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="standaloneCreatedDate">Created Date *</Label>
                    <Input
                      id="standaloneCreatedDate"
                      type="date"
                      value={standaloneCreatedDate}
                      onChange={(e) => setStandaloneCreatedDate(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                </div>

                {/* PO Number Preview - Instant Display */}
                {standaloneVesselId && standaloneVesselId !== 'all' && (
                  <div>
                    <Label>PO Number (Preview)</Label>
                    <div className="mt-2 p-3 bg-muted border border-border rounded-md">
                      {previewPONumber ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-sm font-semibold">
                            {previewPONumber}
                          </Badge>
                          <span className="text-xs text-muted-foreground">This PO number will be assigned</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Select a vessel to preview PO number</span>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="standaloneOrderDetails">Order Details *</Label>
                  <Textarea
                    id="standaloneOrderDetails"
                    value={standaloneOrderDetails}
                    onChange={(e) => {
                      setStandaloneOrderDetails(e.target.value);
                      setPoFieldHighlight((prev) => ({ ...prev, orderDetails: false }));
                    }}
                    placeholder="Enter order description and details..."
                    rows={4}
                    className={fieldErrorCn(!!poFieldHighlight.orderDetails, "mt-2")}
                    aria-invalid={poFieldHighlight.orderDetails || undefined}
                  />
                </div>

                {/* Quote Information Section */}
                <div className="border-t pt-4 space-y-4">
                  <h3 className="text-lg font-semibold">Quote Information</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="quoteNumber">Quote Number (Optional)</Label>
                      <Input
                        id="quoteNumber"
                        value={quoteNumber}
                        onChange={(e) => setQuoteNumber(e.target.value)}
                        placeholder="Vendor quote number"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="quoteValidUntil">Valid Until (Optional)</Label>
                      <Input
                        id="quoteValidUntil"
                        type="date"
                        value={quoteValidUntil}
                        onChange={(e) => setQuoteValidUntil(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="quoteNotes">Quote Notes (Optional)</Label>
                    <Textarea
                      id="quoteNotes"
                      value={quoteNotes}
                      onChange={(e) => setQuoteNotes(e.target.value)}
                      placeholder="Additional notes about the quote..."
                      rows={2}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="quoteAttachment">Quote Attachment (PDF/Excel from Vendor Email)</Label>
                    <Input
                      id="quoteAttachment"
                      type="file"
                      accept=".pdf,.xlsx,.xls,.doc,.docx"
                      onChange={(e) => setQuoteAttachmentFile(e.target.files?.[0] || null)}
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload the quote document received from vendor. This will be used for invoice comparison.
                    </p>
                    {quoteAttachmentFile && (
                      <div className="mt-2 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">{quoteAttachmentFile.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(quoteAttachmentFile.size / 1024).toFixed(2)} KB)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quote Created Status */}
                {standaloneQuoteId && (
                  <div className="p-4 bg-success border border-border rounded-md">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <div>
                        <p className="font-medium text-success">Quote Created Successfully</p>
                        <p className="text-sm text-success">Quote ID: {standaloneQuoteId}</p>
                        <p className="text-xs text-success mt-1">You can now create the Purchase Order</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="useManualVendor"
                      checked={useManualVendor}
                      onCheckedChange={(checked) => {
                        setUseManualVendor(checked === true);
                        setPoFieldHighlight((prev) => ({
                          ...prev,
                          vendorSelect: false,
                          manualVendorName: false,
                          manualVendorEmail: false,
                        }));
                      }}
                    />
                    <Label htmlFor="useManualVendor" className="cursor-pointer">
                      Enter vendor details manually
                    </Label>
                  </div>

                  {!useManualVendor ? (
                    <div>
                      <Label htmlFor="vendor">Select Vendor *</Label>
                      <Select
                        value={selectedVendorId}
                        onValueChange={(v) => {
                          setSelectedVendorId(v);
                          setPoFieldHighlight((prev) => ({ ...prev, vendorSelect: false }));
                        }}
                      >
                        <SelectTrigger
                          id="vendor"
                          className={fieldErrorCn(!!poFieldHighlight.vendorSelect, "mt-2")}
                          aria-invalid={poFieldHighlight.vendorSelect || undefined}
                        >
                          <SelectValue placeholder="Select Vendor" />
                        </SelectTrigger>
                        <SelectContent>
                          {vendors.map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              {vendor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="manualVendorName">Vendor Name *</Label>
                        <Input
                          id="manualVendorName"
                          value={manualVendorName}
                          onChange={(e) => {
                            setManualVendorName(e.target.value);
                            setPoFieldHighlight((prev) => ({ ...prev, manualVendorName: false }));
                          }}
                          placeholder="Vendor company name"
                          className={fieldErrorCn(!!poFieldHighlight.manualVendorName, "mt-2")}
                          aria-invalid={poFieldHighlight.manualVendorName || undefined}
                        />
                      </div>
                      <div>
                        <Label htmlFor="manualVendorEmail">Vendor Email *</Label>
                        <Input
                          id="manualVendorEmail"
                          type="email"
                          value={manualVendorEmail}
                          onChange={(e) => {
                            setManualVendorEmail(e.target.value);
                            setPoFieldHighlight((prev) => ({ ...prev, manualVendorEmail: false }));
                          }}
                          placeholder="vendor@example.com"
                          className={fieldErrorCn(!!poFieldHighlight.manualVendorEmail, "mt-2")}
                          aria-invalid={poFieldHighlight.manualVendorEmail || undefined}
                        />
                      </div>
                      <div>
                        <Label htmlFor="manualVendorPhone">Vendor Phone</Label>
                        <Input
                          id="manualVendorPhone"
                          value={manualVendorPhone}
                          onChange={(e) => setManualVendorPhone(e.target.value)}
                          placeholder="+1234567890"
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label htmlFor="manualVendorAddress">Vendor Address</Label>
                        <Input
                          id="manualVendorAddress"
                          value={manualVendorAddress}
                          onChange={(e) => setManualVendorAddress(e.target.value)}
                          placeholder="Vendor address"
                          className="mt-2"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="standaloneAmount">Amount Confirmed *</Label>
                    <Input
                      id="standaloneAmount"
                      type="number"
                      step="0.01"
                      value={standaloneAmount}
                      onChange={(e) => {
                        setStandaloneAmount(e.target.value);
                        setPoFieldHighlight((prev) => ({ ...prev, amount: false }));
                      }}
                      placeholder="0.00"
                      className={fieldErrorCn(!!poFieldHighlight.amount, "mt-2")}
                      aria-invalid={poFieldHighlight.amount || undefined}
                    />
                  </div>
                  <div>
                    <Label htmlFor="standaloneCurrency">Currency *</Label>
                    <Select value={standaloneCurrency} onValueChange={setStandaloneCurrency}>
                      <SelectTrigger id="standaloneCurrency" className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                        <SelectItem value="INR">INR</SelectItem>
                        <SelectItem value="SGD">SGD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="standalonePort">Port</Label>
                    <Input
                      id="standalonePort"
                      value={standalonePort}
                      onChange={(e) => setStandalonePort(e.target.value)}
                      placeholder="Port of delivery"
                      className="mt-2"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="standaloneAgentDetails">Agent Details</Label>
                  <Textarea
                    id="standaloneAgentDetails"
                    value={standaloneAgentDetails}
                    onChange={(e) => setStandaloneAgentDetails(e.target.value)}
                    placeholder="Agent name, contact, address..."
                    rows={3}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="standaloneFromEmail">From</Label>
                  <Input id="standaloneFromEmail" value={PO_FROM_EMAIL} disabled className="mt-2" />
                </div>

                <div>
                  <Label htmlFor="standaloneSenderCc">CC — you (required)</Label>
                  <Input
                    id="standaloneSenderCc"
                    value={currentUser?.email ?? ''}
                    disabled
                    placeholder="Your account email"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="ccEmails">Additional CC (comma-separated, optional)</Label>
                  <Input
                    id="ccEmails"
                    value={ccEmails}
                    onChange={(e) => setCcEmails(e.target.value)}
                    placeholder="email1@example.com, email2@example.com"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="userRemarks">User Remarks</Label>
                  <Textarea
                    id="userRemarks"
                    value={userRemarks}
                    onChange={(e) => setUserRemarks(e.target.value)}
                    placeholder="Enter any remarks or instructions..."
                    rows={3}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="conditions">Conditions</Label>
                  <Textarea
                    id="conditions"
                    value={conditions}
                    onChange={(e) => setConditions(e.target.value)}
                    placeholder="Enter terms and conditions..."
                    rows={3}
                    className="mt-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="leadTime">Lead Time</Label>
                    <Input
                      id="leadTime"
                      value={leadTime}
                      onChange={(e) => setLeadTime(e.target.value)}
                      placeholder="e.g., 30 days"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="portOfDelivery">Port of Delivery</Label>
                    <Input
                      id="portOfDelivery"
                      value={portOfDelivery}
                      onChange={(e) => setPortOfDelivery(e.target.value)}
                      placeholder="Port name"
                      className="mt-2"
                    />
                  </div>
                </div>

                <div
                  className={fieldErrorCn(!!poFieldHighlight.needStandaloneQuote, "rounded-lg -mx-1 px-1 py-1")}
                >
                  {!standaloneQuoteId ? (
                    <Button
                      onClick={handleCreateStandaloneQuote}
                      disabled={creatingQuote || !standaloneVesselId || !standaloneOrderDetails.trim() || !standaloneAmount.trim() || (!useManualVendor && !selectedVendorId) || (useManualVendor && (!manualVendorName.trim() || !manualVendorEmail.trim()))}
                      className="w-full"
                      size="lg"
                    >
                      {creatingQuote ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Quote...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Create Quote First
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleCreatePO}
                      disabled={sending}
                      className="w-full"
                      size="lg"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating PO &amp; submitting for approval…
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          Create PO &amp; Send for Approval
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-10">
              {/* Left panel — approved quotes (60%) */}
              <div className="space-y-6 lg:col-span-6">
                <Card className={fieldErrorCn(!!poFieldHighlight.selectedQuote)}>
                  <CardHeader>
                    <CardTitle>Approved quotes awaiting PO</CardTitle>
                    <CardDescription>
                      Select a single quote or a split requisition (one row per main requisition)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {filteredPendingItems.length === 0 ? (
                      <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                        No approved quotes awaiting PO for this vessel
                      </p>
                    ) : (
                      <div className="max-h-[420px] overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10" />
                              <TableHead>Requisition</TableHead>
                              <TableHead>Heading</TableHead>
                              <TableHead>Vessel · Vendor</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredPendingItems.map((item) => {
                              const key = pendingItemKey(item);
                              const isSelected = selectedItemKey === key;
                              const selectRow = () => {
                                setSelectedItemKey(key);
                                setPoFieldHighlight((prev) => ({ ...prev, selectedQuote: false }));
                              };

                              if (item.kind === 'split') {
                                return (
                                  <TableRow
                                    key={key}
                                    className={`cursor-pointer ${isSelected ? 'bg-info/30 hover:bg-info/30' : 'hover:bg-muted/50'}`}
                                    onClick={selectRow}
                                  >
                                    <TableCell className="align-top">
                                      {isSelected ? (
                                        <CheckCircle2 className="h-4 w-4 text-primary" />
                                      ) : null}
                                    </TableCell>
                                    <TableCell className="align-top font-medium">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span>{item.parentRequisitionNumber}</span>
                                        <Badge variant="secondary" className="gap-0.5 text-[10px]">
                                          <GitBranch className="h-3 w-3" />
                                          Split · {item.vendorCount}
                                        </Badge>
                                      </div>
                                      <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                                        {item.pendingPoCount} PO(s) pending
                                        {item.issuedPoCount > 0 ? ` · ${item.issuedPoCount} issued` : ''}
                                      </p>
                                    </TableCell>
                                    <TableCell className="align-top text-sm">{item.heading}</TableCell>
                                    <TableCell className="align-top text-sm text-muted-foreground">
                                      {item.vessel.name}
                                      <span className="mx-1">·</span>
                                      {item.children
                                        .filter((c) => !c.poIssued)
                                        .map((c) => c.vendorName)
                                        .join(' · ')}
                                    </TableCell>
                                    <TableCell className="align-top text-right text-sm font-medium text-success">
                                      {item.currency}{' '}
                                      {item.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </TableCell>
                                  </TableRow>
                                );
                              }

                              return (
                                <TableRow
                                  key={key}
                                  className={`cursor-pointer ${isSelected ? 'bg-info/30 hover:bg-info/30' : 'hover:bg-muted/50'}`}
                                  onClick={selectRow}
                                >
                                  <TableCell className="align-top">
                                    {isSelected ? (
                                      <CheckCircle2 className="h-4 w-4 text-primary" />
                                    ) : null}
                                  </TableCell>
                                  <TableCell className="align-top font-medium">
                                    {item.requisitionNumber}
                                  </TableCell>
                                  <TableCell className="align-top text-sm">{item.heading}</TableCell>
                                  <TableCell className="align-top text-sm text-muted-foreground">
                                    {item.vessel.name} · {item.quote.vendor.name}
                                  </TableCell>
                                  <TableCell className="align-top text-right text-sm font-medium text-success">
                                    {item.quote.currency}{' '}
                                    {item.quote.totalAmount?.toLocaleString() || '0'}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {selectedSingleQuote && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Quote Details</CardTitle>
                      <CardDescription>Review the selected quote information</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Requisition Number</Label>
                          <p className="font-semibold">{selectedSingleQuote.requisitionNumber}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Vessel</Label>
                          <p className="font-semibold">{selectedSingleQuote.vessel.name}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Vendor</Label>
                          <p className="font-semibold">{selectedSingleQuote.quote.vendor.name}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Total Amount</Label>
                          <p className="font-semibold text-success">
                            {selectedSingleQuote.quote.currency}{' '}
                            {selectedSingleQuote.quote.totalAmount?.toLocaleString() || '0'}
                          </p>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground">Items</Label>
                        <div className="mt-2 border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12">S.No.</TableHead>
                                <TableHead>Item Name</TableHead>
                                <TableHead className="w-20">Qty</TableHead>
                                <TableHead className="w-20">Unit</TableHead>
                                <TableHead className="w-24">Unit Price</TableHead>
                                <TableHead className="w-24">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedSingleQuote.quote.quotedItems.map((lineItem, index) => (
                                <TableRow key={lineItem.id}>
                                  <TableCell>{index + 1}</TableCell>
                                  <TableCell className="font-medium">{lineItem.itemName}</TableCell>
                                  <TableCell>{lineItem.quantity}</TableCell>
                                  <TableCell>{lineItem.unit}</TableCell>
                                  <TableCell>
                                    {lineItem.unitPrice ? lineItem.unitPrice.toLocaleString() : 'N/A'}
                                  </TableCell>
                                  <TableCell>
                                    {lineItem.totalPrice ? lineItem.totalPrice.toLocaleString() : 'N/A'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {selectedSplitGroup && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        Split requisition
                        <Badge variant="secondary" className="font-normal">
                          {selectedSplitGroup.parentRequisitionNumber}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        One PO per vendor — child requisitions{' '}
                        {selectedSplitGroup.children.map((c) => c.childRequisitionNumber).join(', ')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Child req</TableHead>
                            <TableHead>Vendor</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>PO status</TableHead>
                            <TableHead className="w-[220px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedSplitGroup.children.map((child) => {
                            const actionKey = `${child.childRequisitionId}:${child.quoteId}`;
                            const isSending = sendingChildId === actionKey;
                            return (
                            <TableRow key={child.childRequisitionId}>
                              <TableCell className="font-mono text-xs">
                                {child.childRequisitionNumber}
                              </TableCell>
                              <TableCell>
                                <div>{child.vendorName}</div>
                                <div className="text-xs text-muted-foreground">{child.vendorEmail}</div>
                              </TableCell>
                              <TableCell className="text-right">
                                {child.currency} {child.totalAmount?.toLocaleString() ?? '—'}
                              </TableCell>
                              <TableCell>
                                {child.poIssued ? (
                                  child.poSentToVendor ? (
                                    <Badge variant="outline" className="text-success">
                                      Sent {child.poNumber}
                                    </Badge>
                                  ) : child.poWorkflowStatus === 'PO_CONFIRMED' ? (
                                    <Badge variant="outline" className="text-info">
                                      Ready to send {child.poNumber}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-warning">
                                      Awaiting approval {child.poNumber}
                                    </Badge>
                                  )
                                ) : (
                                  <Badge variant="outline" className="text-warning">
                                    Pending PO
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap items-center gap-2">
                                  {child.poIssued ? (
                                    <>
                                      {child.poSentToVendor ? (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          disabled={isSending}
                                          onClick={() =>
                                            handleSplitChildPO(
                                              child,
                                              selectedSplitGroup.parentRequisitionId,
                                              true
                                            )
                                          }
                                        >
                                          {isSending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <Mail className="h-4 w-4" />
                                          )}
                                          <span className="ml-1.5">Resend email</span>
                                        </Button>
                                      ) : child.poWorkflowStatus === 'PO_CONFIRMED' ? (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            router.push(quoteSendPoPath(child.quoteId))
                                          }
                                        >
                                          <Send className="h-4 w-4" />
                                          <span className="ml-1.5">Send to vendor</span>
                                        </Button>
                                      ) : null}
                                      {child.poId ? (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          onClick={() =>
                                            handleDownloadSplitChildPO(child.poId!, child.poNumber!)
                                          }
                                        >
                                          <Download className="h-4 w-4" />
                                          <span className="ml-1.5">PDF</span>
                                        </Button>
                                      ) : null}
                                    </>
                                  ) : (
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={isSending}
                                      onClick={() =>
                                        handleSplitChildPO(
                                          child,
                                          selectedSplitGroup.parentRequisitionId,
                                          false
                                        )
                                      }
                                    >
                                      {isSending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <ShieldCheck className="h-4 w-4" />
                                      )}
                                      <span className="ml-1.5">Create PO &amp; Send for Approval</span>
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right panel — PO form (40%) */}
              <div className="space-y-6 lg:col-span-4">
                {hasSelection ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Purchase Order Details</CardTitle>
                      <CardDescription>
                        {selectedSplitGroup
                          ? `Create ${selectedSplitGroup.pendingPoCount} PO record(s) for split requisition ${selectedSplitGroup.parentRequisitionNumber}. POs are submitted for tier approval when required — they are not emailed to vendors from this screen.`
                          : selectedSingleQuote
                            ? 'Enter PO document details. The PO will be submitted for L1 approval — it will not be emailed to the vendor yet.'
                            : 'Select a quote to create a purchase order. POs are submitted for approval before they can be sent to vendors.'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedSingleQuote && createPreviewSteps.length > 0 ? (
                        <PurchaseApprovalMatrix
                          steps={createPreviewSteps}
                          variant="compact"
                          title="PO workflow"
                        />
                      ) : null}

                      {selectedSingleQuote ? (
                        <Alert variant="info">
                          <ShieldCheck className="h-4 w-4" />
                          <AlertTitle>Approval required before send</AlertTitle>
                          <AlertDescription>
                            Creating the PO submits it for L1 approval. It will not be emailed to the
                            vendor until approval is complete
                            {requiresMultiTierApproval
                              ? requiresThreePoApprovals
                                ? ' (L1, L2, and L3 tiers).'
                                : ' (L1 and L2 tiers).'
                              : '.'}
                          </AlertDescription>
                        </Alert>
                      ) : null}

                      <div>
                        <Label htmlFor="userRemarks">User Remarks</Label>
                        <Textarea
                          id="userRemarks"
                          value={userRemarks}
                          onChange={(e) => setUserRemarks(e.target.value)}
                          placeholder="Enter any remarks or instructions..."
                          rows={3}
                          className="mt-2"
                        />
                      </div>

                      <div>
                        <Label htmlFor="vendorRemarks">Vendor Remarks</Label>
                        <Textarea
                          id="vendorRemarks"
                          value={vendorRemarks}
                          onChange={(e) => setVendorRemarks(e.target.value)}
                          placeholder="Vendor remarks from quote..."
                          rows={3}
                          className="mt-2"
                        />
                      </div>

                      <div>
                        <Label htmlFor="conditions">Conditions</Label>
                        <Textarea
                          id="conditions"
                          value={conditions}
                          onChange={(e) => setConditions(e.target.value)}
                          placeholder="Enter terms and conditions..."
                          rows={3}
                          className="mt-2"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="leadTime">Lead Time</Label>
                          <Input
                            id="leadTime"
                            value={leadTime}
                            onChange={(e) => setLeadTime(e.target.value)}
                            placeholder="e.g., 30 days"
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <Label htmlFor="portOfDelivery">Port of Delivery</Label>
                          <Input
                            id="portOfDelivery"
                            value={portOfDelivery}
                            onChange={(e) => setPortOfDelivery(e.target.value)}
                            placeholder="Port name"
                            className="mt-2"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="agentDetails">Agent Details</Label>
                        <Textarea
                          id="agentDetails"
                          value={agentDetails}
                          onChange={(e) => setAgentDetails(e.target.value)}
                          placeholder="Agent name, contact, address..."
                          rows={2}
                          className="mt-2"
                        />
                      </div>

                      <Button
                        onClick={handleCreatePO}
                        disabled={sending}
                        className="w-full"
                        size="lg"
                      >
                        {sending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {selectedSplitGroup
                              ? 'Creating split POs…'
                              : 'Creating PO & submitting for approval…'}
                          </>
                        ) : selectedSplitGroup ? (
                          <>
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            {`Create split POs & Send for Approval (${selectedSplitGroup.pendingPoCount} vendor${selectedSplitGroup.pendingPoCount !== 1 ? 's' : ''})`}
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            Create PO &amp; Send for Approval
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">Select an approved quote or split requisition from the left panel</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
        </PageReadyGate>
  );
}

