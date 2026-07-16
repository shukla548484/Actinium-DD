"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RequisitionTypeBadge } from "@/components/requisition/RequisitionTypeBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Clock, Ship, User, Eye } from "lucide-react";
import ActiniumLoader from "@/components/ActiniumLoader";
import { Requisition, REQUISITION_TYPE_LABELS } from "@/lib/types/requisition";

export default function MasterGenerationApprovalPage() {
  
  const { ready, markSuccess } = usePageBootstrap();

const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Mock employee ID - in real app, this would come from session
  const employeeId = "mock-master-employee-id";

  useEffect(() => {
    fetchRequisitions();
  }, []);

  const fetchRequisitions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/requisitions/master-approval?employeeId=${employeeId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch requisitions');
      }
      
      setRequisitions(data.requisitions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch requisitions');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(requisitions.map(req => req.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRequisition = (requisitionId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, requisitionId]);
    } else {
      setSelectedIds(prev => prev.filter(id => id !== requisitionId));
    }
  };

  const handleApprove = async () => {
    if (selectedIds.length === 0) {
      setError("Please select at least one requisition to approve");
      return;
    }

    try {
      setApproving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/requisitions/master-approval', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requisitionIds: selectedIds,
          employeeId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve requisitions');
      }

      setSuccess(`Successfully approved ${data.approvedCount} requisitions`);
      setSelectedIds([]);
      
      // Refresh the list
      await fetchRequisitions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve requisitions');
    } finally {
      setApproving(false);
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="mx-auto py-4" style={{ width: "90%", maxWidth: "90vw" }}>
          <div className="flex min-h-[400px] items-center justify-center">
            <ActiniumLoader size="lg" text="Loading requisitions…" />
          </div>
        </div>
      </div>

    );
  }

  return (<PageReadyGate ready={ready}>
    <div className="space-y-4">
      <div className="mx-auto py-4" style={{ width: "90%", maxWidth: "90vw" }}>
      <div>
        <h1 className="text-22 font-bold mb-2">Master Generation Approval</h1>
        <p className="text-14 text-foreground">
          Review and approve draft requisitions for generation. Only V-prefixed requisitions require Master approval.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-14">Requisitions Pending Approval</CardTitle>
          <CardDescription className="text-xs">
            {requisitions.length} requisition{requisitions.length !== 1 ? 's' : ''} pending Master approval
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requisitions.length === 0 ? (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-success" />
              <p className="text-14 font-medium">No requisitions pending approval</p>
              <p className="text-xs text-foreground">All V-prefixed draft requisitions have been processed.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="selectAll"
                    checked={selectedIds.length === requisitions.length && requisitions.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <label htmlFor="selectAll" className="text-xs font-medium cursor-pointer">
                    Select All ({requisitions.length})
                  </label>
                </div>
                <Button
                  onClick={handleApprove}
                  disabled={selectedIds.length === 0 || approving}
                  className="text-xs"
                >
                  {approving ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve Selected ({selectedIds.length})
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-3">
                {requisitions.map((requisition) => (
                  <Card key={requisition.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <Checkbox
                            id={`req-${requisition.id}`}
                            checked={selectedIds.includes(requisition.id)}
                            onCheckedChange={(checked) =>
                              handleSelectRequisition(requisition.id, checked as boolean)
                            }
                          />
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center space-x-3">
                              <h3 className="text-14 font-semibold">{requisition.heading}</h3>
                              <Badge variant="outline" className="text-10">
                                {requisition.requisitionNumber}
                              </Badge>
                              <RequisitionTypeBadge type={requisition.requisitionType} className="text-10" />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-xs text-foreground">
                              <div className="flex items-center space-x-2">
                                <Ship className="w-4 h-4" />
                                <span>{requisition.vessel?.name} ({requisition.vessel?.code})</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <User className="w-4 h-4" />
                                <span>
                                  {requisition.createdBy?.firstName} {requisition.createdBy?.lastName}
                                  {requisition.createdBy?.designation && (
                                    <span className="text-10 text-muted-foreground ml-1">
                                      ({requisition.createdBy.designation})
                                    </span>
                                  )}
                                </span>
                              </div>
                            </div>

                            <div className="text-xs text-foreground">
                              <p><strong>Created:</strong> {formatDate(requisition.dateOfCreation)}</p>
                              {requisition.description && (
                                <p className="mt-1"><strong>Description:</strong> {requisition.description}</p>
                              )}
                              {requisition.portOfSupply && (
                                <p><strong>Port of Supply:</strong> {requisition.portOfSupply}</p>
                              )}
                            </div>

                            {requisition.items && requisition.items.length > 0 && (
                              <div className="text-xs">
                                <p className="font-medium">Items: {requisition.items.length}</p>
                                <div className="mt-1 text-foreground">
                                  {requisition.items.slice(0, 3).map((item, index) => (
                                    <span key={item.id}>
                                      {item.itemName}
                                      {index < Math.min(requisition.items!.length, 3) - 1 && ', '}
                                    </span>
                                  ))}
                                  {requisition.items.length > 3 && (
                                    <span> and {requisition.items.length - 3} more...</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
    </PageReadyGate>
  );
}