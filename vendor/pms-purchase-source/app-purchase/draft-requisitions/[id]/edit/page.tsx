"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RequisitionForm } from "@/components/RequisitionForm";
import { 
  FileText, 
  ArrowLeft,
  AlertTriangle
} from "lucide-react";
import {
  Requisition,
  CreateRequisitionData,
  GenerationStatus,
  RequisitionStatus,
  getDesignationAccessLevel
} from "@/lib/types/requisition";
import { toast } from "sonner";
import { useVessels } from "@/hooks/useStaticData";

export default function EditDraftRequisitionPage() {
  const params = useParams();
  const router = useRouter();
  const requisitionId = params.id as string;
  
  const { ready, markSuccess } = usePageBootstrap();
  
  // Use optimized hooks for static data with caching
  const { data: vessels = [], isLoading: vesselsLoading } = useVessels({ limit: 100, isActive: true });
  
  const [requisition, setRequisition] = useState<Requisition | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userAccessLevel, setUserAccessLevel] = useState<number | undefined>(undefined);
  const [accessDenied, setAccessDenied] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Fetch current user from API
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch("/api/profile/basic", {
          credentials: "include"
        });
        if (response.ok) {
          const data = await response.json();
          const user = data.user;
          setCurrentUser(user);
          const accessLevel = user.designationAccessLevel;
          setUserAccessLevel(accessLevel);
        } else {
          console.error("Failed to fetch user");
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUser();
  }, []);

  // Fetch requisition (vessels are loaded via useVessels hook)
  useEffect(() => {
    const loadData = async () => {
      if (!requisitionId || vesselsLoading) {
        if (!requisitionId) {
          setNotFound(true);
          markSuccess();
        }
        return;
      }

      try {
        // Vessels are now loaded via useVessels hook
        // Fetch requisition
        const requisitionResponse = await fetch(`/api/requisitions/${requisitionId}`, {
          credentials: "include"
        });

        if (requisitionResponse.status === 404) {
          setNotFound(true);
          markSuccess();
          return;
        }

        if (requisitionResponse.status === 403) {
          setAccessDenied(true);
          markSuccess();
          return;
        }

        if (!requisitionResponse.ok) {
          const errorData = await requisitionResponse.json().catch(() => ({ error: 'Unknown error' }));
          console.error("Failed to load requisition:", errorData);
          toast.error(errorData.error || "Failed to load requisition");
          markSuccess();
          return;
        }

        const requisitionData = await requisitionResponse.json();
        
        // Check if user can edit this requisition
        if (currentUser && requisitionData) {
          // Cannot edit if status is NEW_REQ (New Requisition)
          const isNewRequisition = requisitionData.status === RequisitionStatus.NEW_REQ;
          // Cannot edit if status is QUOTE_CONFIRMED_PO_SENT (PO has been sent)
          const isQuoteConfirmed = requisitionData.status === RequisitionStatus.QUOTE_CONFIRMED_PO_SENT;
          // Cannot edit if status is REQ_RECEIVED_DELIVERED (Items have been delivered)
          const isReceivedDelivered = requisitionData.status === RequisitionStatus.REQ_RECEIVED_DELIVERED;
          const isDraft = requisitionData.generationStatus === GenerationStatus.SAVED_AS_DRAFT;
          const canEdit = 
            !isNewRequisition &&
            !isQuoteConfirmed &&
            !isReceivedDelivered &&
            isDraft &&
            (requisitionData.createdById === currentUser.id || 
             userAccessLevel === 25 || 
             [50, 99, 100].includes(userAccessLevel)); // Masters and Admins can edit any

          if (!canEdit) {
            setAccessDenied(true);
            markSuccess();
            return;
          }
        }

        setRequisition(requisitionData);
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load requisition. Please try again.");
        setNotFound(true);
      } finally {
        markSuccess();
      }
    };

    // Load data once we have the requisition ID
    if (requisitionId) {
      loadData();
    }
  }, [requisitionId, currentUser, userAccessLevel, markSuccess]);

  // Handle update requisition
  const handleUpdateRequisition = async (data: CreateRequisitionData & { generationStatus: GenerationStatus }) => {
    if (!currentUser?.id) {
      toast.error("User not authenticated. Please refresh the page.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/requisitions/${requisitionId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          updatedById: currentUser.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        const errorMessage = errorData.error || errorData.message || `Failed to update requisition (${response.status})`;
        console.error("Update requisition error:", errorData);
        
        if (response.status === 403) {
          toast.error("Access denied: " + errorMessage);
        } else if (response.status === 400) {
          toast.error("Validation error: " + errorMessage);
        } else if (response.status === 500) {
          toast.error("Server error: " + errorMessage + ". Check server logs.");
        } else {
          toast.error(errorMessage);
        }
        
        throw new Error(errorMessage);
      }
      
      // Success
      const responseData = await response.json();
      if (data.generationStatus === GenerationStatus.SAVED_AS_DRAFT) {
        toast.success("Draft updated successfully!");
        router.push("/purchase/draft-requisitions");
      } else {
        toast.success("Requisition created successfully!");
        window.location.href = "/purchase/view-requisitions";
      }
    } catch (error) {
      console.error("Error updating requisition:", error);
      toast.error("Failed to update requisition");
    } finally {
      setIsSubmitting(false);
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
                  You don't have permission to edit this requisition. Only the creator or Masters can edit draft requisitions.
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
  return (<PageReadyGate ready={ready}>
    <div className="space-y-4">
      <main className="mx-auto py-4" style={{ width: "90%", maxWidth: "90vw" }}>
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="outline"
              onClick={() => router.push("/purchase/draft-requisitions")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Edit Draft Requisition</h1>
            <p className="text-foreground">
              Update the requisition details and items below. You can save as draft or create the requisition.
            </p>
          </div>
        </div>

        {/* Return Comments Alert - Show if requisition was returned */}
        {requisition.returnComments && (
          <Card className="mb-6 border-border bg-warning">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-warning">
                <AlertTriangle className="h-5 w-5" />
                Return Comments
              </CardTitle>
              <CardDescription className="text-warning">
                This requisition was returned for editing. Please review the comments below and make the necessary changes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-white p-4 rounded-md border border-border">
                <p className="text-foreground whitespace-pre-wrap">{requisition.returnComments}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Requisition Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-info" />
              Requisition Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-foreground mb-1">Requisition Number</p>
                <p className="font-semibold text-foreground">{requisition.requisitionNumber}</p>
              </div>
              <div>
                <p className="text-sm text-foreground mb-1">Vessel</p>
                <p className="font-semibold text-foreground">{requisition.vessel?.name || "Unknown"}</p>
              </div>
              <div>
                <p className="text-sm text-foreground mb-1">Created</p>
                <p className="font-semibold text-foreground">
                  {new Date(requisition.dateOfCreation).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Requisition Form - Full Page */}
        <RequisitionForm
          displayMode="page"
          onClose={() => router.push("/purchase/draft-requisitions")}
          onSubmit={handleUpdateRequisition}
          editing={requisition}
          isSubmitting={isSubmitting}
          vessels={vessels}
          currentUserId={currentUser?.id || ""}
          selectedType={requisition.requisitionType}
          selectedVessel={requisition.vesselId}
          manualReqNumber={requisition.manualReqNumber || ""}
          preFilledData={{
            heading: requisition.heading,
            description: requisition.description || "",
            portOfSupply: requisition.portOfSupply || "",
          }}
        />
      </main>
    </div>
    </PageReadyGate>
  );
}

