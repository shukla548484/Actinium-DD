"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import VendorForm from "@/components/VendorForm";
import { ArrowLeft, Store, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { UpdateVendorData, Vendor } from "@/lib/types/vendor";

export default function EditVendorPage() {
  const router = useRouter();
  const params = useParams();
  const vendorId = params?.id as string;
  const { ready, markSuccess } = usePageBootstrap();
  
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [umbrellaCompanyId, setUmbrellaCompanyId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Fetch current user and umbrella company ID
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch("/api/profile/basic", {
          credentials: "include"
        });
        
        if (response.ok) {
          const data = await response.json();
          setCurrentUser(data.user);
          
          // Get umbrella company ID from user's company
          if (data.user?.company?.id) {
            const userCompany = data.user.company;
            // If it's a master company, use it directly
            // If it's a sub-company, use the parent ID (which should be the master company)
            if (userCompany.type === "MASTER_COMPANY") {
              setUmbrellaCompanyId(userCompany.id);
            } else if (userCompany.parentId) {
              setUmbrellaCompanyId(userCompany.parentId);
            } else {
              // Fallback: use the company ID
              setUmbrellaCompanyId(userCompany.id);
            }
          }
        } else {
          toast.error("Failed to load user information");
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        toast.error("Failed to load user information");
      }
    };

    fetchUser();
  }, []);

  // Fetch vendor data
  useEffect(() => {
    const fetchVendor = async () => {
      if (!vendorId) {
        toast.error("Vendor ID is required");
        router.push("/purchase/vendor-management");
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`/api/vendors/${vendorId}`, {
          credentials: "include",
        });

        if (!response.ok) {
          if (response.status === 404) {
            toast.error("Vendor not found");
            router.push("/purchase/vendor-management");
            return;
          }
          const error = await response.json();
          throw new Error(error.error || "Failed to fetch vendor");
        }

        const data = await response.json();
        setVendor(data);
      } catch (error: any) {
        console.error("Error fetching vendor:", error);
        toast.error(error.message || "Failed to load vendor details");
        router.push("/purchase/vendor-management");
      } finally {
        setLoading(false);
        markSuccess();
      }
    };

    if (umbrellaCompanyId) {
      fetchVendor();
    }
  }, [vendorId, umbrellaCompanyId, router, markSuccess]);

  // Handle form submission
  const handleSubmit = async (data: UpdateVendorData) => {
    if (!vendorId) {
      toast.error("Vendor ID is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/vendors/${vendorId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        toast.error(errorData.error || errorData.message || `Failed to update vendor (${response.status})`);
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: Failed to update vendor`);
      }
      
      const updatedVendor = await response.json();
      toast.success(`Vendor "${updatedVendor.name}" updated successfully!`);
      router.push(`/purchase/vendor-management/view/${vendorId}`);
    } catch (error) {
      console.error("Error updating vendor:", error);
      toast.error("Failed to update vendor. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    router.push(`/purchase/vendor-management/view/${vendorId}`);
  };

  if (!umbrellaCompanyId) {
    return (
      <div className="space-y-4">
        <main className="mx-auto py-4" style={{ width: "90%", maxWidth: "90vw" }}>
          <Card>
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <Store className="h-16 w-16 text-destructive" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Company Information Required</h1>
                <p className="text-foreground">
                  Unable to determine your umbrella company. Please contact your administrator.
                </p>
                <Button onClick={() => router.push("/purchase/vendor-management")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Vendor Management
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="space-y-4">
        <main className="mx-auto py-4" style={{ width: "90%", maxWidth: "90vw" }}>
          <Card>
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <AlertTriangle className="h-16 w-16 text-destructive mx-auto" />
                <h1 className="text-2xl font-bold text-foreground">Vendor Not Found</h1>
                <p className="text-foreground">The vendor you're looking for doesn't exist or has been removed.</p>
                <Button onClick={() => router.push("/purchase/vendor-management")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Vendor Management
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <PageReadyGate ready={ready && !loading} loadingText="Loading vendor details...">
    <div className="space-y-4">
      <main className="mx-auto py-4" style={{ width: "90%", maxWidth: "90vw" }}>
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Vendor Details
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Edit Vendor</h1>
            <p className="text-foreground">
              Update vendor information. Fields marked with * are required.
            </p>
          </div>
        </div>

        {/* Vendor Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Vendor Information
            </CardTitle>
            <CardDescription>
              Update the vendor's details. Fields marked with * are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VendorForm
              open={true}
              onClose={handleCancel}
              onSubmit={handleSubmit}
              editing={vendor}
              isSubmitting={isSubmitting}
              umbrellaCompanyId={umbrellaCompanyId}
            />
          </CardContent>
        </Card>
      </main>
    </div>
    </PageReadyGate>
  );
}








