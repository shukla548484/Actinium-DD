"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MultiSelectDropdown } from "@/components/ui/multi-select-dropdown";
import ActiniumLoader from "@/components/ActiniumLoader";
import { CheckCircle, Clock, Mail, MapPin, User, ArrowLeft, Send, Package, Ship, Calendar, Download } from "lucide-react";
import { Vendor, QuoteStatus, QUOTE_STATUS_LABELS, getQuoteStatusColor } from "@/lib/types/vendor";
import { TablePagination } from "@/components/ui/table-pagination";
import { TableSerialHead, TableSerialCell } from "@/components/ui/table-serial-column";

interface VendorWithQuoteInfo extends Vendor {
  hasExistingQuote: boolean;
  lastQuoteStatus?: QuoteStatus;
  lastQuoteSentAt?: Date;
}

interface RequisitionInfo {
  id: string;
  heading: string;
  status: string;
  portOfSupply?: string;
  requisitionNumber?: string;
  dateOfCreation?: string;
  vessel?: {
    name: string;
    code: string;
  };
  createdBy?: {
    firstName: string;
    lastName: string;
    designation?: string;
  };
}

const ITEMS_PER_PAGE = 15;

export default function SendQuoteRequestPage() {
  const params = useParams();
  const router = useRouter();
  const requisitionId = params.id as string;
  const { ready, markSuccess } = usePageBootstrap();

  const [vendors, setVendors] = useState<VendorWithQuoteInfo[]>([]);
  const [allVendors, setAllVendors] = useState<VendorWithQuoteInfo[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [requisition, setRequisition] = useState<RequisitionInfo | null>(null);
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [validUntilDays, setValidUntilDays] = useState(30);
  const [customMessage, setCustomMessage] = useState("");
  const [portOfSupply, setPortOfSupply] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedVendorSearchIds, setSelectedVendorSearchIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [emailSuccessPopup, setEmailSuccessPopup] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const [ccEmails, setCcEmails] = useState("");
  const [bccEmails, setBccEmails] = useState("");
  const [includeUserEmailInCc, setIncludeUserEmailInCc] = useState(true);

  useEffect(() => {
    if (!sending) return;
    const warnOnLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnOnLeave);
    return () => window.removeEventListener("beforeunload", warnOnLeave);
  }, [sending]);

  useEffect(() => {
    if (!emailSuccessPopup) return;
    const timer = window.setTimeout(() => {
      setEmailSuccessPopup(null);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [emailSuccessPopup]);

  // Fetch current user from session
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          // API returns { user: {...} }
          if (data.user && data.user.id) {
            setCurrentUser({ 
              id: data.user.id,
              email: data.user.email || undefined
            });
          } else {
            console.warn('User session not found in response');
            setError('User session not found. Please refresh the page and try again.');
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to fetch user:', errorData);
          setError('User session not found. Please refresh the page and try again.');
        }
      } catch (error) {
        console.error('Error fetching current user:', error);
        setError('User session not found. Please refresh the page and try again.');
      }
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [searchTerm, selectedCountries]);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (selectedCountries.length > 0) {
        selectedCountries.forEach(country => {
          if (country !== "__empty__") {
            params.append("country", country);
          }
        });
      }

      const response = await fetch(`/api/requisitions/${requisitionId}/send-quote?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch vendors');
      }

      setAllVendors(data.vendors);
      setVendors(data.vendors);
      setCountries(data.countries);
      setRequisition(data.requisition);
      // Set initial port of supply from requisition
      if (data.requisition?.portOfSupply) {
        setPortOfSupply(data.requisition.portOfSupply);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch vendors');
    } finally {
      setLoading(false);
      markSuccess(); // Stop the page loader when data is loaded
    }
  };

  // Filter vendors based on multi-select search
  const filteredVendors = useMemo(() => {
    let filtered = allVendors;

    // Filter by selected vendor IDs from multi-select
    if (selectedVendorSearchIds.length > 0) {
      filtered = filtered.filter(vendor => selectedVendorSearchIds.includes(vendor.id));
    }

    // Filter by selected countries
    if (selectedCountries.length > 0 && !selectedCountries.includes("__empty__")) {
      filtered = filtered.filter(vendor => selectedCountries.includes(vendor.country));
    }

    return filtered;
  }, [allVendors, selectedVendorSearchIds, selectedCountries]);

  const paginatedVendors = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredVendors.slice(startIndex, endIndex);
  }, [filteredVendors, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedVendorSearchIds, selectedCountries]);

  // Vendor options for multi-select
  const vendorOptions = useMemo(() => {
    return allVendors.map(vendor => ({
      value: vendor.id,
      label: vendor.name,
      description: `${vendor.email} • ${vendor.city ? `${vendor.city}, ` : ''}${vendor.country}`
    }));
  }, [allVendors]);

  // Country options for multi-select
  const countryOptions = useMemo(() => {
    return [
      { value: "__empty__", label: "All Countries" },
      ...countries.map(country => ({
        value: country,
        label: country
      }))
    ];
  }, [countries]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedVendorIds(paginatedVendors.map(vendor => vendor.id));
    } else {
      // Only deselect vendors on current page
      const pageVendorIds = paginatedVendors.map(v => v.id);
      setSelectedVendorIds(prev => prev.filter(id => !pageVendorIds.includes(id)));
    }
  };

  const handleSelectVendor = (vendorId: string, checked: boolean) => {
    if (checked) {
      setSelectedVendorIds(prev => [...prev, vendorId]);
    } else {
      setSelectedVendorIds(prev => prev.filter(id => id !== vendorId));
    }
  };

  const handleDownloadTemplate = async () => {
    if (!portOfSupply.trim()) {
      setError("Port of Supply is required before downloading the template");
      return;
    }

    if (!requisition) {
      setError("Requisition data is not loaded");
      return;
    }

    if (!requisition.vessel) {
      setError("Vessel information is missing");
      return;
    }

    try {
      setDownloading(true);
      setError(null);

      const params = new URLSearchParams({
        portOfSupply: portOfSupply.trim(),
      });

      const response = await fetch(`/api/requisitions/${requisitionId}/download-quote-template?${params}`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details?.join(", ") || "Failed to download template");
      }

      // Get the blob and create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Quote_Request_Template_${requisition.requisitionNumber || requisitionId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess("Template downloaded successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download template");
    } finally {
      setDownloading(false);
    }
  };

  const handleSendQuotes = async () => {
    if (selectedVendorIds.length === 0) {
      setError("Please select at least one vendor");
      return;
    }

    if (!portOfSupply.trim()) {
      setError("Port of Supply is required");
      return;
    }

    if (!currentUser?.id) {
      setError("User session not found. Please refresh the page and try again.");
      return;
    }

    try {
      setSending(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/requisitions/${requisitionId}/send-quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          vendorIds: selectedVendorIds,
          validUntilDays,
          customMessage: customMessage.trim() || undefined,
          portOfSupply: portOfSupply.trim() || undefined,
          sentById: currentUser.id,
          cc: ccEmails.trim() || undefined,
          bcc: bccEmails.trim() || undefined,
          includeUserEmailInCc: includeUserEmailInCc,
        }),
      });

      const data = await response.json();

      if (!response.ok && response.status !== 207) {
        // 207 is Multi-Status (partial success) - handle it separately
        const errorMsg = data.error || data.details || 'Failed to send quote requests';
        throw new Error(errorMsg);
      }

      // Show success message with email results if available
      let successMessage = data.message || `Quote requests sent to ${selectedVendorIds.length} vendor${selectedVendorIds.length > 1 ? 's' : ''}`;
      let showEmailSuccessPopup = false;
      
      if (data.emailResults) {
        const { success, failed, errors, allFailed } = data.emailResults;
        if (allFailed || (failed > 0 && success === 0)) {
          // All emails failed - show as error
          const errorDetails = errors.map((e: any) => `${e.vendor}: ${e.error}`).join('; ');
          const errorMsg = `All ${failed} email${failed > 1 ? 's' : ''} failed to send. ${data.warning || ''}\n\nErrors:\n${errorDetails}`;
          setError(errorMsg);
          console.error('❌ All emails failed to send:', {
            errors: errors,
            warning: data.warning,
          });
        } else if (failed > 0) {
          // Some emails failed - show as warning
          const errorDetails = errors.map((e: any) => `${e.vendor}: ${e.error}`).join('; ');
          successMessage += `\n\nEmail Status: ${success} sent, ${failed} failed.\nErrors: ${errorDetails}`;
          setError(`Quote requests created, but ${failed} email${failed > 1 ? 's' : ''} failed to send. ${success} email${success > 1 ? 's' : ''} sent successfully.`);
        } else {
          showEmailSuccessPopup = true;
        }
      } else {
        showEmailSuccessPopup = true;
      }

      if (showEmailSuccessPopup) {
        setSuccess(successMessage);
        setEmailSuccessPopup(successMessage);
      }
      
      setSelectedVendorIds([]);
      
      // Refresh vendors to show updated quote status
      await fetchVendors();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send quote requests');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Check if all vendors on current page are selected
  const allPageVendorsSelected = paginatedVendors.length > 0 && 
    paginatedVendors.every(vendor => selectedVendorIds.includes(vendor.id));
  return (<PageReadyGate ready={ready}>
    <div className="space-y-4">
      {emailSuccessPopup && (
        <div
          className="fixed inset-x-0 top-6 z-[60] flex justify-center px-4"
          role="status"
          aria-live="polite"
        >
          <div className="flex max-w-xl items-start gap-3 rounded-lg border border-success/30 bg-card px-4 py-3 text-foreground shadow-xl ring-1 ring-success/15">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Email sent successfully</p>
              <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                {emailSuccessPopup}
              </p>
            </div>
          </div>
        </div>
      )}
      {sending ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm"
          role="alert"
          aria-live="assertive"
          aria-busy="true"
        >
          <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 text-center">
            <ActiniumLoader size="xl" showText showDots />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Sending quote request emails…</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Please do not refresh, go back, or close this page until sending completes. Leaving now
                may interrupt email delivery.
              </p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="py-4">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            disabled={sending}
            className="text-xs"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-22 font-bold">Send Quote Request</h1>
          </div>
        </div>

        {/* Requisition Details Card - Show at top when sending quote request */}
        {requisition && (
          <Card className="border-border bg-info mb-6">
            <CardHeader>
              <CardTitle className="text-16 flex items-center gap-2">
                <Package className="h-5 w-5" />
                Requisition Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs text-foreground mb-2 block">Requisition Number</Label>
                  <p className="text-sm font-semibold">{requisition.requisitionNumber || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-xs text-foreground mb-2 block">Heading</Label>
                  <p className="text-sm font-semibold">{requisition.heading}</p>
                </div>
                {requisition.vessel && (
                  <div>
                    <Label className="text-xs text-foreground mb-2 block">Vessel</Label>
                    <p className="text-sm font-semibold flex items-center gap-1">
                      <Ship className="h-4 w-4" />
                      {requisition.vessel.name} ({requisition.vessel.code})
                    </p>
                  </div>
                )}
                {requisition.portOfSupply && (
                  <div>
                    <Label className="text-xs text-foreground mb-2 block">Port of Supply</Label>
                    <p className="text-sm font-semibold">{requisition.portOfSupply}</p>
                  </div>
                )}
                {requisition.dateOfCreation && (
                  <div>
                    <Label className="text-xs text-foreground mb-2 block">Date Created</Label>
                    <p className="text-sm font-semibold flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(requisition.dateOfCreation)}
                    </p>
                  </div>
                )}
                {requisition.createdBy && (
                  <div>
                    <Label className="text-xs text-foreground mb-2 block">Created By</Label>
                    <p className="text-sm font-semibold flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {requisition.createdBy.firstName} {requisition.createdBy.lastName}
                      {requisition.createdBy.designation && (
                        <span className="text-xs text-muted-foreground ml-1">({requisition.createdBy.designation})</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{success}</AlertDescription>
          </Alert>
        )}

        {/* Quote Configuration and Settings in same row */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
          {/* Quote Request Settings - 30% width */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-14">Quote Request Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="validUntil" className="text-xs font-medium mb-2 block">
                  Valid Until (days)
                </Label>
                <Input
                  id="validUntil"
                  type="number"
                  min="1"
                  max="365"
                  value={validUntilDays}
                  onChange={(e) => setValidUntilDays(parseInt(e.target.value) || 30)}
                  className="text-xs"
                />
              </div>
              
              <div>
                <Label htmlFor="portOfSupply" className="text-xs font-medium mb-2 block">
                  Port of Supply *
                </Label>
                <Input
                  id="portOfSupply"
                  type="text"
                  placeholder="Enter port of supply..."
                  value={portOfSupply}
                  onChange={(e) => setPortOfSupply(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="message" className="text-xs font-medium mb-2 block">
                  Custom Message (Optional)
                </Label>
                <Textarea
                  id="message"
                  placeholder="Enter any additional message for vendors..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={3}
                  className="text-xs"
                />
              </div>

              {/* Email Options */}
              <div className="pt-2 border-t space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeUserEmailInCc"
                    checked={includeUserEmailInCc}
                    onCheckedChange={(checked) => setIncludeUserEmailInCc(checked as boolean)}
                  />
                  <Label htmlFor="includeUserEmailInCc" className="text-xs font-medium cursor-pointer">
                    Include me in CC
                    {currentUser?.email && (
                      <span className="text-10 text-muted-foreground ml-1">({currentUser.email})</span>
                    )}
                  </Label>
                </div>

                <div>
                  <Label htmlFor="ccEmails" className="text-xs font-medium mb-2 block">
                    CC (Optional)
                  </Label>
                  <Input
                    id="ccEmails"
                    type="text"
                    placeholder="email1@example.com, email2@example.com"
                    value={ccEmails}
                    onChange={(e) => setCcEmails(e.target.value)}
                    className="text-xs"
                  />
                  <p className="text-10 text-muted-foreground mt-1">
                    Separate multiple emails with commas
                  </p>
                </div>

                <div>
                  <Label htmlFor="bccEmails" className="text-xs font-medium mb-2 block">
                    BCC (Optional)
                  </Label>
                  <Input
                    id="bccEmails"
                    type="text"
                    placeholder="email1@example.com, email2@example.com"
                    value={bccEmails}
                    onChange={(e) => setBccEmails(e.target.value)}
                    className="text-xs"
                  />
                  <p className="text-10 text-muted-foreground mt-1">
                    Separate multiple emails with commas
                  </p>
                </div>
              </div>

              {/* Download Template Button */}
              <div className="pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadTemplate}
                  disabled={downloading || !portOfSupply.trim()}
                  className="w-full text-xs"
                >
                  {downloading ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Download Template
                    </>
                  )}
                </Button>
                {!portOfSupply.trim() && (
                  <p className="text-10 text-muted-foreground mt-1">
                    Enter Port of Supply to download template
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Vendor Selection - 70% width */}
          <Card className="lg:col-span-7">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-14">Select Vendors</CardTitle>
                  <CardDescription className="text-xs">
                    {requisition?.status === 'SENT_FOR_QUOTE' 
                      ? `Add more vendors or resend to vendors that failed (${filteredVendors.length} available)`
                      : `Choose vendors to send quote requests to (${filteredVendors.length} available)`}
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="selectAll"
                    checked={allPageVendorsSelected}
                    onCheckedChange={handleSelectAll}
                  />
                  <Label htmlFor="selectAll" className="text-xs font-medium">
                    Select All ({paginatedVendors.length})
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label className="text-xs font-medium mb-2 block">Search Vendors</Label>
                  <MultiSelectDropdown
                    options={vendorOptions}
                    selectedValues={selectedVendorSearchIds}
                    onSelectionChange={setSelectedVendorSearchIds}
                    placeholder="Search and select vendors..."
                    searchPlaceholder="Type to search vendors..."
                    className="w-full"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium mb-2 block">Filter by Country</Label>
                  <MultiSelectDropdown
                    options={countryOptions}
                    selectedValues={selectedCountries}
                    onSelectionChange={(values) => {
                      setSelectedCountries(values);
                    }}
                    placeholder="Select countries..."
                    searchPlaceholder="Type to search countries..."
                    className="w-full"
                  />
                </div>
              </div>

              {/* Vendor Table */}
              {loading ? (
                <div className="flex justify-center py-16">
                  <ActiniumLoader size="lg" text="Loading vendors…" />
                </div>
              ) : filteredVendors.length === 0 ? (
                <div className="text-center py-4">
                  <Mail className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-14 font-medium">No vendors found</p>
                  <p className="text-xs text-foreground">Try adjusting your search criteria.</p>
                </div>
              ) : (
                <>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                      <TableSerialHead />
                          <TableHead className="w-12">
                            <Checkbox
                              checked={allPageVendorsSelected}
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                          <TableHead className="text-xs font-semibold">Vendor Name</TableHead>
                          <TableHead className="text-xs font-semibold w-[120px] max-w-[120px]">Email</TableHead>
                          <TableHead className="text-xs font-semibold">Contact Person</TableHead>
                          <TableHead className="text-xs font-semibold">Location</TableHead>
                          <TableHead className="text-xs font-semibold">Phone</TableHead>
                          <TableHead className="text-xs font-semibold">Quote Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedVendors.map((vendor, index) => (
                          <TableRow 
                            key={vendor.id}
                            className={
                              vendor.hasExistingQuote
                                ? "bg-success"
                                : selectedVendorIds.includes(vendor.id)
                                  ? "bg-info"
                                  : ""
                            }
                          >
                            <TableSerialCell serialNo={index + 1} />
                            <TableCell>
                              <Checkbox
                                checked={selectedVendorIds.includes(vendor.id)}
                                onCheckedChange={(checked) =>
                                  handleSelectVendor(vendor.id, checked as boolean)
                                }
                              />
                            </TableCell>
                            <TableCell className="font-medium text-xs">{vendor.name}</TableCell>
                            <TableCell className="text-xs w-[120px] max-w-[120px] break-words whitespace-normal">
                              <div className="flex flex-col gap-1 min-w-0">
                                {(vendor.primaryEmail || (vendor as any).email) && (
                                  <div className="flex items-center gap-1 min-w-0">
                                    <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <span className="break-all">{vendor.primaryEmail || (vendor as any).email}</span>
                                  </div>
                                )}
                                {vendor.secondaryEmail && (
                                  <div className="flex items-center gap-1 text-foreground min-w-0">
                                    <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <span className="text-xs break-all">{vendor.secondaryEmail}</span>
                                  </div>
                                )}
                                {!vendor.primaryEmail && !(vendor as any).email && !vendor.secondaryEmail && (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              {vendor.contactPerson ? (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  {vendor.contactPerson}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                {vendor.city ? `${vendor.city}, ` : ''}{vendor.country}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              {vendor.phone || <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell>
                              {vendor.lastQuoteStatus ? (
                                <Badge 
                                  variant="outline" 
                                  className={`text-10 ${getQuoteStatusColor(vendor.lastQuoteStatus)}`}
                                >
                                  {QUOTE_STATUS_LABELS[vendor.lastQuoteStatus]}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-10">No quote</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <TablePagination
                    page={currentPage}
                    pageSize={ITEMS_PER_PAGE}
                    total={filteredVendors.length}
                    onPageChange={setCurrentPage}
                    itemLabel="vendors"
                    className="mt-4"
                  />

                  {/* Send Button */}
                  {filteredVendors.length > 0 && (
                    <div className="mt-6 flex justify-end">
                      <Button
                        onClick={handleSendQuotes}
                        disabled={selectedVendorIds.length === 0 || sending}
                        className="text-xs bg-info hover:bg-info text-white"
                      >
                        {sending ? (
                          <>
                            <Clock className="w-4 h-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Send Quote Request to {selectedVendorIds.length} Vendor{selectedVendorIds.length > 1 ? 's' : ''}
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
        </PageReadyGate>
  );
}
