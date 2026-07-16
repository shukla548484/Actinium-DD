"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import VendorForm from "@/components/VendorForm";
import { ArrowLeft, Store } from "lucide-react";
import { toast } from "sonner";
import { CreateVendorData } from "@/lib/types/vendor";

export default function CreateVendorPage() {
  const router = useRouter();
  const { ready, markSuccess } = usePageBootstrap();
  const [umbrellaCompanyId, setUmbrellaCompanyId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      } finally {
        markSuccess();
      }
    };

    fetchUser();
  }, [markSuccess]);

  // Handle form submission
  const handleSubmit = async (data: CreateVendorData) => {
    if (!umbrellaCompanyId) {
      toast.error("Umbrella company ID is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/vendors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          umbrellaCompanyId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        toast.error(errorData.error || errorData.message || `Failed to create vendor (${response.status})`);
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: Failed to create vendor`);
      }
      
      const vendor = await response.json();
      toast.success(`Vendor "${vendor.name}" created successfully!`);
      router.push("/purchase/vendor-management");
    } catch (error) {
      console.error("Error creating vendor:", error);
      toast.error("Failed to create vendor. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    router.push("/purchase/vendor-management");
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

  return (
    <PageReadyGate ready={ready} loadingText="Loading vendor setup...">
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
            Back to Vendor Management
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Create New Vendor</h1>
            <p className="text-foreground">
              Add a new vendor to your system. Fill in all required fields to continue.
            </p>
          </div>
        </div>

        {/* Vendor Form - Using Card instead of Dialog */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Vendor Information
            </CardTitle>
            <CardDescription>
              Enter the vendor's details. Fields marked with * are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VendorForm
              open={true}
              onClose={handleCancel}
              onSubmit={handleSubmit}
              editing={null}
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

